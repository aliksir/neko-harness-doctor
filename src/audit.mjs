// audit.mjs - neko-harness-doctor main entry point
//
// Diagnoses Claude Code harness against 25 anti-pattern indicators.
// Read-only: never writes files. Fix application is delegated to Claude Code.

import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

import { INDICATORS, CATEGORY_ORDER } from './indicators/index.mjs';
import { calcGrade, quickWins } from './grading.mjs';
import { generateProposals } from './fix-strategies.mjs';
import { safeRead, parseJSON, interp } from './utils.mjs';

// ===========================================================================
// CLI args
// ===========================================================================

function parseArgs(argv) {
  const args = {
    target: join(homedir(), '.claude'),
    workspace: process.env.NEKO_HARNESS_WORKSPACE || process.cwd(),
    format: 'markdown',
    category: null,
    severity: 'minor',
    top: 5,
    fixMode: 'off',
    lang: 'ja',
    quiet: false,
    help: false,
    skipExternal: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--skip-external') args.skipExternal = true;
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--workspace') args.workspace = argv[++i];
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--category') args.category = argv[++i];
    else if (a === '--severity') args.severity = argv[++i];
    else if (a === '--top') args.top = parseInt(argv[++i], 10);
    else if (a === '--fix-mode') args.fixMode = argv[++i];
    else if (a === '--lang') args.lang = argv[++i];
  }
  return args;
}

// ===========================================================================
// i18n loader (independent of utils.mjs to avoid URL quirks)
// ===========================================================================

function loadI18n(lang) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const path = join(__dirname, 'i18n', `${lang}.json`);
  const content = safeRead(path);
  const msgs = parseJSON(content);
  if (msgs) return msgs;
  // Fallback to ja
  if (lang !== 'ja') {
    const jaPath = join(__dirname, 'i18n', 'ja.json');
    return parseJSON(safeRead(jaPath)) || {};
  }
  return {};
}

// ===========================================================================
// Run audit
// ===========================================================================

function runAudit(opts) {
  const ctx = {
    target: opts.target,
    workspace: opts.workspace,
    skipExternal: opts.skipExternal,
  };
  const results = [];
  const severityRank = { critical: 0, major: 1, minor: 2 };
  const minRank = severityRank[opts.severity] ?? 2;

  for (const ind of INDICATORS) {
    if (opts.category && ind.category !== opts.category) continue;
    const result = {
      id: ind.id,
      category: ind.category,
      name: ind.name,
      evidence: ind.evidence,
      autoFixable: ind.autoFixable || false,
    };
    try {
      const r = ind.check(ctx);
      result.passed = r.passed;
      result.severity = r.severity || ind.severity;
      result.violation = r.violation || null;
      result.location = r.location || null;
      result.remediation = r.remediation || null;
      result.note = r.note || null;
    } catch (e) {
      result.passed = true;
      result.severity = ind.severity || 'minor';
      result.error = e.message;
    }
    if (!result.passed && severityRank[result.severity] > minRank) continue;
    results.push(result);
  }
  return results;
}

// ===========================================================================
// Output rendering
// ===========================================================================

