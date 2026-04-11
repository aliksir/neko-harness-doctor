// hooks.mjs - Hooks indicators (IND-10 to IND-12)

import { basename } from 'path';
import { safeRead, parseJSON, findHookScripts, findSettingsJson } from '../utils.mjs';

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
        const hasCatch = /try\s*{[\s\S]*?catch/.test(c) || /process\.on\s*\(\s*['"]uncaught/.test(c);
        if (!hasCatch) bad.push(basename(f));
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) lack try/catch: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Add try/catch or process.on("uncaughtException") to all hook scripts',
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
        if (/writeFileSync|appendFileSync|rmSync|unlinkSync|fetch\(|https?:\/\//i.test(c)) {
          bad.push(basename(f));
        }
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) contain side effects: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Keep hooks read-only; avoid file writes and network calls',
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
];
