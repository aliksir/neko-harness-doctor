// hooks.mjs - Hooks indicators (IND-10 to IND-12, IND-31)

import { basename } from 'path';
import { execSync } from 'child_process';
import { safeRead, parseJSON, findHookScripts, findSettingsJson } from '../utils.mjs';

/**
 * Detect if a hook script has some form of error handling.
 * Shell scripts and JS/TS scripts use different idioms.
 */
function hasErrorHandling(filePath, content) {
  const isShell = /\.sh$/i.test(filePath);
  if (isShell) {
    // Shell idioms: set -e / set -o errexit / trap ... ERR / || exit
    return /\bset\s+-e\b/.test(content)
      || /\bset\s+-o\s+errexit\b/.test(content)
      || /\btrap\s+['"]?[^'"]*['"]?\s+ERR\b/.test(content)
      || /\|\|\s*exit\b/.test(content);
  }
  // JS/mjs idioms: try/catch or process.on('uncaughtException')
  return /try\s*{[\s\S]*?catch/.test(content)
    || /process\.on\s*\(\s*['"]uncaught/.test(content);
}

/**
 * Check for inline ignore directive: `hd-ignore: IND-NN`
 * Allows authors to mark intentional violations (e.g. write-by-design hooks).
 */
function hasIgnoreDirective(content, indicatorId) {
  const re = new RegExp(`hd-ignore:\\s*${indicatorId}\\b`);
  return re.test(content);
}

export const hooksIndicators = [
  {
    id: 'IND-10',
    category: 'hooks',
    name: 'hook-missing-error-handling',
    severity: 'major',
    evidence: 'Hook reliability best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true, note: 'no hooks found' };
      const bad = [];
      for (const f of files) {
        const c = safeRead(f);
        if (!c) continue;
        // Honor inline ignore directive
        if (hasIgnoreDirective(c, 'IND-10')) continue;
        if (!hasErrorHandling(f, c)) bad.push(basename(f));
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) lack error handling: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Add try/catch (JS) or `set -e` / `trap ... ERR` (shell) to all hook scripts. Inline opt-out: `hd-ignore: IND-10`',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-11',
    category: 'hooks',
    name: 'hook-side-effects',
    severity: 'major',
    evidence: 'Hook purity principle (read-only enforcement)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true };
      const bad = [];
      for (const f of files) {
        const c = safeRead(f);
        if (!c) continue;
        // Honor inline ignore directive (e.g. persistent-state hooks)
        if (hasIgnoreDirective(c, 'IND-11')) continue;
        if (/writeFileSync|appendFileSync|rmSync|unlinkSync|fetch\(|https?:\/\//i.test(c)) {
          bad.push(basename(f));
        }
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) contain side effects: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Keep hooks read-only; avoid file writes and network calls. Inline opt-out: `hd-ignore: IND-11 — reason`',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-12',
    category: 'hooks',
    name: 'post-tool-use-overuse',
    severity: 'minor',
    evidence: 'Performance best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true };
      const json = parseJSON(safeRead(settings));
      if (!json?.hooks?.PostToolUse) return { passed: true };
      const pt = json.hooks.PostToolUse;
      const count = Array.isArray(pt) ? pt.length : Object.keys(pt).length;
      if (count >= 10) {
        return {
          passed: false,
          violation: `PostToolUse hooks: ${count} (threshold 10)`,
          location: settings,
          remediation: 'Consolidate multiple hooks into one script or distribute to PreToolUse',
        };
      }
      return { passed: true };
    },
  },

  // -------------------------------------------------------------------------
  // v0.4 indicators (IND-31)
  // Source: designs/20260523_doctor-v0.4-roadmap.md
  // -------------------------------------------------------------------------

  {
    id: 'IND-31',
    category: 'hooks',
    name: 'yoshi-binary-unavailable',
    severity: 'minor',
    evidence: 'yoshi token optimizer (CLAUDE.md yoshi section, feedback_no_external_api.md)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      // Allow opt-out via env var (e.g. CI environments without yoshi)
      if (process.env.NEKO_HARNESS_SKIP_YOSHI) {
        return { passed: true, note: 'skipped via NEKO_HARNESS_SKIP_YOSHI' };
      }
      let stdout;
      try {
        stdout = execSync('yoshi --version', {
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString().trim();
      } catch {
        return {
          passed: false,
          violation: 'yoshi not on PATH or did not respond',
          remediation: 'Install yoshi (C:/work/yoshi/) and put it on PATH. Required for Bash output compression in `bash` hook scripts.',
        };
      }
      // Match "yoshi 0.6.0" or "0.6.0" or anything with a version number
      const m = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!m) {
        return {
          passed: false,
          violation: `yoshi --version returned unexpected output: ${stdout.slice(0, 60)}`,
          remediation: 'Upgrade yoshi to v0.6.0 or later (PowerShell deny avoidance requires v0.6+).',
        };
      }
      const major = parseInt(m[1], 10);
      const minor = parseInt(m[2], 10);
      // Require >= v0.6.0 (PowerShell deny avoidance, `yoshi git -C` requires v0.7.0)
      if (major === 0 && minor < 6) {
        return {
          passed: false,
          violation: `yoshi version ${m[0]} is below v0.6.0 (PowerShell deny avoidance requires v0.6+)`,
          remediation: 'Upgrade yoshi to v0.6.0+ (`yoshi git -C <path>` ergonomics requires v0.7.0+).',
        };
      }
      return { passed: true, note: `yoshi ${m[0]} detected` };
    },
  },
];
