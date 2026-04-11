// settings.mjs - settings.json indicators (IND-06 to IND-09)

import { safeRead, parseJSON, findSettingsJson } from '../utils.mjs';

export const settingsIndicators = [
  {
    id: 'IND-06',
    category: 'settings',
    name: 'bypass-permissions-enabled',
    severity: 'critical',
    evidence: 'Principle of least privilege',
    autoFixable: true,
    fixStrategy: 'remove-bypass-permissions',
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true, note: 'settings.json not found' };
      const json = parseJSON(safeRead(settings));
      if (!json) return { passed: true };
      if (json.bypassPermissions === true || json?.permissions?.bypassPermissions === true) {
        return {
          passed: false,
          violation: '"bypassPermissions": true is set',
          location: settings,
          remediation: 'Remove bypassPermissions; allow only needed permissions explicitly',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-07',
    category: 'settings',
    name: 'auto-accept-all',
    severity: 'major',
    evidence: 'Principle of least privilege',
    autoFixable: true,
    fixStrategy: 'narrow-auto-accept',
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true };
      const json = parseJSON(safeRead(settings));
      if (!json) return { passed: true };
      const allow = json?.permissions?.allow || [];
      if (allow.includes('*') || json.autoAccept === true || json.autoAccept === '*') {
        return {
          passed: false,
          violation: 'autoAccept allows all, or permissions.allow contains "*"',
          location: settings,
          remediation: 'Limit allow list per tool (e.g. "Read", "Grep", "Glob")',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-08',
    category: 'settings',
    name: 'permissions-too-broad',
    severity: 'major',
    evidence: 'Principle of least privilege',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true };
      const json = parseJSON(safeRead(settings));
      if (!json) return { passed: true };
      const allow = json?.permissions?.allow || [];
      const broad = allow.filter(p =>
        /^Bash\(\*\)$/.test(p) || /^Write\(\*\)$/.test(p) || /^Edit\(\*\)$/.test(p)
      );
      if (broad.length > 0) {
        return {
          passed: false,
          violation: `Overly broad wildcard permissions: ${broad.join(', ')}`,
          location: settings,
          remediation: 'Narrow to specific commands/paths (e.g. "Bash(git status)")',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-09',
    category: 'settings',
    name: 'hooks-not-configured',
    severity: 'major',
    evidence: 'Quality gate best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true };
      const json = parseJSON(safeRead(settings));
      if (!json) return { passed: true };
      const hooks = json.hooks;
      if (!hooks || (typeof hooks === 'object' && Object.keys(hooks).length === 0)) {
        return {
          passed: false,
          violation: 'hooks section is missing or empty in settings.json',
          location: settings,
          remediation: 'Configure PreToolUse/PostToolUse hooks for quality gates and auditing',
        };
      }
      return { passed: true };
    },
  },
];
