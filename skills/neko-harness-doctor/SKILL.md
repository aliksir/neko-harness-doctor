---
name: neko-harness-doctor
description: "Diagnose Claude Code harness (CLAUDE.md, settings.json, .mcp.json, hooks, skills, memory, MCP, workflow) against 25 anti-pattern indicators. Outputs S-E grade, per-category scores, violation list with evidence citations, and prioritized Quick Wins. Supports --fix-mode=propose for interactive fix approval via Claude Code Edit tool. Japanese default, English via --lang en. Use /neko-harness-doctor or 'ハーネス診断して' or 'diagnose my harness'."
---

# neko-harness-doctor

Diagnose a Claude Code harness against 25 anti-pattern indicators and output a grade (S/A/B/C/D/E) with prioritized Quick Wins.

## When to use

- User asks to "diagnose my harness", "ハーネス診断して", "check my Claude Code config", or explicitly runs `/neko-harness-doctor`
- User wants to know how their `~/.claude/` configuration scores against best practices
- User is preparing to publish a Claude Code project and wants quality verification

## Target

- **Default**: `~/.claude/` (user harness)
- **Custom**: user-specified path via `--target <path>`
- Supports POSIX `~/` and Windows `~\` tilde expansion
- Auto-detects workspace by walking up for `.claude/`, `plans/`, or `CLAUDE.md` markers

## Execution

Invoke as a bare command (the plugin's `bin/` is automatically on PATH when enabled):

```bash
neko-harness-doctor --target "~/.claude" --skip-external --top 3
```

For a different target:

```bash
neko-harness-doctor --target "/path/to/project/.claude" --lang en
```

The CLI prints a Markdown report by default with:
1. **Grade** (S/A/B/C/D/E) and total score (e.g., `S 25/25`)
2. **Category breakdown**: CLAUDE.md / settings.json / .mcp.json / hooks / skills / memory / MCP / workflow
3. **Violations list** with evidence citations (file:line)
4. **Quick Wins**: prioritized fix suggestions (top N)

## Interactive fix flow (approval-based)

When the user wants to apply fixes:

1. Run `neko-harness-doctor --fix-mode propose --format json` to get structured proposals
2. Parse the JSON and present each proposal to the user with severity and description
3. Wait for **explicit approval** per proposal
4. Apply approved changes via the Edit tool
5. Re-run the audit to verify the fix resolved the violation

**Read-only guarantee**: the CLI never writes files. All modifications flow through Claude Code's Edit tool with user approval.

## Options (forwarded to the CLI)

```
--target <path>       Target directory (default: ~/.claude/)
--workspace <path>    Workspace dir for plans/rules auto-detection
--format <fmt>        json|markdown (default: markdown)
--category <name>     Filter to a single category
--severity <level>    Minimum severity
--top <n>             Quick Wins count (default: 5)
--fix-mode <mode>     off|propose (default: off)
--lang <lang>         ja|en (default: ja)
--skip-external       Skip external skill scanning (faster)
--quiet               Violations only
--help                Show help
```

## Examples

**Quick check of your own harness:**
```bash
neko-harness-doctor --target "~/.claude" --skip-external --top 3
```

**English output, JSON format (for automation):**
```bash
neko-harness-doctor --target "~/.claude" --format json --lang en
```

**Propose fixes for the top 5 violations:**
```bash
neko-harness-doctor --target "~/.claude" --fix-mode propose --format json
```

## Related

- Source: https://github.com/aliksir/neko-harness-doctor
- npm (standalone CLI): `@aliksir/neko-harness-doctor`
- License: MIT
