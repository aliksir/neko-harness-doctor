// workflow.mjs - Workflow indicators (IND-23 to IND-25)

import { existsSync } from 'fs';
import { join } from 'path';
import { safeList, safeStat } from '../utils.mjs';

export const workflowIndicators = [
  {
    id: 'IND-23',
    category: 'workflow',
    name: 'gate-definitions-missing',
    severity: 'major',
    evidence: 'Quality gate best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      // Look for gate definitions in target and workspace
      const paths = [
        join(ctx.target, 'gates'),
        join(ctx.target, 'rules', 'gates.md'),
      ];
      if (ctx.workspace) {
        paths.push(join(ctx.workspace, '.claude', 'gates'));
        paths.push(join(ctx.workspace, '.claude', 'rules', 'gates.md'));
      }
      const hasGates = paths.some(p => existsSync(p));
      if (!hasGates) {
        return {
          passed: false,
          violation: 'No gate definitions found (gates/ or rules/gates.md)',
          remediation: 'Create start/complete gate definitions under rules/gates.md',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-24',
    category: 'workflow',
    name: 'plans-directory-unused',
    severity: 'major',
    evidence: 'Planning-before-implementation principle',
    autoFixable: true,
    fixStrategy: 'create-plans-dir',
    check(ctx) {
      const plansDir = ctx.workspace ? join(ctx.workspace, 'plans') : null;
      if (!plansDir || !existsSync(plansDir)) {
        return {
          passed: false,
          violation: 'plans/ directory missing (workspace not set or no plans/)',
          remediation: 'Create plans/ and start writing plan documents (plans/YYYYMMDD_{task}.md) before implementation',
        };
      }
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const recent = safeList(plansDir)
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .some(e => {
          const st = safeStat(join(plansDir, e.name));
          return st && st.mtime.getTime() > sevenDaysAgo;
        });
      if (!recent) {
        return {
          passed: false,
          violation: 'No plan added to plans/ in the last 7 days',
          remediation: 'Resume plan document workflow (create plans/YYYYMMDD_{task}.md at task start)',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-25',
    category: 'workflow',
    name: 'review-protocol-missing',
    severity: 'major',
    evidence: 'Four Eyes Principle / IEEE software peer review standard',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const paths = [
        join(ctx.target, 'rules', 'review-protocol.md'),
      ];
      if (ctx.workspace) {
        paths.push(join(ctx.workspace, '.claude', 'rules', 'review-protocol.md'));
      }
      if (paths.some(p => existsSync(p))) return { passed: true };
      return {
        passed: false,
        violation: 'review-protocol.md not found',
        remediation: 'Document the implementer ≠ reviewer rule and other review policies',
      };
    },
  },
];
