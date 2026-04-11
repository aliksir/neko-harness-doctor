# Grading specification

**Source of truth**: `src/grading.mjs` — `calcGrade()` and `quickWins()`.

---

## Base grade (from pass rate)

| Grade | Pass Rate |
|---|---|
| **S** | ≥ 90% |
| **A** | ≥ 75% |
| **B** | ≥ 60% |
| **C** | ≥ 45% |
| **D** | ≥ 30% |
| **E** | < 30% |

Pass rate = `passed / total` (total = 25 indicators, or fewer when `--category` is used).

---

## Critical-triggered demotion

Each critical violation demotes the grade by 1 level.

- `demotion = Math.min(criticals, 3)` — maximum 3 levels
- Final grade floors at E (cannot go below)

### Examples

| Base | Criticals | Final |
|---|---|---|
| S | 0 | S |
| S | 1 | A |
| S | 2 | B |
| S | 3 | C |
| S | 4 | C (max 3 levels) |
| B | 1 | C |
| D | 1 | E |
| D | 5 | E (floor) |

---

## Critical count

Critical violations come from:

- **Fixed critical indicators** (3): `IND-03`, `IND-06`, `IND-22`
- **Dynamic critical** (1): `IND-01` when `lines > 500`

Maximum possible criticals = 4. With `Math.min(4, 3)`, maximum demotion = 3.

**Note**: `IND-01` at 300–500 lines counts as major (not critical); 200–300 lines counts as minor.

---

## Test cases (reference)

| Case | PASS | Total | Criticals | Base | Final |
|---|---|---|---|---|---|
| T3-1 | 23 | 25 | 0 | S (92%) | S |
| T3-2 | 20 | 25 | 0 | A (80%) | A |
| T3-3 | 16 | 25 | 0 | B (64%) | B |
| T3-4 | 13 | 25 | 0 | C (52%) | C |
| T3-5 | 9 | 25 | 0 | D (36%) | D |
| T3-6 | 5 | 25 | 0 | E (20%) | E |
| T3-7 | 23 | 25 | 1 | S | A |
| T3-8 | 23 | 25 | 3 | S | C |
| T3-9 | 0 | 25 | 5 | E | E (floor) |

---

## Quick Wins ordering

Violations are sorted by severity and trimmed to top N (default 5, configurable via `--top`).

```
severity_order = { critical: 0, major: 1, minor: 2 }
quickWins = violations
  .sort((a, b) => severity_order[a.severity] - severity_order[b.severity])
  .slice(0, top)
```

Criticals always come first because fixing one raises the final grade by one level.

---

## Edge cases

### Category filter with no indicators

`--category <non-existent>` → `total = 0` → `calcGrade` returns `{ base: 'E', final: 'E', demotedBy: 0, passRate: 0 }` (defensive).

### Severity filter

`--severity critical` excludes lower-severity violations from the results collection. Because the filter happens before grade calculation, `total` reflects only the indicators whose violations (if any) pass the filter. If you want a full 25-indicator baseline with severity filtering only applied to display, skip the `--severity` flag and filter the JSON output externally.

---

## Determinism

Given the same input (complete target state), `calcGrade` always returns the same grade. No LLM is involved, and the `executedAt` field in the output is metadata only — it does not affect the judgment.

This determinism enables:

- CI integration
- Historical comparison
- Reproducible diagnosis
