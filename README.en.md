# neko-harness-doctor

> Free open-source CLI that audits your Claude Code harness against 25 anti-pattern indicators

[日本語 README](./README.md) | English

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue.svg)

## What is this

Diagnose your Claude Code harness (`CLAUDE.md` / `settings.json` / `.mcp.json` / `hooks/` / `skills/` / `memory/` / `MCP` / `workflow`) against **25 anti-pattern indicators**. Outputs an **S–E overall grade**, per-category scores, violation list with evidence, and **prioritized Quick Wins**.

## Why

Claude Code output quality often varies between sessions. Many causes are **structural harness defects**:

- Bloated `CLAUDE.md` degrades KV-Cache efficiency
- Critical rules buried mid-document get missed (Lost in the Middle)
- `bypassPermissions` silently enabled introduces dangerous operations
- Short Skill descriptions cause wrong skill selection
- MCP servers not pinned to specific versions

Manually checking each of these is tedious. This tool does all 25 checks in 5–15 seconds.

## Features

- **25 anti-pattern indicators** across 7 categories
- **S–E grading** with hybrid logic (pass rate + critical-triggered demotion, max 3)
- **Quick Wins** prioritized by severity
- **Interactive fix flow** via `--fix-mode propose` (outputs JSON proposals; Claude Code applies via Edit tool with user approval)
- **Read-only**: CLI never modifies target files
- **Deterministic**: No LLM, grep/AST/JSON-parse only
- **i18n**: Japanese default, `--lang en` for English
- **Zero runtime dependencies**: Node.js 18+ stdlib only

## Install

### npm (recommended)

```bash
npm install -g @aliksir/neko-harness-doctor
```

*Note: npm publish is pending. Use GitHub clone for now.*

### GitHub clone

```bash
git clone https://github.com/aliksir/neko-harness-doctor.git
cd neko-harness-doctor
node bin/neko-harness-doctor --help
```

## Quick start

```bash
# Audit ~/.claude/
neko-harness-doctor

# Specific directory
neko-harness-doctor --target ~/.claude --workspace ~/work/myproject

# Category filter
neko-harness-doctor --category claude-md

# JSON output
neko-harness-doctor --format json

# English output (default is Japanese)
neko-harness-doctor --lang en

# Propose-mode (use from Claude Code for interactive fixes)
neko-harness-doctor --fix-mode propose --format json --lang en
```

## Sample output

```markdown
# neko-harness-doctor diagnosis result

- **Target**: ~/.claude
- **Overall Grade**: C (Base B demoted by 1 level(s) due to 1 critical violation(s))
- **Pass Rate**: 17/25 (68.0%)
- **Critical Violations**: 1

## Category Scores

| Category | PASS/Indicators | Critical | Major | Minor |
|---|---|---|---|---|
| CLAUDE.md Structure | 2/5 | 1 | 1 | 1 |
| settings.json | 4/4 | 0 | 0 | 0 |
| Hooks | 1/3 | 0 | 2 | 0 |
...
```

## Interactive fix flow

`--fix-mode propose` outputs repair proposals as JSON. Claude Code reads this, confirms with the user, and then applies changes via its `Edit` tool:

```json
[
  {
    "indicator": "IND-06",
    "autoFixable": true,
    "severity": "critical",
    "target": "/path/to/settings.json",
    "description": "\"bypassPermissions\": true is set",
    "evidence": "Principle of least privilege",
    "diff": { "before": "...", "after": "..." }
  }
]
```

**Principle**: The CLI only proposes. Application happens transparently via Claude Code's Edit tool after user approval.

## 25 indicators

| Category | Count | Examples |
|---|---|---|
| CLAUDE.md structure | 5 | Size bloat / Prefix instability / Lost in the Middle / Duplicate sections / Volatile tail placement |
| settings.json | 4 | bypassPermissions / auto-accept all / Overly broad permissions / Hooks unconfigured |
| Hooks | 3 | Missing error handling / Side effects / PostToolUse overuse |
| Skills | 4 | Insufficient description / Ambiguous trigger / No risk field / Namespace collision |
| Memory | 3 | MEMORY.md bloat / Lesson scattering / Broken pointers |
| MCP | 3 | Version not pinned / Description insufficient / Supply chain unverified |
| Workflow | 3 | No gate definitions / plans/ unused / No review protocol |

See [docs/indicators.md](./docs/indicators.md) for details.

## Grading

Base grade from pass rate; each critical demotes 1 level (max 3, floor at E).

| Grade | Pass Rate |
|---|---|
| S | ≥ 90% |
| A | ≥ 75% |
| B | ≥ 60% |
| C | ≥ 45% |
| D | ≥ 30% |
| E | < 30% |

See [docs/grading.md](./docs/grading.md) for full spec.

## Configuration

`~/.neko-harness-doctor/config.json` lets you extend publisher allowlists, etc.:

```json
{
  "mcp": {
    "publisherAllowlist": [
      "@anthropic-ai",
      "@my-org",
      "@trusted-vendor"
    ]
  }
}
```

See [docs/configuration.md](./docs/configuration.md) for details.

## FAQ

**Q: Is this a copy of masa_wunder's `/review-harness`?**
A: No. We did not subscribe to the paid article. The 25 indicators are independently derived from Anthropic official docs, OpenSSF, IEEE standards, and similar public best practices.

**Q: Does it call any LLM?**
A: No. All judgments are grep / AST / JSON-parse based — fully deterministic.

**Q: Will it modify my files?**
A: **No.** The CLI only proposes fixes (`--fix-mode propose`). Actual changes happen via Claude Code's `Edit` tool after user approval.

**Q: Runtime dependencies?**
A: Zero. Only Node.js 18+ stdlib.

## License

[MIT](./LICENSE)

## Acknowledgments

- **masa_wunder** (@masa_wunder) — conceptual inspiration for `/review-harness` (paid article not subscribed; indicators derived independently)
- **Liu et al. 2023** "Lost in the Middle" (arXiv:2307.03172) — basis for IND-03
- **Anthropic Prompt Caching Guide** — basis for IND-01/02/05
- **OpenSSF Secure Supply Chain Best Practices** — basis for IND-20/22
