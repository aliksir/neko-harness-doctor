# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned (v0.2.0)
- CI workflow (lint + smoke test via GitHub Actions)
- Test fixture suite covering all 25 indicators
- User-defined indicator support
- `npm publish` to the public registry

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
- Independently derived from masa_wunder's `/review-harness` concept (paid article not subscribed)

[Unreleased]: https://github.com/aliksir/neko-harness-doctor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aliksir/neko-harness-doctor/releases/tag/v0.1.0
