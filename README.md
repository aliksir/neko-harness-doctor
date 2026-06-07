> For the Japanese version, see [README.ja.md](README.ja.md).
> Part of the [neko-HQ](https://github.com/aliksir/neko-hq) ecosystem.

# neko-harness-doctor

> A free, open-source CLI tool that automatically diagnoses your Claude Code harness using 25 anti-pattern indicators.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue.svg)

## What is this?

Automatically diagnoses your Claude Code environment (`CLAUDE.md` / `settings.json` / `.mcp.json` / `hooks/` / `skills/` / `memory/` / `MCP` / `workflow`) against **25 anti-pattern indicators**, outputting an **S-to-E grade** and **prioritized Quick Wins (improvement suggestions)**.

## Why do you need this?

Much of the inconsistency in Claude Code output quality across sessions comes from **structural flaws in harness design**:

- `CLAUDE.md` has grown too large, degrading KV-Cache efficiency
- Important rules are buried in the middle and Claude misses them (Lost in the Middle)
- `bypassPermissions` is enabled, silently allowing dangerous operations
- Skill descriptions are too short for Claude to select correctly
- MCP server versions are not pinned

Checking all of these manually is a huge effort, but this single tool covers everything in 5-15 seconds.

## Features

- **25 Anti-Pattern Indicators**: Cross-cutting diagnosis across 7 categories (CLAUDE.md structure / settings / hooks / skills / memory / MCP / workflow)
- **S-to-E Grade Evaluation**: Hybrid grading (PASS rate + Critical instant-demotion, up to 3 tiers)
- **Quick Wins**: Prioritized improvement suggestions (top 5 by default)
- **Interactive Fix Flow**: `--fix-mode propose` outputs fix proposals as JSON. Claude Code presents them for user approval and applies via the Edit tool -- a fully transparent workflow
- **Read-only**: The CLI itself **never modifies** the target. Fixes are always applied after user approval
- **Deterministic**: No LLM calls -- uses grep / AST / JSON parsing for **deterministic** results
- **i18n**: Japanese by default, switch to English with `--lang en`
- **Zero Dependencies**: Only requires Node.js 18+, ready to run after `npm install`

## Installation

### npm (recommended -- standalone CLI)

```bash
npm install -g @aliksir/neko-harness-doctor
```

### As a Claude Code Plugin

This repository also works as a Claude Code plugin. When enabled as a plugin:

- `bin/neko-harness-doctor` is automatically added to the Bash tool's PATH (callable as a bare command)
- The bundled skill responds to the `/neko-harness-doctor` slash command and natural language triggers like "diagnose my harness"
- Claude can automatically run diagnosis, present Quick Wins, and execute the interactive fix flow

**Marketplace (pending approval)**:

```bash
# Available after approval
claude plugin install neko-harness-doctor
```

**Local testing (pre-approval / building from source)**:

```bash
git clone https://github.com/aliksir/neko-harness-doctor.git
claude --plugin-dir ./neko-harness-doctor
# /neko-harness-doctor becomes available in the session
```

Plugin structure:

```
neko-harness-doctor/
├── .claude-plugin/plugin.json      # Manifest
├── bin/neko-harness-doctor         # Added to PATH when plugin is active
├── skills/neko-harness-doctor/
│   └── SKILL.md                    # Claude auto-trigger + /name shortcut
└── src/                            # 25 indicator logic
```

### GitHub clone (run the raw script)

```bash
git clone https://github.com/aliksir/neko-harness-doctor.git
cd neko-harness-doctor
node bin/neko-harness-doctor --help
```

## Quick Start

```bash
# Diagnose ~/.claude/
neko-harness-doctor

# Diagnose a specific directory
neko-harness-doctor --target ~/.claude --workspace ~/work/myproject

# Filter by category
neko-harness-doctor --category claude-md

# JSON output
neko-harness-doctor --format json

# Switch to English
neko-harness-doctor --lang en

# Fix proposal mode (when called from Claude Code)
neko-harness-doctor --fix-mode propose --format json
```

## Example Output

```markdown
# neko-harness-doctor Diagnosis Report

- **Target**: ~/.claude
- **Overall Grade**: C (base B, demoted 1 tier due to 1 Critical violation)
- **PASS Rate**: 17/25 (68.0%)
- **Critical Violations**: 1
- **Timestamp**: 2026-04-11T21:48:00.000Z

## Scores by Category

| Category | PASS/Total | Critical | Major | Minor |
|---|---|---|---|---|
| CLAUDE.md Structure | 2/5 | 1 | 1 | 1 |
| settings.json | 4/4 | 0 | 0 | 0 |
| Hooks | 1/3 | 0 | 2 | 0 |
| Skills | 1/4 | 0 | 2 | 1 |
| Memory | 3/3 | 0 | 0 | 0 |
| MCP | 3/3 | 0 | 0 | 0 |
| Workflow | 3/3 | 0 | 0 | 0 |

## Detected Issues

### [CRITICAL] IND-03: critical-rules-not-in-first-third
- **Location**: ~/.claude/CLAUDE.md
- **Violation**: Earliest critical-rule heading at position=80.2% (outside first third)
- **Reference**: Liu et al. 2023 "Lost in the Middle" (arXiv:2307.03172)
- **Remediation**: Move critical rules to the first third (position 0 to 0.3) to avoid Lost-in-the-Middle
- **Auto-fixable**: Manual only

## Quick Wins (Prioritized)

1. **[CRITICAL]** IND-03 critical-rules-not-in-first-third — Move critical rules to the first third
2. **[MAJOR]** IND-05 volatile-elements-not-at-tail — Consolidate volatile elements at the tail
3. **[MAJOR]** IND-10 hook-missing-error-handling — Add try/catch to all hook scripts
...
```