function renderMarkdown(grade, results, qw, proposals, opts, msgs) {
  const lines = [];
  const g = msgs.grade || {};
  const cs = msgs.categoryScore || {};
  const vs = msgs.violations || {};
  const qwSection = msgs.quickWins || {};

  lines.push(`# ${g.title || 'neko-harness-doctor'}`);
  lines.push('');
  lines.push(`- **${g.target || 'Target'}**: ${opts.target}`);
  const gradeStr = grade.demotedBy > 0
    ? `${grade.final} (${interp(g.demoted || '{base} -> {demotion}', { base: grade.base, criticals: grade.criticals, demotion: grade.demotedBy })})`
    : grade.final;
  lines.push(`- **${g.gradeLabel || 'Grade'}**: ${gradeStr}`);
  lines.push(`- **${g.passRate || 'Pass Rate'}**: ${grade.passed}/${grade.total} (${(grade.passRate * 100).toFixed(1)}%)`);
  lines.push(`- **${g.criticals || 'Criticals'}**: ${grade.criticals}`);
  lines.push(`- **${g.executedAt || 'Executed At'}**: ${new Date().toISOString()}`);
  lines.push('');

  // Category score
  lines.push(`## ${cs.title || 'Category Scores'}`);
  lines.push('');
  const headers = cs.headers || ['Category', 'PASS/Indicators', 'Critical', 'Major', 'Minor'];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const cat of CATEGORY_ORDER) {
    const rs = results.filter(r => r.category === cat);
    const p = rs.filter(r => r.passed).length;
    const c = rs.filter(r => !r.passed && r.severity === 'critical').length;
    const mj = rs.filter(r => !r.passed && r.severity === 'major').length;
    const mn = rs.filter(r => !r.passed && r.severity === 'minor').length;
    const name = (cs.names && cs.names[cat]) || cat;
    lines.push(`| ${name} | ${p}/${rs.length} | ${c} | ${mj} | ${mn} |`);
  }
  lines.push('');

  // Violations
  const violations = results.filter(r => !r.passed);
  lines.push(`## ${vs.title || 'Violations'}`);
  lines.push('');
  if (violations.length === 0) {
    lines.push(vs.none || 'No violations. All indicators pass.');
    lines.push('');
  } else {
    const fields = vs.fields || {};
    for (const v of violations) {
      lines.push(`### [${v.severity.toUpperCase()}] ${v.id}: ${v.name}`);
      if (v.location) lines.push(`- **${fields.location || 'Location'}**: ${v.location}`);
      lines.push(`- **${fields.violation || 'Violation'}**: ${v.violation}`);
      lines.push(`- **${fields.evidence || 'Evidence'}**: ${v.evidence}`);
      if (v.remediation) lines.push(`- **${fields.remediation || 'Remediation'}**: ${v.remediation}`);
      const fixLabel = v.autoFixable
        ? (vs.autoFixableTrue || 'Yes')
        : (vs.autoFixableFalse || 'Manual only');
      lines.push(`- **${fields.autoFixable || 'Auto-fixable'}**: ${fixLabel}`);
      lines.push('');
    }
  }

  // Quick Wins
  if (qw.length > 0) {
    lines.push(`## ${qwSection.title || 'Quick Wins'}`);
    lines.push('');
    for (let i = 0; i < qw.length; i++) {
      const w = qw[i];
      lines.push(`${i + 1}. **[${w.severity.toUpperCase()}]** ${w.id} ${w.name} — ${w.remediation || qwSection.suggest || 'Recommended fix'}`);
    }
    lines.push('');
  }

  // Fix proposals (if fix-mode=propose)
  if (opts.fixMode === 'propose' && proposals && proposals.length > 0) {
    const fp = msgs.fixProposals || {};
    lines.push(`## ${fp.title || 'Fix Proposals'}`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(proposals, null, 2));
    lines.push('```');
  }

  return lines.join('\n');
}

function renderJSON(grade, results, qw, proposals, opts) {
  const out = {
    target: opts.target,
    workspace: opts.workspace,
    lang: opts.lang,
    grade,
    categories: Object.fromEntries(
      CATEGORY_ORDER.map(cat => {
        const rs = results.filter(r => r.category === cat);
        return [cat, {
          passed: rs.filter(r => r.passed).length,
          total: rs.length,
          criticals: rs.filter(r => !r.passed && r.severity === 'critical').length,
        }];
      })
    ),
    violations: results.filter(r => !r.passed),
    quickWins: qw,
    executedAt: new Date().toISOString(),
  };
  if (opts.fixMode === 'propose') out.fixProposals = proposals;
  return JSON.stringify(out, null, 2);
}

// ===========================================================================
// Main (only runs when invoked directly, not on import)
// ===========================================================================

// Guard against CLI auto-run when imported as a library.
// `import('@aliksir/neko-harness-doctor')` should not execute the CLI.
const __mainUrl = fileURLToPath(import.meta.url);
const __entryArg = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1].replace(/\\/g, '/')}`)) : null;
// Looser check: only run main block when argv[1] matches this file's basename (robust across shebang wrappers)
const isMain = process.argv[1] && (
  process.argv[1] === __mainUrl ||
  process.argv[1].endsWith('audit.mjs') ||
  process.argv[1].endsWith('neko-harness-doctor')
);

if (!isMain) {
  // Library mode: do not execute CLI
  // Export nothing by design; consumers should import specific modules directly
} else {

const args = parseArgs(process.argv);
const msgs = loadI18n(args.lang);

if (args.help) {
  console.log((msgs.cli && msgs.cli.usage) || 'Usage: node src/audit.mjs [options]');
  process.exit(0);
}

if (!existsSync(args.target)) {
  const tmpl = (msgs.errors && msgs.errors.targetNotFound) || 'Error: target not found: {target}';
  console.error(interp(tmpl, { target: args.target }));
  process.exit(1);
}

try {
  const results = runAudit(args);
  const grade = calcGrade(results);
  const qw = quickWins(results, args.top);
  let proposals = null;
  if (args.fixMode === 'propose') {
    const ctx = { target: args.target, workspace: args.workspace, skipExternal: args.skipExternal };
    proposals = generateProposals(results, INDICATORS, ctx);
  }
  const output = args.format === 'json'
    ? renderJSON(grade, results, qw, proposals, args)
    : renderMarkdown(grade, results, qw, proposals, args, msgs);
  console.log(output);
  process.exit(0);
} catch (e) {
  const tmpl = (msgs.errors && msgs.errors.internalError) || 'Internal error: {message}';
  console.error(interp(tmpl, { message: e.message }));
  console.error(e.stack);
  process.exit(2);
}

} // end isMain guard
