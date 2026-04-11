// skills.mjs - Skills indicators (IND-13 to IND-16)

import { existsSync } from 'fs';
import { join } from 'path';
import { DESC_MIN_LEN, safeRead, safeList, parseFrontmatter, isExternalSkill } from '../utils.mjs';

/**
 * Iterate skill directories and yield { dir, mdPath, content, fm } records.
 * Respects ctx.skipExternal to exclude community/upstream skills.
 */
function* iterSkills(ctx) {
  const skillDir = join(ctx.target, 'skills');
  if (!existsSync(skillDir)) return;
  for (const ent of safeList(skillDir)) {
    if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
    const mdPath = join(skillDir, ent.name, 'SKILL.md');
    if (!existsSync(mdPath)) continue;
    const content = safeRead(mdPath);
    const fm = parseFrontmatter(content);
    if (ctx.skipExternal && isExternalSkill(fm, content)) continue;
    yield { dir: ent.name, mdPath, content, fm };
  }
}

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
      for (const s of iterSkills(ctx)) {
        if (!s.fm) continue;
        const desc = s.fm.description || '';
        if (desc.length < DESC_MIN_LEN) bad.push(s.dir);
      }
      if (bad.length > 5) {
        return {
          passed: false,
          violation: `${bad.length} skill(s) have description < ${DESC_MIN_LEN} chars: ${bad.slice(0, 5).join(', ')}...`,
          remediation: 'Include 6 elements (purpose/args/return/side-effects/prerequisites/exceptions) in each description. Use --skip-external to exclude upstream-managed skills.',
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
      for (const s of iterSkills(ctx)) {
        if (!s.content) continue;
        if (/use when needed|general purpose/i.test(s.content) && !/trigger|\/[a-z-]+/i.test(s.content)) {
          bad.push(s.dir);
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
      for (const s of iterSkills(ctx)) {
        if (!s.fm) continue;
        if (!s.fm.risk) bad.push(s.dir);
      }
      if (bad.length > 10) {
        return {
          passed: false,
          violation: `${bad.length} skill(s) have no risk field`,
          remediation: 'Add "risk: low|medium|high" to each SKILL.md frontmatter. Use --skip-external to exclude upstream-managed skills.',
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
      for (const s of iterSkills(ctx)) {
        if (!s.fm) continue;
        if (s.fm.name && s.fm.name !== s.dir) mismatch.push(`${s.dir} (name: ${s.fm.name})`);
        if (s.fm.name) {
          if (nameToDir[s.fm.name]) nameToDir[s.fm.name].push(s.dir);
          else nameToDir[s.fm.name] = [s.dir];
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
          remediation: 'Align frontmatter `name:` with directory name. Use --skip-external to exclude upstream skills.',
        };
      }
      return { passed: true };
    },
  },
];
