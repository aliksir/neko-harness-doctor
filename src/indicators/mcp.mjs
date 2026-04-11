// mcp.mjs - MCP indicators (IND-20 to IND-22)

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
];
