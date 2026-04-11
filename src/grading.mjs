// grading.mjs - Grade calculation and quick wins generation
//
// Decision: Hybrid grading = pass rate + critical-triggered demotion (max 3).
// The final grade never falls below E. LLM is never used; same input → same output.

/**
 * Calculate grade from indicator results.
 *
 * @param {Array<{passed: boolean, severity: string}>} results
 * @returns {{base: string, final: string, demotedBy: number, passRate: number,
 *            passed: number, total: number, criticals: number}}
 */
export function calcGrade(results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const criticals = results.filter(r => !r.passed && r.severity === 'critical').length;
  const order = ['S', 'A', 'B', 'C', 'D', 'E'];

  // Guard against total=0 (no indicators → treat as E)
  if (total === 0) {
    return { base: 'E', final: 'E', demotedBy: 0, passRate: 0, passed, total, criticals };
  }

  const rate = passed / total;
  let base;
  if (rate >= 0.90) base = 'S';
  else if (rate >= 0.75) base = 'A';
  else if (rate >= 0.60) base = 'B';
  else if (rate >= 0.45) base = 'C';
  else if (rate >= 0.30) base = 'D';
  else base = 'E';

  const demotion = Math.min(criticals, 3);
  const finalIdx = Math.min(order.indexOf(base) + demotion, order.length - 1);

  return {
    base,
    final: order[finalIdx],
    demotedBy: demotion,
    passRate: rate,
    passed,
    total,
    criticals,
  };
}

/**
 * Generate prioritized Quick Wins list.
 *
 * @param {Array} results
 * @param {number} top
 * @returns {Array}
 */
export function quickWins(results, top = 5) {
  const rank = { critical: 0, major: 1, minor: 2 };
  return results
    .filter(r => !r.passed)
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, top);
}
