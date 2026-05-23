// memory.mjs - Memory indicators (IND-17 to IND-19, IND-30, IND-32, IND-33)

import { existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { safeRead, safeList, findMemoryMd, findLessonsDir } from '../utils.mjs';

// ---------------------------------------------------------------------------
// Helpers used by v0.4 memory indicators
// ---------------------------------------------------------------------------

/** Sum the line counts of every *.md file in `dir` (non-recursive). */
function sumLinesInDir(dir) {
  if (!existsSync(dir)) return null;
  let total = 0;
  for (const ent of safeList(dir)) {
    if (!ent.isFile() || !ent.name.endsWith('.md')) continue;
    const c = safeRead(join(dir, ent.name));
    if (c) total += c.split('\n').length;
  }
  return total;
}

/** Locate a brain/RESOLVER.md candidate under target or workspace/memory/. */
function findBrainResolver(ctx) {
  const candidates = [
    join(ctx.target, 'memory', 'brain', 'RESOLVER.md'),
    join(ctx.target, 'brain', 'RESOLVER.md'),
  ];
  if (ctx.workspace) {
    candidates.push(join(ctx.workspace, 'memory', 'brain', 'RESOLVER.md'));
  }
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

/** Locate the rules/ directory (workspace .claude/rules or target/rules). */
function findRulesDir(ctx) {
  const candidates = [
    join(ctx.target, 'rules'),
  ];
  if (ctx.workspace) {
    candidates.push(join(ctx.workspace, '.claude', 'rules'));
  }
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export const memoryIndicators = [
  {
    id: 'IND-17',
    category: 'memory',
    name: 'memory-md-bloat',
    severity: 'major',
    evidence: 'Context window efficiency (KV-cache friendly)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const mem = findMemoryMd(ctx.target);
      if (!mem) return { passed: true };
      const content = safeRead(mem);
      if (!content) return { passed: true };
      const lines = content.split('\n').length;
      if (lines > 200) {
        return {
          passed: false,
          violation: `${lines} lines in MEMORY.md (>200)`,
          location: mem,
          remediation: 'Split details into separate files and reference from MEMORY.md',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-18',
    category: 'memory',
    name: 'lesson-scattered',
    severity: 'minor',
    evidence: 'Knowledge accumulation best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const lessonsDir = findLessonsDir(ctx.target);
      if (!lessonsDir) return { passed: true, note: 'lessons/ not found' };
      const files = safeList(lessonsDir).filter(e => e.isFile() && e.name.endsWith('.md'));
      const topics = {};
      for (const f of files) {
        const topic = f.name.replace(/\.md$/, '').replace(/[-_]\d+$/, '');
        topics[topic] = (topics[topic] || 0) + 1;
      }
      const scattered = Object.entries(topics).filter(([, n]) => n >= 5);
      if (scattered.length > 0) {
        return {
          passed: false,
          violation: `Lessons scattered: ${scattered.map(([t, n]) => `${t}×${n}`).join(', ')}`,
          remediation: 'Consolidate same-topic lessons into a single file',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-19',
    category: 'memory',
    name: 'memory-broken-pointers',
    severity: 'minor',
    evidence: 'Documentation integrity',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const mem = findMemoryMd(ctx.target);
      if (!mem) return { passed: true };
      const content = safeRead(mem);
      if (!content) return { passed: true };
      const memDir = dirname(mem);
      const pointers = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m => m[1]);
      const broken = [];
      for (const p of pointers) {
        if (p.startsWith('http') || p.startsWith('#')) continue;
        if (!existsSync(resolve(memDir, p))) broken.push(p);
      }
      if (broken.length > 0) {
        return {
          passed: false,
          violation: `${broken.length} broken pointer(s): ${broken.slice(0, 3).join(', ')}`,
          location: mem,
          remediation: 'Create the target files or remove the broken references from MEMORY.md',
        };
      }
      return { passed: true };
    },
  },

  // -------------------------------------------------------------------------
  // v0.4 indicators (IND-30, IND-32, IND-33)
  // Source: designs/20260523_doctor-v0.4-roadmap.md
  // -------------------------------------------------------------------------

  {
    id: 'IND-30',
    category: 'memory',
    name: 'brain-resolver-iron-law-weak',
    severity: 'minor',
    evidence: 'brain Iron Law (memory/brain/RESOLVER.md / rules/brain-ops.md)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const resolver = findBrainResolver(ctx);
      if (!resolver) return { passed: true, note: 'brain/RESOLVER.md not found (brain not adopted)' };
      const content = safeRead(resolver);
      if (!content) return { passed: true };
      const keywords = ['fabrication', 'bias[- ]?check', 'source[- ]?attribution', 'Iron[- ]?Law', 'Compiled\\s+Truth', 'Timeline'];
      let hits = 0;
      for (const kw of keywords) {
        if (new RegExp(kw, 'i').test(content)) hits++;
      }
      const minHits = 4;
      if (hits >= minHits) return { passed: true };
      return {
        passed: false,
        violation: `brain/RESOLVER.md mentions only ${hits}/${keywords.length} Iron Law keywords (expected >=${minHits})`,
        location: resolver,
        remediation: 'Strengthen RESOLVER.md to cover Iron Law: fabrication prohibition, bias-check, source attribution, Compiled Truth + Timeline structure.',
      };
    },
  },

  {
    id: 'IND-32',
    category: 'memory',
    name: 'lessons-bloat',
    severity: 'minor',
    evidence: 'lessons hygiene (MEMORY.md health_check, kaizen rounds)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const lessonsDir = findLessonsDir(ctx.target) || (ctx.workspace ? findLessonsDir(ctx.workspace) : null);
      if (!lessonsDir) return { passed: true, note: 'lessons/ not found' };
      const total = sumLinesInDir(lessonsDir);
      if (total === null) return { passed: true };
      if (total < 500) return { passed: true };
      let severity;
      if (total >= 2000) severity = 'critical';
      else if (total >= 1000) severity = 'major';
      else severity = 'minor';
      return {
        passed: false,
        severity,
        violation: `lessons/ total ${total} lines (warn>=500, major>=1000, critical>=2000)`,
        location: lessonsDir,
        remediation: 'Run /kaizen or move archived lessons under lessons/_archive/. Consolidate same-topic lessons.',
      };
    },
  },

  {
    id: 'IND-33',
    category: 'memory',
    name: 'rules-bloat',
    severity: 'minor',
    evidence: 'KV-cache efficiency (rules/config-management.md §定量化指標)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const rulesDir = findRulesDir(ctx);
      if (!rulesDir) return { passed: true, note: 'rules/ not found' };
      const total = sumLinesInDir(rulesDir);
      if (total === null) return { passed: true };
      if (total < 1500) return { passed: true };
      const severity = total >= 2500 ? 'major' : 'minor';
      return {
        passed: false,
        severity,
        violation: `rules/ total ${total} lines (warn>=1500, major>=2500)`,
        location: rulesDir,
        remediation: 'Move large rules files to rules-ondemand/ and replace originals with pointer files (KV-cache hit rate).',
      };
    },
  },
];
