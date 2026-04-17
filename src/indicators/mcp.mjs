// mcp.mjs - MCP indicators (IND-20 to IND-22, IND-26)

import { safeRead, parseJSON, findMcpJson, loadUserConfig } from '../utils.mjs';

const DEFAULT_PUBLISHER_ALLOWLIST = [
  '@anthropic-ai', '@anthropic', '@modelcontextprotocol',
  '@microsoft', '@vercel', '@cloudflare', '@openai',
  '@google', '@sentry', '@supabase',
];

function getPublisherAllowlist() {
  const userConfig = loadUserConfig();
  const userList = userConfig?.mcp?.publisherAllowlist;
  if (Array.isArray(userList) && userList.length > 0) return userList;
  return DEFAULT_PUBLISHER_ALLOWLIST;
}

// Dangerous execution flags in npx / npm / pnpm / yarn / bun / deno ecosystems.
// CVE-2026-40933: Flowise Authenticated RCE Via MCP Adapters — npx -c "<cmd>" pattern.
const DANGEROUS_FLAGS_RE = /(?:^|\s)(npx|npm|pnpm|yarn|bun|deno)(?:\s+\S+)*?\s+(-c|--call|exec|dlx|x\b|eval|-e\b|-p\b)/;

function checkMcpServerArgsDangerousFlags(mcpJson) {
  if (!mcpJson?.mcpServers) return { passed: true };
  const bad = [];
  for (const [name, srv] of Object.entries(mcpJson.mcpServers)) {
    const args = srv.args;
    if (!Array.isArray(args) || args.length === 0) continue;
    // Prepend the command field so patterns like `bun x -c` or `deno eval`
    // are detected even when `command` is the ecosystem binary and `args`
    // holds the subcommand + flags.
    const command = typeof srv.command === 'string' ? srv.command : '';
    const flat = [command, ...args.map(String)].join(' ').trim();
    if (DANGEROUS_FLAGS_RE.test(flat)) {
      // Extract the matched flag for the violation message
      const m = flat.match(DANGEROUS_FLAGS_RE);
      const flagFound = m ? m[2] : '(unknown)';
      bad.push(`${name} (flag: ${flagFound})`);
    }
  }
  if (bad.length > 0) {
    return {
      passed: false,
      violation: `MCP server args contain dangerous execution flags: ${bad.join(', ')}`,
      location: '.mcp.json',
      remediation:
        'Remove arbitrary-code-execution flags (-c, --call, exec, dlx, eval, -e, -p) from MCP server args. ' +
        'Use explicit package references without inline shell commands. ' +
        'Reference: CVE-2026-40933 (Flowise RCE Via MCP Adapters npx -c pattern), ' +
        'https://github.com/FlowiseAI/Flowise/security/advisories/GHSA-c9gw-hvqq-f33r',
    };
  }
  return { passed: true };
}

export const mcpIndicators = [
  {
    id: 'IND-20',
    category: 'mcp',
    name: 'mcp-version-not-pinned',
    severity: 'major',
    evidence: 'OpenSSF Secure Supply Chain best practices',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const mcpJson = findMcpJson(ctx.target, ctx.workspace);
      if (!mcpJson) return { passed: true, note: '.mcp.json not found' };
      const json = parseJSON(safeRead(mcpJson));
      if (!json?.mcpServers) return { passed: true };
      const bad = [];
      for (const [name, srv] of Object.entries(json.mcpServers)) {
        const args = srv.args || [];
        const hasLatest = args.some(a => /@latest\b|:latest\b/.test(String(a)));
        const hasVersion = args.some(a => /@\d+\.\d+/.test(String(a)));
        if (hasLatest || (!hasVersion && srv.command === 'npx')) {
          bad.push(name);
        }
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `MCP servers without version pinning: ${bad.join(', ')}`,
          location: mcpJson,
          remediation: 'Pin each MCP server to @x.y.z in its args list',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-21',
    category: 'mcp',
    name: 'mcp-tool-description-insufficient',
    severity: 'minor',
    evidence: 'MCP tool description quality research (Rostamzadeh et al. 2026)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      // Tool descriptions are dynamic (runtime info). Treated as PASS at static audit.
      // Future: runtime inspection at MCP server startup.
      const mcpJson = findMcpJson(ctx.target, ctx.workspace);
      if (!mcpJson) return { passed: true };
      return { passed: true, note: 'dynamic tool descriptions require runtime inspection' };
    },
  },

  {
    id: 'IND-22',
    category: 'mcp',
    name: 'mcp-supply-chain-unverified',
    severity: 'critical',
    evidence: 'OpenSSF Secure Supply Chain best practices',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const mcpJson = findMcpJson(ctx.target, ctx.workspace);
      if (!mcpJson) return { passed: true };
      const json = parseJSON(safeRead(mcpJson));
      if (!json?.mcpServers) return { passed: true };
      const allowlist = getPublisherAllowlist();
      const bad = [];
      for (const [name, srv] of Object.entries(json.mcpServers)) {
        if (srv.command !== 'npx') continue;
        const args = srv.args || [];
        const pkg = args.find(a => typeof a === 'string' && !a.startsWith('-'));
        if (!pkg) continue;
        const isAllowlisted = allowlist.some(p => pkg.startsWith(p));
        if (!isAllowlisted) bad.push(`${name} (${pkg})`);
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `MCP servers outside publisher allowlist: ${bad.join(', ')}`,
          location: mcpJson,
          remediation: 'Verify publisher trust, run `npm view <pkg> scripts.postinstall` for supply chain audit. Extend allowlist via ~/.neko-harness-doctor/config.json',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-26',
    category: 'mcp',
    name: 'mcp-server-args-dangerous-flags',
    severity: 'critical',
    evidence:
      'CVE-2026-40933 (Flowise Authenticated RCE Via MCP Adapters `npx -c`), ' +
      'https://github.com/FlowiseAI/Flowise/security/advisories/GHSA-c9gw-hvqq-f33r',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const mcpJson = findMcpJson(ctx.target, ctx.workspace);
      if (!mcpJson) return { passed: true, note: '.mcp.json not found' };
      const json = parseJSON(safeRead(mcpJson));
      const result = checkMcpServerArgsDangerousFlags(json);
      if (!result.passed) result.location = mcpJson;
      return result;
    },
  },
];
