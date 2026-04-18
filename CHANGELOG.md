# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-04-18

### Fixed
- **`findDefaultWorkspace`: false-positive workspace detection for nested sub-projects** (IND-23/24/25 regression): when run from a nested Claude Code project (e.g. `C:/work/my-lib` that contains `.claude/`), the upward walk stopped at the first marker match, selecting the nested directory instead of the outer `C:/work` workspace that also contains `plans/` and `CLAUDE.md`. The new logic scores each ancestor by how many workspace markers it contains (`.claude/`, `plans/`, `CLAUDE.md`) and picks the highest-scoring directory, preferring the outermost match on ties. Workflow indicators now correctly resolve gates/plans/review-protocol under the true workspace root. `NEKO_HARNESS_WORKSPACE` and explicit `--workspace` still take precedence. 2 new unit tests added (test count: 25 → 27).

## [0.3.0] - 2026-04-17

### Added
- **IND-26 `mcp-server-args-dangerous-flags`** (MCP category, severity: critical): detects dangerous arbitrary-code-execution flags (`-c`, `--call`, `exec`, `dlx`, `x`, `eval`, `-e`, `-p`) in `.mcp.json` `mcpServers[*].args` arrays for the npx/npm/pnpm/yarn/bun/deno ecosystem. Mitigates CVE-2026-40933 (Flowise Authenticated RCE Via MCP Adapters `npx -c` pattern). Reference: https://github.com/FlowiseAI/Flowise/security/advisories/GHSA-c9gw-hvqq-f33r
- **Claude Code plugin support**: `.claude-plugin/plugin.json` manifest and `skills/neko-harness-doctor/SKILL.md`. The repository can now be submitted to the Claude Code plugin directory. When installed as a plugin, `bin/neko-harness-doctor` is automatically added to the Bash tool's PATH, and the bundled skill lets Claude invoke diagnosis via `/neko-harness-doctor` or natural language triggers like "ハーネス診断して".
- `.claude-plugin/` and `skills/` added to `files` in `package.json` so the npm tarball is consistent with the GitHub repository layout.

### Changed
- Total indicator count: 25 → 26. MCP category: 3 → 4.
- `src/indicators/index.mjs` sanity check updated: `expected 25` → `expected 26`.

## [0.2.3] - 2026-04-12

### Added
- **Tilde expansion for `--target` / `--workspace`**: `neko-harness-doctor --target ~/.claude` now works from PowerShell (and any shell that does not expand `~` itself). Both POSIX-style `~/foo` and Windows-style `~\foo` are handled, with `~` alone mapping to `os.homedir()`. Non-tilde paths pass through unchanged, and a mid-string `~` (e.g. `foo/~/bar`) is intentionally left alone.
- **Smart workspace default**: when `--workspace` is not set, the CLI now walks upward from `process.cwd()` looking for any of `.claude/`, `plans/`, or `CLAUDE.md` — the same way `git` walks upward for `.git/`. This means running `neko-harness-doctor` from a nested sub-project directory (e.g. `C:/work/some-repo`) correctly picks up the parent workspace (`C:/work`) so Workflow indicators (IND-23/24/25) find the right gate definitions, plan directory, and review protocol. `NEKO_HARNESS_WORKSPACE` still takes precedence.
- **`expandTilde()` and `findDefaultWorkspace()`** helpers exported from `src/utils.mjs` for reuse.
- **7 new unit tests + 6 integration tests** covering tilde expansion edge cases, upward workspace discovery (`.claude/` marker, `plans/` marker, `CLAUDE.md` marker, nested descent, fall-through), the `NEKO_HARNESS_WORKSPACE` override, and a CLI-level check that `--target ~/missing` reports the resolved home path rather than the literal tilde. Test count: 12 → 25.

### Fixed
- Users running the CLI from sub-project directories previously got false-positive Workflow violations because `workspace` defaulted to `process.cwd()`. With the upward walk this works out of the box.

## [0.2.2] - 2026-04-12

### Fixed
- **`bin` entry crashed on Windows** with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. The shim did `await import(absolutePath)`, and on Windows Node's ESM loader parses `C:\...` as a URL whose scheme is `c:`, which is rejected. Wrapped the path with `pathToFileURL(...).href` so the dynamic import receives a proper `file://` URL. Linux/macOS were unaffected because absolute POSIX paths happen to work.

### Added
- **bin-entry regression tests** (`test/test.mjs`): two new cases exercise the published `bin/neko-harness-doctor` script directly (not just the `src/audit.mjs` module) to catch platform-specific shim bugs before they ship. The first one explicitly asserts that `ERR_UNSUPPORTED_ESM_URL_SCHEME` never appears in stderr.

## [0.2.1] - 2026-04-12

### Fixed
- **`bin` entry registration**: the `./` prefix on `bin["neko-harness-doctor"]` was rejected by npm at publish time and the entire bin mapping was stripped from the published v0.2.0 tarball, leaving `npm install -g @aliksir/neko-harness-doctor` without a working CLI binary. Dropped the prefix so the bin entry survives publish.
- `repository.url`: normalized to `git+https://...` per npm conventions.

### Added
- **CI workflow** (`.github/workflows/ci.yml`): matrix-tests against Node 18/20/22 on both `ubuntu-latest` and `windows-latest`. Windows runner is intentional — it guards against CRLF regressions like the one fixed in v0.2.0.
- **Test suite** (`test/test.mjs`): uses Node.js built-in `node:test` runner (zero new dependencies). Covers:
  - `parseFrontmatter` regression cases (LF, CRLF, mixed, empty, quoted) — pins down the v0.1.0 Windows bug.
  - `audit.mjs` CLI smoke tests (`--help`, `-h`, nonexistent target, minimal workspace JSON output).
- `package.json`: `test` script now runs `node --test test/test.mjs` instead of a placeholder.

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
