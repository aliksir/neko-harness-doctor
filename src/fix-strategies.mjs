// fix-strategies.mjs - Generate fix proposals (NOT applications)
//
// IMPORTANT: This module generates PROPOSALS only. The CLI never writes files.
// Application is delegated to Claude Code (via Edit tool, with user approval).
//
// Output format (per violation):
//   {
//     indicator: "IND-06",
//     autoFixable: true,
//     severity: "critical",
//     target: "/path/to/settings.json",
//     description: "...",
//     diff?: { before, after },      // autoFixable=true only
//     manualSteps?: string[]         // autoFixable=false only
//   }

import { safeRead, parseJSON } from './utils.mjs';

/**
 * Generate fix proposals from audit results + indicator definitions.
 * Returns an array of proposals for each non-passing result.
 */
export function generateProposals(results, indicators, ctx) {
  const proposals = [];
  for (const r of results) {
    if (r.passed) continue;
    const ind = indicators.find(i => i.id === r.id);
    if (!ind) continue;
    const proposal = {
      indicator: r.id,
      autoFixable: ind.autoFixable || false,
      fixStrategy: ind.fixStrategy || null,
      severity: r.severity,
      target: r.location || null,
      description: r.violation,
      evidence: r.evidence,
    };
    if (proposal.autoFixable && proposal.fixStrategy) {
      const strategyFn = STRATEGIES[proposal.fixStrategy];
      if (strategyFn) {
        try {
          const diff = strategyFn(r, ctx);
          if (diff) proposal.diff = diff;
        } catch (e) {
          proposal.diff = null;
          proposal.error = `Strategy ${proposal.fixStrategy} failed: ${e.message}`;
        }
      }
    } else {
      proposal.manualSteps = buildManualSteps(r, ind);
    }
    proposals.push(proposal);
  }
  return proposals;
}

// ===========================================================================
// Strategy implementations
// ===========================================================================

const STRATEGIES = {
  'move-volatile-to-tail'(result, ctx) {
    // Propose moving the earliest volatile line to the tail.
    // We don't do the move - we only describe the intent.
    return {
      before: 'Volatile element in the top/middle of CLAUDE.md',
      after: 'Volatile element relocated to the tail (position > 0.9)',
      note: 'Requires manual line movement. Editor should cut the volatile line(s) and append to file end.',
    };
  },

  'remove-bypass-permissions'(result, ctx) {
    const content = safeRead(result.location);
    if (!content) return null;
    const json = parseJSON(content);
    if (!json) return null;
    // Remove bypassPermissions from both top-level and nested
    const before = JSON.stringify(json, null, 2);
    const updated = JSON.parse(JSON.stringify(json));
    delete updated.bypassPermissions;
    if (updated.permissions) delete updated.permissions.bypassPermissions;
    const after = JSON.stringify(updated, null, 2);
    return { before, after };
  },

  'narrow-auto-accept'(result, ctx) {
    const content = safeRead(result.location);
    if (!content) return null;
    const json = parseJSON(content);
    if (!json) return null;
    const before = JSON.stringify(json, null, 2);
    const updated = JSON.parse(JSON.stringify(json));
    if (updated.autoAccept === true || updated.autoAccept === '*') delete updated.autoAccept;
    if (updated.permissions?.allow) {
      updated.permissions.allow = updated.permissions.allow.filter(p => p !== '*');
      if (updated.permissions.allow.length === 0) {
        updated.permissions.allow = ['Read', 'Grep', 'Glob'];
      }
    }
    const after = JSON.stringify(updated, null, 2);
    return { before, after };
  },

  'add-default-risk'(result, ctx) {
    return {
      before: 'SKILL.md frontmatter without `risk:` field',
      after: 'Add `risk: low` to frontmatter (conservative default; review per-skill manually)',
      note: 'This is a bulk fix — consider adjusting risk level per skill after this initial pass.',
    };
  },

  'create-plans-dir'(result, ctx) {
    const path = ctx.workspace ? `${ctx.workspace}/plans` : './plans';
    return {
      before: 'plans/ directory does not exist',
      after: `mkdir ${path}`,
      note: 'Claude Code will create the directory and seed a template plan for the current task.',
    };
  },
};

// ===========================================================================
// Manual-steps generator for non-auto-fixable indicators
// ===========================================================================

function buildManualSteps(result, indicator) {
  const base = result.remediation || indicator.remediation || 'Manual review required';
  const category = indicator.category;
  const steps = [base];
  // Add category-specific guidance
  if (category === 'claude-md') {
    steps.push(`Review ${result.location || 'CLAUDE.md'} and refactor per the remediation guidance.`);
  } else if (category === 'skills') {
    steps.push('Review each flagged skill SKILL.md individually and update descriptions/triggers/risks.');
  } else if (category === 'hooks') {
    steps.push('Open each hook script and add the missing safeguard; test with a dry run before enabling.');
  } else if (category === 'mcp') {
    steps.push('Verify publisher trust and run supply-chain audit (npm view / OSV) before modifying .mcp.json.');
  } else if (category === 'workflow') {
    steps.push('Review the workflow documentation template in docs/ or copy from an existing reference project.');
  }
  return steps;
}
