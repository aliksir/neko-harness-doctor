// workflow.mjs - Workflow indicators (IND-23 to IND-25, IND-27 to IND-29)

import { existsSync } from 'fs';
import { join } from 'path';
import { safeList, safeStat, safeRead } from '../utils.mjs';

// ---------------------------------------------------------------------------
// Helpers used by v0.4 workflow indicators (IND-27/28/29)
// ---------------------------------------------------------------------------

/**
 * List recent plans/*.md files (sorted by mtime desc, capped at N).
 * Skips template files like `_template.md`.
 */
function listRecentPlans(workspace, limit = 10) {
  if (!workspace) return [];
  const plansDir = join(workspace, 'plans');
  if (!existsSync(plansDir)) return [];
  const entries = safeList(plansDir)
    .filter(e => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_'))
    .map(e => {
      const p = join(plansDir, e.name);
      const st = safeStat(p);
      return { path: p, name: e.name, mtime: st ? st.mtime.getTime() : 0 };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return entries;
}

/**
 * List recent reviews/*_kurouto.md files (sorted by mtime desc, capped at N).
 */
function listRecentKuroutoReviews(workspace, limit = 10) {
  if (!workspace) return [];
  const reviewsDir = join(workspace, 'reviews');
  if (!existsSync(reviewsDir)) return [];
  const entries = safeList(reviewsDir)
    .filter(e => e.isFile() && /_kurouto\.md$/i.test(e.name))
    .map(e => {
      const p = join(reviewsDir, e.name);
      const st = safeStat(p);
      return { path: p, name: e.name, mtime: st ? st.mtime.getTime() : 0 };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return entries;
}

/**
 * Detect plan scale tag.
 * Returns 'recon' | 'squad' | 'platoon+' | 'unknown'.
 * Looks at `規模: ...` line or `## 規模` heading content.
 */
function detectPlanScale(content) {
  if (!content) return 'unknown';
  const m = content.match(/規模[:：]\s*([^\n（(]+)/);
  if (!m) return 'unknown';
  const v = m[1].trim();
  if (/偵察|recon/i.test(v)) return 'recon';
  if (/中隊|大隊|platoon|company|battalion/i.test(v)) return 'platoon+';
  if (/小隊|squad/i.test(v)) return 'squad';
  return 'unknown';
}

/**
 * Count rows in the table directly under a given heading.
 * Returns -1 if the heading is missing.
 *
 * Table is assumed to start within ~5 lines after the heading.
 * Rows = lines starting with `|` that are neither the header line
 * nor the separator line (`|---`).
 */
function countTableRowsAfterHeading(content, headingRegex) {
  if (!content) return -1;
  const lines = content.split('\n');
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) { headingIdx = i; break; }
  }
  if (headingIdx < 0) return -1;
  // Skip blank lines and prose, find the first table line
  let tableStart = -1;
  for (let i = headingIdx + 1; i < Math.min(lines.length, headingIdx + 30); i++) {
    if (lines[i].trim().startsWith('|')) { tableStart = i; break; }
    // Stop early if we hit the next heading
    if (/^##?\s/.test(lines[i])) break;
  }
  if (tableStart < 0) return 0;
  let rows = 0;
  for (let i = tableStart; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('|')) break; // table ended
    if (/^\|\s*[-:|\s]+\|\s*$/.test(t)) continue; // separator row
    rows++;
  }
  // Subtract the header row (1)
  return Math.max(0, rows - 1);
}

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

  // -------------------------------------------------------------------------
  // v0.4 indicators (IND-27, IND-28, IND-29)
  // Source: designs/20260523_doctor-v0.4-roadmap.md
  // -------------------------------------------------------------------------

  {
    id: 'IND-27',
    category: 'workflow',
    name: 'pre-mortem-section-missing',
    severity: 'major',
    evidence: 'Pre-Mortem mandatory rule (rules/review-protocol.md §Pre-Mortem 必須化)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const plans = listRecentPlans(ctx.workspace, 10);
      if (plans.length === 0) return { passed: true, note: 'no plans/*.md found' };
      const offenders = [];
      let checked = 0;
      for (const p of plans) {
        const content = safeRead(p.path);
        if (!content) continue;
        const scale = detectPlanScale(content);
        // Recon plans don't require Pre-Mortem
        if (scale === 'recon') continue;
        checked++;
        const rows = countTableRowsAfterHeading(content, /^## Pre-Mortem\s*$/);
        // Expectation: squad >= 3 rows, platoon+ >= 5 rows
        const minRows = scale === 'platoon+' ? 5 : 3;
        if (rows < 0) {
          offenders.push(`${p.name} (missing section)`);
        } else if (rows < minRows) {
          offenders.push(`${p.name} (${rows} rows, expected >=${minRows})`);
        }
      }
      if (checked === 0) return { passed: true, note: 'no non-recon plans in recent 10' };
      if (offenders.length === 0) return { passed: true };
      return {
        passed: false,
        violation: `${offenders.length}/${checked} recent plan(s) missing/short Pre-Mortem: ${offenders.slice(0, 3).join(', ')}`,
        remediation: 'Add a `## Pre-Mortem` section to plans (squad: 3-5 rows, platoon+: 5-7 rows). See rules/review-protocol.md.',
      };
    },
  },

  {
    id: 'IND-28',
    category: 'workflow',
    name: 'small-cls-split-decision-missing',
    severity: 'minor',
    evidence: 'Small CLs philosophy (rules/small-cls-philosophy.md §7)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const plans = listRecentPlans(ctx.workspace, 10);
      if (plans.length === 0) return { passed: true, note: 'no plans/*.md found' };
      const offenders = [];
      let checked = 0;
      for (const p of plans) {
        const content = safeRead(p.path);
        if (!content) continue;
        const scale = detectPlanScale(content);
        // Only platoon+ plans are required to include split-decision section
        if (scale !== 'platoon+') continue;
        checked++;
        if (!/^## 分割判断/m.test(content)) {
          offenders.push(p.name);
        }
      }
      if (checked === 0) return { passed: true, note: 'no platoon+ plans in recent 10' };
      if (offenders.length === 0) return { passed: true };
      return {
        passed: false,
        violation: `${offenders.length}/${checked} platoon+ plan(s) missing '## 分割判断' section: ${offenders.slice(0, 3).join(', ')}`,
        remediation: 'Add `## 分割判断` to platoon+ plans (粒度評価 + 分割案 + 例外運用). See rules/small-cls-philosophy.md §7.',
      };
    },
  },

  {
    id: 'IND-29',
    category: 'workflow',
    name: 'adversarial-2nd-pass-not-recorded',
    severity: 'major',
    evidence: 'Adversarial 2nd-Pass + Evidence Level Ladder (rules/clearwing-patterns.md)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const reviews = listRecentKuroutoReviews(ctx.workspace, 10);
      if (reviews.length === 0) return { passed: true, note: 'no reviews/*_kurouto.md found' };
      const offenders = [];
      let checked = 0;
      for (const r of reviews) {
        const content = safeRead(r.path);
        if (!content) continue;
        checked++;
        const hasAdv = /Adversarial\s+2nd-Pass|Q1[\s\S]{0,500}Q2[\s\S]{0,500}Q3/i.test(content);
        // Match evidence_level with optional markdown decoration (backticks / asterisks)
        // around the ladder name. Example: "evidence_level: `static_check_passed`" or
        // "evidence_level: **production_validated**" or plain "evidence_level: test_passed".
        const hasEvidence = /evidence_level\s*[:：]\s*[`*]*(suspicion|static_check_passed|test_passed|root_cause_explained|integration_verified|production_validated)/i.test(content);
        if (!hasAdv || !hasEvidence) {
          const missing = [];
          if (!hasAdv) missing.push('Adversarial 2nd-Pass');
          if (!hasEvidence) missing.push('evidence_level');
          offenders.push(`${r.name} (missing: ${missing.join(' + ')})`);
        }
      }
      if (checked === 0) return { passed: true };
      // Allow up to 20% non-conforming reviews before flagging.
      // For small batches (checked < 5), even one offender flags — strict mode.
      const threshold = checked >= 5 ? Math.floor(checked * 0.2) : 0;
      if (offenders.length <= threshold) return { passed: true };
      return {
        passed: false,
        violation: `${offenders.length}/${checked} reviews lack Adversarial 2nd-Pass or evidence_level: ${offenders.slice(0, 3).join(', ')}`,
        remediation: 'kurouto-neko reviews must include Q1-Q5 (Adversarial 2nd-Pass) and `evidence_level: <ladder>`. See rules/review-protocol.md §Adversarial Second-Pass.',
      };
    },
  },
];
