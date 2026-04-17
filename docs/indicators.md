# 26 Indicators

Full reference for each of the 26 anti-pattern indicators evaluated by neko-harness-doctor.

**Source of truth**: `src/indicators/*.mjs` and `src/indicators/index.mjs`.
This document is a human-readable projection of the implementation.

---

## Category breakdown

| Category | Indicators | Fixed Severity | Dynamic |
|---|---|---|---|
| CLAUDE.md structure | 5 | 3 critical fixed + 14 major + 7 minor | 1 (IND-01) |
| settings.json | 4 | | |
| Hooks | 3 | | |
| Skills | 4 | | |
| Memory | 3 | | |
| MCP | 4 | | |
| Workflow | 3 | | |
| **Total** | **26** | **4+14+7** | **1** |

**Arithmetic**: 4 + 14 + 7 + 1 = 26 ✅

---

## CLAUDE.md structure (5)

### IND-01 — claude-md-size-bloat (dynamic)

- **Severity**:
  - `lines > 500` → critical
  - `lines > 300` → major
  - `lines > 200` → minor
  - `lines ≤ 200` → PASS
- **Evidence**: Anthropic prompt caching best practice
- **Auto-fixable**: No
- **Why**: CLAUDE.md is re-injected every turn; line growth degrades KV-Cache efficiency and consumes context window
- **Remediation**: Split detailed rules into separate files, append-only for volatile info, aim for ~200 lines

### IND-02 — prefix-instability (major)

- **Evidence**: Anthropic prompt caching — stable prefix principle
- **Auto-fixable**: Yes (strategy: `move-volatile-to-tail`)
- **Detection**: Regex match of volatile patterns (`\d{4}-\d{2}-\d{2}` | `v\d+\.\d+\.\d+` | `session \d+` | `last updated` | `タイムスタンプ`) in the top 100 lines
- **Why**: Volatile content in the prefix invalidates cache from the very beginning
- **Remediation**: Move volatile elements to the tail of CLAUDE.md

### IND-03 — critical-rules-not-in-first-third (critical)

- **Evidence**: Liu et al. 2023 "Lost in the Middle" (arXiv:2307.03172)
- **Auto-fixable**: No
- **Detection**: Finds headings matching `critical|クリティカルルール|重要|destructive` and checks if the earliest such heading has `position > 0.3`
- **Why**: LLMs miss instructions buried in the middle of long inputs
- **Remediation**: Move critical rules to the first third (position 0 to 0.3)

### IND-04 — duplicate-sections (minor)

- **Evidence**: General documentation best practice
- **Auto-fixable**: No
- **Detection**: Counts `## / ### / ####` headings; reports if any heading appears ≥2 times
- **Remediation**: Merge duplicates or rename to distinct titles

### IND-05 — volatile-elements-not-at-tail (major)

- **Evidence**: Anthropic prompt caching — tail-only updates principle
- **Auto-fixable**: Yes (strategy: `move-volatile-to-tail`)
- **Detection**: Finds volatile lines; violates if earliest match has `position < 0.9`
- **Why**: Mid-document volatile content invalidates cache rows
- **Remediation**: Consolidate volatile elements at the tail of CLAUDE.md

---

## settings.json (4)

### IND-06 — bypass-permissions-enabled (critical)

- **Evidence**: Principle of least privilege
- **Auto-fixable**: Yes (strategy: `remove-bypass-permissions`)
- **Detection**: `settings.json` contains `"bypassPermissions": true` (top-level or under `permissions`)
- **Remediation**: Remove the flag; allow only necessary permissions explicitly

### IND-07 — auto-accept-all (major)

- **Evidence**: Principle of least privilege
- **Auto-fixable**: Yes (strategy: `narrow-auto-accept`)
- **Detection**: `permissions.allow` contains `"*"` or `autoAccept: true`
- **Remediation**: Narrow to specific tools (e.g. `Read`, `Grep`, `Glob`)

### IND-08 — permissions-too-broad (major)

- **Evidence**: Principle of least privilege
- **Auto-fixable**: No
- **Detection**: `permissions.allow` contains wildcards like `Bash(*)`, `Write(*)`, `Edit(*)`
- **Remediation**: Replace with specific commands or paths

### IND-09 — hooks-not-configured (major)

- **Evidence**: Quality gate best practice
- **Auto-fixable**: No
- **Detection**: `hooks` section is missing or empty
- **Remediation**: Set up PreToolUse/PostToolUse hooks for gates and auditing

---

## Hooks (3)

### IND-10 — hook-missing-error-handling (major)

- **Evidence**: Hook reliability best practice
- **Auto-fixable**: No
- **Detection**: Hook scripts lack `try/catch` or `process.on('uncaughtException')`
- **Remediation**: Add error handling to all hook scripts

### IND-11 — hook-side-effects (major)

- **Evidence**: Hook purity principle
- **Auto-fixable**: No
- **Detection**: Hook scripts contain `writeFileSync`, `appendFileSync`, `rmSync`, `unlinkSync`, `fetch(`, or HTTP URLs
- **Remediation**: Keep hooks read-only; avoid file writes and network calls

### IND-12 — post-tool-use-overuse (minor)

- **Evidence**: Performance best practice
- **Auto-fixable**: No
- **Detection**: PostToolUse hook count ≥ 10
- **Remediation**: Consolidate or distribute to PreToolUse

---

## Skills (4)

### IND-13 — skill-description-insufficient (major)

