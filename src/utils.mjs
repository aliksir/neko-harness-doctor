// utils.mjs - Shared helpers (file IO, parsing, path discovery)

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ===========================================================================
// Shared regex constants (used across multiple indicators)
// ===========================================================================

/** Volatile element pattern (used by IND-02, IND-05) */
export const VOLATILE_RE = /\d{4}-\d{2}-\d{2}|v\d+\.\d+\.\d+|session \d+|last updated|タイムスタンプ/i;

/** Critical-rule heading pattern (used by IND-03) */
export const CRITICAL_HEADING_RE = /critical|クリティカルルール|重要(?!度|事項|情報)|destructive/i;

/** Minimum description length for skill (IND-13).
 *  Based on 6 required elements × ~10 chars each (general MCP tool documentation practice). */
export const DESC_MIN_LEN = 60;

// ===========================================================================
// Safe IO helpers
// ===========================================================================

export function safeRead(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function safeList(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/** Directory names always skipped during traversal. */
const SKIP_DIRS = new Set([
  'node_modules',
  '__tests__',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '.cache',
]);

export function walkFiles(dir, pattern, maxDepth = 3, depth = 0) {
  const out = [];
  if (depth > maxDepth) return out;
  for (const ent of safeList(dir)) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.git')) continue;
      out.push(...walkFiles(p, pattern, maxDepth, depth + 1));
    } else if (ent.isFile() && pattern.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

// ===========================================================================
// Parsers
// ===========================================================================

export function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Minimal YAML frontmatter parser (key: value on single lines).
 * Does NOT support multi-line values, arrays, or nested objects.
 * Sufficient for SKILL.md frontmatter (name, description, risk, metadata).
 */
export function parseFrontmatter(text) {
  if (!text) return null;
  // Normalize CRLF to LF — ECMAScript `.` doesn't match \r, which broke v0.1.0 on Windows
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!norm.startsWith('---')) return null;
  const end = norm.indexOf('\n---', 3);
  if (end < 0) return null;
  const body = norm.slice(4, end);
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// ===========================================================================
// Path expansion and workspace discovery
// ===========================================================================

/**
 * Expand `~` and `~/` to the user's home directory.
 * Safe for cross-platform use — handles both POSIX (`~/foo`) and
 * Windows PowerShell paths (`~\foo`). Non-tilde paths pass through unchanged.
 *
 * PowerShell does not perform tilde expansion on unquoted arguments, so users
 * who run `neko-harness-doctor --target ~/.claude` get the literal string
 * `~/.claude`. This helper makes that work the same as Bash would.
 */
export function expandTilde(p) {
  if (typeof p !== 'string' || p.length === 0) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Walk up from a starting directory looking for a likely workspace root.
 * A directory is scored by how many of the following markers it contains:
 *   - `.claude/` directory
 *   - `plans/` directory
 *   - `CLAUDE.md` file
 *
 * The ancestor with the highest marker count wins. Ties keep the first
 * match encountered (closer to `startDir`). The home directory itself is
 * never treated as a workspace (it contains `~/.claude/` as user config,
 * not as a workspace marker) and stops the upward walk. Returns
 * `startDir` if nothing is found.
 *
 * This scoring approach fixes a v0.3.0 regression where running from a
 * nested sub-project (e.g. `C:/work/my-lib` that contains `.claude/`)
 * stopped at the first match and missed the real workspace (`C:/work`)
 * that also contains `plans/` and `CLAUDE.md`. Workflow indicators
 * (IND-23/24/25) now see the true workspace root.
 */
export function findDefaultWorkspace(startDir = process.cwd()) {
  if (process.env.NEKO_HARNESS_WORKSPACE) {
    return process.env.NEKO_HARNESS_WORKSPACE;
  }
  const markers = ['.claude', 'plans', 'CLAUDE.md'];
  const countMarkers = (d) => markers.filter((m) => existsSync(join(d, m))).length;

  const home = homedir();
  let dir = startDir;
  let bestMatch = null;
  let bestScore = 0;
  // Guard against infinite loops with a hard depth limit.
  for (let i = 0; i < 20; i++) {
    // The home directory is user config land, not a workspace. Stop here so
    // a coincidental `~/.claude/` or `~/plans/` cannot hijack the result.
    if (dir === home) break;
    const score = countMarkers(dir);
    // Strictly higher score wins. Ties keep the first (closer) match.
    if (score > bestScore) {
      bestScore = score;
      bestMatch = dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return bestMatch || startDir;
}

// ===========================================================================
// Path discovery (generalized: accepts --target and --workspace)
// ===========================================================================

/**
 * Build a list of candidate paths for CLAUDE.md.
 * Order of preference:
 *   1. target/CLAUDE.md
 *   2. workspace/CLAUDE.md
 *   3. ~/.claude/CLAUDE.md
 */
export function findClaudeMd(target, workspace) {
  const candidates = [
    join(target, 'CLAUDE.md'),
  ];
  if (workspace) candidates.push(join(workspace, 'CLAUDE.md'));
  candidates.push(join(homedir(), '.claude', 'CLAUDE.md'));
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export function findSettingsJson(target) {
  const candidates = [
    join(target, 'settings.json'),
    join(target, '.claude', 'settings.json'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export function findMemoryMd(target) {
  const candidates = [
    join(target, 'MEMORY.md'),
    join(target, 'memory', 'MEMORY.md'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  // Generic fallback: scan one level deep under target for any {dir}/MEMORY.md
  for (const ent of safeList(target)) {
    if (ent.isDirectory() && !ent.name.startsWith('.')) {
      const p = join(target, ent.name, 'MEMORY.md');
      if (existsSync(p)) return p;
    }
  }
  return null;
}

export function findLessonsDir(target) {
  const candidates = [
    join(target, 'lessons'),
    join(target, 'memory', 'lessons'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export function findMcpJson(target, workspace) {
  const candidates = [
    join(target, '.mcp.json'),
    join(target, 'mcp.json'),
  ];
  if (workspace) candidates.push(join(workspace, '.mcp.json'));
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export function findHookScripts(target) {
  const hooksDir = join(target, 'hooks');
  if (!existsSync(hooksDir)) return [];
  return walkFiles(hooksDir, /\.(mjs|js|sh)$/);
}

// ===========================================================================
// External skill detection
// ===========================================================================

/**
 * Determine if a skill comes from an external source (community / marketplace / upstream repo).
 *
 * Signals (OR):
 *   - `source` field is not "custom" / "aliks" / "aliksir"
 *   - `source` contains a URL (http/https)
 *   - `date_added` field present (common in community skill repos)
 *   - SKILL.md body contains both `allowed-tools:` and `model:` top-level keys
 *     (a pattern used by Anthropic community skills)
 *
 * Used to let users exclude upstream-managed skills from indicators IND-13/15/16,
 * because mass-rewriting upstream files causes merge conflicts.
 */
export function isExternalSkill(fm, skillMdContent) {
  // Strict policy: a skill is considered "custom" (i.e. owned by the user) only when
  // it carries an EXPLICIT marker. Absence of marker = external / upstream-managed.
  //
  // Rationale: users rarely touch upstream skill files, and counting them against
  // IND-13/14/15/16 creates un-fixable violations. In --skip-external mode, we
  // intentionally require an explicit opt-in.
  //
  // Explicit custom markers (any one suffices):
  //   - frontmatter `source: custom` / `source: aliks` / `source: aliksir`
  //   - frontmatter `author` contains "aliks" (case-insensitive)
  //   - frontmatter `author: custom`
  if (!fm) return true; // no parseable frontmatter → external

  const src = fm.source ? String(fm.source).toLowerCase() : '';
  const auth = fm.author ? String(fm.author).toLowerCase() : '';
  const customSources = ['custom', 'aliks', 'aliksir'];
  const hasCustomSource = customSources.includes(src);
  const hasCustomAuthor = auth.includes('aliks') || auth === 'custom';

  return !(hasCustomSource || hasCustomAuthor);
}

// ===========================================================================
// User config loader (for publisher allowlist etc.)
// ===========================================================================

export function loadUserConfig() {
  const configPath = join(homedir(), '.neko-harness-doctor', 'config.json');
  if (!existsSync(configPath)) return {};
  const content = safeRead(configPath);
  return parseJSON(content) || {};
}

// ===========================================================================
// i18n helpers
// ===========================================================================

/**
 * Simple template interpolation: "{key}" → value
 */
export function interp(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
