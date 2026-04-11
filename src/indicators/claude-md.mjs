// claude-md.mjs - CLAUDE.md structure indicators (IND-01 to IND-05)

import { basename } from 'path';
import {
  VOLATILE_RE, CRITICAL_HEADING_RE,
  safeRead, findClaudeMd,
} from '../utils.mjs';

export const claudeMdIndicators = [
  {
    id: 'IND-01',
    category: 'claude-md',
    name: 'claude-md-size-bloat',
    severityDynamic: true,
    evidence: 'Anthropic prompt caching best practice (prompt caching guide)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const claudemd = findClaudeMd(ctx.target, ctx.workspace);
      if (!claudemd) return { passed: true, severity: 'minor', note: 'CLAUDE.md not found' };
      const content = safeRead(claudemd);
      if (!content) return { passed: true, severity: 'minor' };
      const lines = content.split('\n').length;
      let severity = null;
      if (lines > 500) severity = 'critical';
      else if (lines > 300) severity = 'major';
      else if (lines > 200) severity = 'minor';
      return {
        passed: severity === null,
        severity: severity || 'minor',
        violation: severity
          ? `${lines} lines in ${basename(claudemd)} (> ${
              severity === 'critical' ? 500 : severity === 'major' ? 300 : 200
            })`
          : null,
        location: claudemd,
        remediation: 'Split detailed rules into separate files, append-only for volatile info, ~200 lines recommended',
      };
    },
  },

  {
    id: 'IND-02',
    category: 'claude-md',
    name: 'prefix-instability',
    severity: 'major',
    evidence: 'Anthropic prompt caching - stable prefix principle',
    autoFixable: true,
    fixStrategy: 'move-volatile-to-tail',
    check(ctx) {
      const claudemd = findClaudeMd(ctx.target, ctx.workspace);
      if (!claudemd) return { passed: true };
      const content = safeRead(claudemd);
      if (!content) return { passed: true };
      const head100 = content.split('\n').slice(0, 100).join('\n');
      if (VOLATILE_RE.test(head100)) {
        return {
          passed: false,
          violation: 'Volatile element (date/version/session) detected in top 100 lines',
          location: claudemd,
          remediation: 'Move volatile elements to the tail of CLAUDE.md to preserve prefix stability',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-03',
    category: 'claude-md',
    name: 'critical-rules-not-in-first-third',
    severity: 'critical',
    evidence: 'Liu et al. 2023 "Lost in the Middle" (arXiv:2307.03172)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const claudemd = findClaudeMd(ctx.target, ctx.workspace);
      if (!claudemd) return { passed: true };
      const content = safeRead(claudemd);
      if (!content) return { passed: true };
      const lines = content.split('\n');
      const total = lines.length;
      let minPos = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^#{1,4}\s/.test(line) && CRITICAL_HEADING_RE.test(line)) {
          const pos = i / total;
          if (minPos === null || pos < minPos) minPos = pos;
        }
      }
      if (minPos === null) {
        return {
          passed: false,
          violation: 'No critical-rule heading detected in CLAUDE.md',
          location: claudemd,
          remediation: 'Declare critical rules (destructive ops, forbidden actions) explicitly in the first third',
        };
      }
      if (minPos > 0.3) {
        return {
          passed: false,
          violation: `Earliest critical-rule heading at position=${(minPos * 100).toFixed(1)}% (outside first third)`,
          location: claudemd,
          remediation: 'Move critical rules to the first third (position 0 to 0.3) to avoid Lost-in-the-Middle',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-04',
    category: 'claude-md',
    name: 'duplicate-sections',
    severity: 'minor',
    evidence: 'General documentation best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const claudemd = findClaudeMd(ctx.target, ctx.workspace);
      if (!claudemd) return { passed: true };
      const content = safeRead(claudemd);
      if (!content) return { passed: true };
      const headings = {};
      for (const line of content.split('\n')) {
        const m = line.match(/^#{2,4}\s+(.+)$/);
        if (m) {
          const key = m[1].trim().toLowerCase();
          headings[key] = (headings[key] || 0) + 1;
        }
      }
      const dups = Object.entries(headings).filter(([, n]) => n > 1);
      if (dups.length > 0) {
        return {
          passed: false,
          violation: `${dups.length} duplicate heading(s): ${dups.slice(0, 3).map(([k]) => k).join(', ')}`,
          location: claudemd,
          remediation: 'Merge duplicate sections or rename to distinct titles',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-05',
    category: 'claude-md',
    name: 'volatile-elements-not-at-tail',
    severity: 'major',
    evidence: 'Anthropic prompt caching - tail-only updates principle',
    autoFixable: true,
    fixStrategy: 'move-volatile-to-tail',
    check(ctx) {
      const claudemd = findClaudeMd(ctx.target, ctx.workspace);
      if (!claudemd) return { passed: true };
      const content = safeRead(claudemd);
      if (!content) return { passed: true };
      const lines = content.split('\n');
      const total = lines.length;
      let minPos = null;
      for (let i = 0; i < lines.length; i++) {
        if (VOLATILE_RE.test(lines[i])) {
          const pos = i / total;
          if (minPos === null || pos < minPos) minPos = pos;
        }
      }
      if (minPos === null) return { passed: true };
      if (minPos < 0.9) {
        return {
          passed: false,
          violation: `Volatile element at position=${(minPos * 100).toFixed(1)}% (outside tail 10%)`,
          location: claudemd,
          remediation: 'Consolidate volatile elements (dates, versions, session counters) at the tail of CLAUDE.md',
        };
      }
      return { passed: true };
    },
  },
];