- **Evidence**: MCP tool description 6-element guideline
- **Auto-fixable**: No
- **Detection**: More than 5 skills have frontmatter `description` < 60 characters
- **Remediation**: Include 6 elements (purpose/args/return/side-effects/prerequisites/exceptions)

### IND-14 — skill-trigger-ambiguous (minor)

- **Evidence**: Skill discoverability best practice
- **Auto-fixable**: No
- **Detection**: More than 3 skills contain "use when needed" / "general purpose" without concrete triggers
- **Remediation**: Specify concrete trigger keywords or slash commands

### IND-15 — skill-risk-not-set (minor)

- **Evidence**: Security classification best practice
- **Auto-fixable**: Yes (strategy: `add-default-risk`)
- **Detection**: More than 10 skills lack `risk:` in frontmatter
- **Remediation**: Add `risk: low|medium|high` to each SKILL.md

### IND-16 — skill-namespace-collision (major)

- **Evidence**: Namespace hygiene
- **Auto-fixable**: No
- **Detection**:
  - (a) Same SKILL.md name across user-level and project-level directories
  - (b) frontmatter `name:` does not match directory name
  - (c) Multiple skills with the same name
- **Remediation**: Align frontmatter `name:` with directory name

---

## Memory (3)

### IND-17 — memory-md-bloat (major)

- **Evidence**: Context window efficiency
- **Auto-fixable**: No
- **Detection**: `MEMORY.md` exceeds 200 lines
- **Remediation**: Split details into separate files and reference from MEMORY.md

### IND-18 — lesson-scattered (minor)

- **Evidence**: Knowledge accumulation best practice
- **Auto-fixable**: No
- **Detection**: Any lesson topic has ≥5 files
- **Remediation**: Consolidate into a single file per topic

### IND-19 — memory-broken-pointers (minor)

- **Evidence**: Documentation integrity
- **Auto-fixable**: No
- **Detection**: MEMORY.md links to files that do not exist
- **Remediation**: Create the target files or remove the broken references

---

## MCP (4)

### IND-20 — mcp-version-not-pinned (major)

- **Evidence**: OpenSSF Secure Supply Chain best practices
- **Auto-fixable**: No
- **Detection**: `.mcp.json` uses `@latest` or unversioned `npx` packages
- **Remediation**: Pin to `@x.y.z` in args

### IND-21 — mcp-tool-description-insufficient (minor)

- **Evidence**: MCP tool description quality research (Rostamzadeh et al. 2026)
- **Auto-fixable**: No
- **Detection**: Requires runtime inspection (currently always PASS at static audit)
- **Remediation**: Runtime inspection at MCP server startup (future enhancement)

### IND-22 — mcp-supply-chain-unverified (critical)

- **Evidence**: OpenSSF Secure Supply Chain best practices
- **Auto-fixable**: No
- **Detection**: MCP server publisher not in allowlist
  - Default allowlist: `@anthropic-ai`, `@anthropic`, `@modelcontextprotocol`, `@microsoft`, `@vercel`, `@cloudflare`, `@openai`, `@google`, `@sentry`, `@supabase`
  - User-extensible via `~/.neko-harness-doctor/config.json`
- **Remediation**: Verify publisher trust; run `npm view <pkg> scripts.postinstall` for supply chain audit

### IND-26 — mcp-server-args-dangerous-flags (critical)

- **Severity**: `critical`
- **Evidence**: CVE-2026-40933 (Flowise Authenticated RCE Via MCP Adapters `npx -c`), https://github.com/FlowiseAI/Flowise/security/advisories/GHSA-c9gw-hvqq-f33r
- **Auto-fixable**: No
- **Detection**: `.mcp.json` `mcpServers[*].args` arrays are joined into a flat string and matched against dangerous execution flags (`-c`, `--call`, `exec`, `dlx`, `x`, `eval`, `-e`, `-p`) for the npx/npm/pnpm/yarn/bun/deno ecosystem
- **Why**: Trusted package manager commands (e.g. `npx`) combined with arbitrary-code-execution flags bypass publisher allowlists. CVE-2026-40933 demonstrated RCE via `npx -c "<shell cmd>"` in MCP adapter configurations
- **Remediation**: Remove `-c`, `--call`, `exec`, `dlx`, `eval`, `-e`, `-p` from MCP server args. Use explicit package references (`npx @scope/pkg@x.y.z`) without inline shell commands

---

## Workflow (3)

### IND-23 — gate-definitions-missing (major)

- **Evidence**: Quality gate best practice
- **Auto-fixable**: No
- **Detection**: No `gates/` directory and no `rules/gates.md`
- **Remediation**: Create start/complete gate definitions

### IND-24 — plans-directory-unused (major)

- **Evidence**: Planning-before-implementation principle
- **Auto-fixable**: Yes (strategy: `create-plans-dir`)
- **Detection**: `plans/` missing, or no plan added in the last 7 days
- **Remediation**: Create `plans/` and start writing plan documents before implementation

### IND-25 — review-protocol-missing (major)

- **Evidence**: Four Eyes Principle / IEEE software peer review standard
- **Auto-fixable**: No
- **Detection**: No `rules/review-protocol.md` or equivalent
- **Remediation**: Document the implementer ≠ reviewer rule and other review policies

---

## Future extensions (post-v0.1.0)

- Runtime MCP tool description inspection (IND-21)
- postinstall script inspection integration (IND-22)
- User-defined indicators via config
- Late-document critical rule detection (secondary Lost-in-the-Middle check)
- Invariant tracking for Purpose files
