// memory.mjs - Memory indicators (IND-17 to IND-19)

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { safeRead, safeList, findMemoryMd, findLessonsDir } from '../utils.mjs';

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
];