## Interactive Fix Flow (Claude Code Integration)

Using `--fix-mode propose` outputs fix proposals as JSON. Claude Code reads these, asks the user for approval, then applies fixes using the `Edit` tool:

```json
[
  {
    "indicator": "IND-06",
    "autoFixable": true,
    "fixStrategy": "remove-bypass-permissions",
    "severity": "critical",
    "target": "/path/to/settings.json",
    "description": "\"bypassPermissions\": true is set",
    "evidence": "Principle of least privilege",
    "diff": {
      "before": "{ \"bypassPermissions\": true, ... }",
      "after": "{ ... }"
    }
  },
  {
    "indicator": "IND-03",
    "autoFixable": false,
    "severity": "critical",
    "target": "/path/to/CLAUDE.md",
    "description": "...",
    "manualSteps": [
      "Move critical rules to the first third (position 0 to 0.3)",
      "Review CLAUDE.md and refactor per the remediation guidance."
    ]
  }
]
```

**Principle**: The CLI only proposes. Actual fixes are applied by Claude Code using the `Edit` tool after user approval, making everything fully transparent with diff preview.

## All 25 Indicators

| Category | Count | Key Areas |
|---|---|---|
| CLAUDE.md Structure | 5 | Line count bloat / Prefix instability / Lost in the Middle / Duplicate sections / Volatile elements at tail |
| settings.json | 4 | bypassPermissions / Auto-accept all / Excessive permissions / No hooks configured |
| Hooks | 3 | Missing error handling / Side-effect risk / PostToolUse overuse |
| Skills | 4 | Insufficient description / Ambiguous trigger / No risk setting / Namespace collision |
| Memory | 3 | MEMORY.md bloat / Scattered lessons / Broken pointers |
| MCP | 3 | Unpinned versions / Insufficient descriptions / Unverified supply chain |
| Workflow | 3 | Missing gate definitions / Poor plan management / Missing review-protocol |

See [docs/indicators.md](./docs/indicators.md) for details.

## Grading Specification

The base grade is determined by PASS rate, with 1-tier demotion per Critical violation (max 3 tiers).

| Grade | PASS Rate |
|---|---|
| S | >= 90% |
| A | >= 75% |
| B | >= 60% |
| C | >= 45% |
| D | >= 30% |
| E | < 30% |

See [docs/grading.md](./docs/grading.md) for details.

## Configuration

Extend the MCP publisher allowlist and other settings via `~/.neko-harness-doctor/config.json`:

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

## Options

```
--target <path>       Target directory to diagnose (default: ~/.claude/)
--workspace <path>    Working directory to look for plans/checklist/rules
--format <fmt>        Output format: json|markdown (default: markdown)
--category <name>     Diagnose a specific category only
--severity <level>    Minimum severity: critical|major|minor (default: minor)
--top <n>             Number of top Quick Wins to display (default: 5)
--fix-mode <mode>     Fix proposal mode: off|propose (default: off)
--lang <lang>         Output language: ja|en (default: ja)
--quiet               Show violations only
--help                Show help

Environment variables:
  NEKO_HARNESS_WORKSPACE  Fallback for --workspace

Exit codes:
  0 - Diagnosis completed
  1 - Target not found
  2 - Internal error
```

## Comparison with Similar Tools

| Tool | Scope | Relationship to neko-harness-doctor |
|---|---|---|
| `skill-security-check` | Security audit for individual Skills | Complementary (this tool only does cross-cutting Skill structure audits) |
| `cc-skill-security-review` | Security review of code changes | Complementary (this tool audits deployed configuration) |
| `analyze-permissions` | settings.json permission analysis | Complementary (this tool diagnoses across 8 broader areas) |

## FAQ

**Q: Does it call an LLM?**
A: No. All checks are deterministic using grep / AST / JSON parsing. Same input always produces the same output. Ideal for CI integration.

**Q: Does it modify my files?**
A: **The CLI itself never modifies anything.** Fixes go as far as outputting proposal JSON via `--fix-mode propose`. Actual changes are applied by Claude Code using the `Edit` tool (after user approval).

**Q: Any dependencies?**
A: Zero runtime dependencies. Runs on Node.js 18+ stdlib only.

**Q: Can I add or customize indicators?**
A: As of v0.2.0, only the built-in 25 indicators are available. User-defined indicators are planned for the future. Thresholds like the publisher allowlist can be extended via `~/.neko-harness-doctor/config.json`.

## License

[MIT](./LICENSE)

## Acknowledgments

- **Liu et al. 2023** "Lost in the Middle" (arXiv:2307.03172) -- basis for IND-03
- **Anthropic Prompt Caching Guide** -- basis for IND-01/02/05
- **OpenSSF Secure Supply Chain Best Practices** -- basis for IND-20/22
- **IEEE peer review standard / Four Eyes Principle** -- basis for IND-25

## Roadmap

- [x] **v0.1.0** -- Initial 25 indicators, i18n, fix-mode=propose
- [x] **v0.2.0** -- Shell hook support (IND-10), `hd-ignore` inline exclusion, external skill exclusion (`--skip-external`), CRLF parse bug fix, CI/test suite
- [ ] **v0.3.0** -- ESLint integration, user-defined indicators, live MCP tool description measurement (dynamic fetch at startup)
- [ ] **v0.4.0** -- IND-22 postinstall live measurement integration
- [ ] **v1.0.0** -- Stable release
