# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **CI workflow** (`.github/workflows/ci.yml`): matrix-tests against Node 18/20/22 on both `ubuntu-latest` and `windows-latest`. Windows runner is intentional — it guards against CRLF regressions like the one fixed in v0.2.0.
- **Test suite** (`test/test.mjs`): uses Node.js built-in `node:test` runner (zero new dependencies). Covers:
  - `parseFrontmatter` regression cases (LF, CRLF, mixed, empty, quoted) — pins down the v0.1.0 Windows bug.
  - `audit.mjs` CLI smoke tests (`--help`, `-h`, nonexistent target, minimal workspace JSON output).
- `package.json`: `test` script now runs `node --test test/test.mjs` instead of a placeholder.

### Planned (v0.3.0)
- Lint workflow (ESLint)
- Test fixture suite covering all 25 indicators
- User-defined indicator support
- `npm publish` to the public registry

## [0.2.0] - 2026-04-11

### Added
- **IND-10 shell script support**: detects `set -e`, `set -o errexit`, `trap ... ERR`, `|| exit` patterns in `.sh` hooks. Previously only JS/TS hooks were evaluated, causing false positives for every shell hook.
- **Inline ignore directives**: add a `hd-ignore: IND-NN` comment (any line, any syntax) to exclude a specific file from a given indicator. Applies to IND-10 and IND-11. Useful for hooks whose side effects are the entire point (persistent logs, snapshots, drift detectors).
- **`--skip-external` CLI flag**: excludes upstream-managed skills from IND-13/14/15/16 counts. Detects externals via `source` field, `date_added` field, or the community pattern of `allowed-tools:` + `model:` in SKILL.md.
- **`isExternalSkill()` helper** in `src/utils.mjs` — reusable OR-logic detector
- Additional directory skipping in `walkFiles`: `__tests__/`, `dist/`, `build/`, `coverage/`, `.nyc_output/`, `.cache/`. Previously only `node_modules/` was skipped.

### Fixed
- IND-10 no longer reports false positives for shell script hooks with `set -e` or `trap ... ERR`
- `findHookScripts` no longer picks up test fixtures or bundled dist files under `__tests__/` etc.
- IND-13/14/15/16 ran the same filesystem traversal 4× per invocation; now shared via a single `iterSkills` generator in `src/indicators/skills.mjs`

### Notes
- **Dogfooding discovery**: these gaps were found by running v0.1.0 against the author's own `~/.claude/` environment. Of 5 identified issues, 3 turned out to be v0.1.0 false positives (IND-10 shell, IND-13/15 upstream skills) rather than actual harness problems. The remaining 2 were legitimate environment issues fixed separately.
- Backward-compatible: all new behavior is opt-in (`--skip-external`) or additive (shell detection PASSes strictly more hooks than before).

## [0.1.0] - 2026-04-11

### Added
- Initial release with 25 anti-pattern indicators across 7 categories
  - CLAUDE.md structure (5): size bloat, prefix instability, Lost-in-the-Middle, duplicate sections, volatile-at-tail
  - settings.json (4): bypassPermissions, auto-accept-all, overly broad permissions, hooks unconfigured
  - Hooks (3): missing error handling, side effects, PostToolUse overuse
  - Skills (4): description insufficient, trigger ambiguous, risk not set, namespace collision
  - Memory (3): MEMORY.md bloat, lesson scattering, broken pointers
  - MCP (3): version not pinned, tool description insufficient, supply chain unverified
  - Workflow (3): gate definitions missing, plans directory unused, review-protocol missing
- Hybrid grading (S-E) with pass-rate base + critical-triggered demotion (max 3 levels)
- Prioritized Quick Wins output (top N, default 5)
- Interactive fix proposal mode (`--fix-mode propose`) with `autoFixable` metadata
  - 6 indicators are auto-fixable via strategy functions
  - Remaining 19 indicators produce manual guidance steps
- i18n support (Japanese default, English via `--lang en`)
- Configurable MCP publisher allowlist via `~/.neko-harness-doctor/config.json`
- Read-only guarantee (CLI never writes; modifications delegated to Claude Code Edit tool)
- Zero runtime dependencies
- Generalized path discovery via `--target` and `--workspace` (plus `NEKO_HARNESS_WORKSPACE` env var)

### Evidence sources (public)
- Anthropic Prompt Caching Guide (IND-01, IND-02, IND-05)
- Liu et al. 2023 "Lost in the Middle" (IND-03)
- Principle of least privilege (IND-06, IND-07, IND-08)
- OpenSSF Secure Supply Chain Best Practices (IND-20, IND-22)
- Four Eyes Principle / IEEE peer review standard (IND-25)

### Notes
- Origin: extracted from internal `harness-doctor` skill (v0.1.0) used inside the aliksir/neko-gundan project

[Unreleased]: https://github.com/aliksir/neko-harness-doctor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aliksir/neko-harness-doctor/releases/tag/v0.1.0
