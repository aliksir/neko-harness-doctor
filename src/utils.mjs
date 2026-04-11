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

export function walkFiles(dir, pattern, maxDepth = 3, depth = 0) {
  const out = [];
  if (depth > maxDepth) return out;
  for (const ent of safeList(dir)) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.git')) continue;
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
  if (!text || !text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return null;
  const body = text.slice(4, end);
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
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
