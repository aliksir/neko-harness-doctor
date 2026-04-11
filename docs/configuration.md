# Configuration

neko-harness-doctor supports a user-level configuration file for extending allowlists and other behavior.

---

## File location

```
~/.neko-harness-doctor/config.json
```

The file is optional. If absent, built-in defaults apply.

---

## Schema

```json
{
  "mcp": {
    "publisherAllowlist": [
      "@anthropic-ai",
      "@anthropic",
      "@modelcontextprotocol",
      "@microsoft",
      "@vercel",
      "@cloudflare",
      "@openai",
      "@google",
      "@sentry",
      "@supabase",
      "@my-org"
    ]
  }
}
```

### Fields

| Key | Type | Used by | Default |
|---|---|---|---|
| `mcp.publisherAllowlist` | `string[]` | IND-22 MCP supply chain | 10 built-in vendors |

When the user config provides a non-empty `publisherAllowlist`, it **replaces** the default (does not merge). Include the default vendors you still trust.

---

## Environment variables

| Variable | Used by | Default |
|---|---|---|
| `NEKO_HARNESS_WORKSPACE` | `--workspace` fallback | (none) |

`--workspace` on the command line takes precedence over the environment variable.

---

## CLI options summary

| Option | Effect |
|---|---|
| `--target <path>` | Directory to audit (default: `~/.claude/`) |
| `--workspace <path>` | Directory containing `plans/`, `.claude/rules/`, etc. |
| `--format <fmt>` | `json` or `markdown` (default) |
| `--category <name>` | Audit only one category |
| `--severity <level>` | Minimum severity: `critical` / `major` / `minor` |
| `--top <n>` | Top N Quick Wins (default 5) |
| `--fix-mode <mode>` | `off` (default) or `propose` |
| `--lang <lang>` | `ja` (default) or `en` |
| `--quiet` | Show only violations |
| `--help` | Show help |

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Diagnosis complete (regardless of violations) |
| 1 | Target not found |
| 2 | Internal error |
