// skills.mjs - Skills indicators (IND-13 to IND-16)

import { existsSync } from 'fs';
import { join } from 'path';
import { DESC_MIN_LEN, safeRead, safeList, parseFrontmatter } from '../utils.mjs';

export const skillsIndicators = [
  {
    id: 'IND-13',
    category: 'skills',
    name: 'skill-description-insufficient',
    severity: 'major',
    evidence: 'MCP tool description 6-element guideline',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const skillDir = join(ctx.target, 'skills');
      if (!existsSync(skillDir)) return { passed: true, note: 'skills/ not found' };
      const bad = [];
      for (const ent of safeList(skillDir)) {
        if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
        const skillMd = join(skillDir, ent.name, 'SKILL.md');
        if (!existsSync(skillMd)) continue;
        const fm = parseFrontmatter(safeRead(skillMd));
        if (!fm) continue;
        const desc = fm.description || '';
        if (desc.length < DESC_MIN_LEN) bad.push(ent.name);
      }
      if (bad.length > 5) {
        return {
          passed: false,
          violation: `${bad.length} skill(s) have description < ${DESC_MIN_LEN} chars: ${bad.slice(0, 5).join(', ')}...`,
          remediation: 'Include 6 elements (purpose/args/return/side-effects/prerequisites/exceptions) in each description',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-14',
    category: 'skills',
    name: 'skill-trigger-ambiguous',
    severity: 'minor',
    evidence: 'Skill discoverability best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const skillDir = join(ctx.target, 'skills');
      if (!existsSync(skillDir)) return { passed: true };
      const bad = [];
      for (const ent of safeList(skillDir)) {
        if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
        const skillMd = join(skillDir, ent.name, 'SKILL.md');
        if (!existsSync(skillMd)) continue;
        const content = safeRead(skillMd);
        if (!content) continue;
        if (/use when needed|general purpose/i.test(content) && !/trigger|\/[a-z-]+/i.test(content)) {
          bad.push(ent.name);
        }
      }
      if (bad.length > 3) {
        return {
          passed: false,
          violation: `${bad.length} skill(s) have ambiguous triggers`,
          remediation: 'Specify concrete trigger keywords or slash commands in each SKILL.md',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-15',
    category: 'skills',
    name: 'skill-risk-not-set',
    severity: 'minor',
    evidence: 'Security classification best practice',
    autoFixable: true,
    fixStrategy: 'add-default-risk',
    check(ctx) {
      const skillDir = join(ctx.target, 'skills');
      if (!existsSync(skillDir)) return { passed: true };
      const bad = [];
      for (const ent of safeList(skillDir)) {
        if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
        const skillMd = join(skillDir, ent.name, 'SKILL.md');
        if (!existsSync(skillMd)) continue;
        const fm = parseFrontmatter(safeRead(skillMd));
        if (!fm) continue;
        if (!fm.risk) bad.push(ent.name);
      }
      if (bad.length > 10) {
        return {
          passed: false,
          violation: `${bad.length} skill(s) have no risk field`,
          remediation: 'Add "risk: low|medium|high" to each SKILL.md frontmatter',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-16',
    category: 'skills',
    name: 'skill-namespace-collision',
    severity: 'major',
    evidence: 'Namespace hygiene',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const skillDir = join(ctx.target, 'skills');
      if (!existsSync(skillDir)) return { passed: true };
      const nameToDir = {};
      const mismatch = [];
      for (const ent of safeList(skillDir)) {
        if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
        const skillMd = join(skillDir, ent.name, 'SKILL.md');
        if (!existsSync(skillMd)) continue;
        const fm = parseFrontmatter(safeRead(skillMd));
        if (!fm) continue;
        if (fm.name && fm.name !== ent.name) mismatch.push(`${ent.name} (name: ${fm.name})`);
        if (fm.name) {
          if (nameToDir[fm.name]) nameToDir[fm.name].push(ent.name);
          else nameToDir[fm.name] = [ent.name];
        }
      }
      const collisions = Object.entries(nameToDir).filter(([, arr]) => arr.length > 1);
      if (collisions.length > 0 || mismatch.length > 0) {
        const parts = [];
        if (collisions.length > 0) parts.push(`collisions=${collisions.length}: ${collisions.slice(0, 3).map(([k]) => k).join(', ')}`);
        if (mismatch.length > 0) parts.push(`mismatch=${mismatch.length}: ${mismatch.slice(0, 3).join(', ')}`);
        return {
          passed: false,
          violation: `Namespace collision: ${parts.join(' | ')}`,
          remediation: 'Align frontmatter `name:` with directory name',
        };
      }
      return { passed: true };
    },
  },
];
