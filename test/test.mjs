// Test suite for neko-harness-doctor
// Uses Node.js built-in test runner (node --test) to keep zero dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFrontmatter,
  expandTilde,
  findDefaultWorkspace,
} from '../src/utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ENTRY = join(__dirname, '..', 'src', 'audit.mjs');
const BIN_ENTRY = join(__dirname, '..', 'bin', 'neko-harness-doctor');

// ---------------------------------------------------------------------------
// parseFrontmatter — line-ending regression tests (v0.1.0 CRLF bug)
// ---------------------------------------------------------------------------

test('parseFrontmatter: LF line endings', () => {
  const input = '---\nname: test-skill\ndescription: hello\n---\nbody';
  const fm = parseFrontmatter(input);
  assert.equal(fm.name, 'test-skill');
  assert.equal(fm.description, 'hello');
});

test('parseFrontmatter: CRLF line endings (v0.1.0 regression)', () => {
  // This is the exact bug that broke every Windows user in v0.1.0:
  // ECMAScript `.` in `/^([a-zA-Z_-]+):\s*(.*)$/` does not match `\r`,
  // so `(.*)$` silently captured nothing and the whole frontmatter became {}.
  const input = '---\r\nname: test-skill\r\ndescription: hello\r\n---\r\nbody';
  const fm = parseFrontmatter(input);
  assert.equal(fm.name, 'test-skill', 'CRLF frontmatter should parse name');
  assert.equal(fm.description, 'hello', 'CRLF frontmatter should parse description');
});

test('parseFrontmatter: mixed CRLF/LF line endings', () => {
  const input = '---\r\nname: test\ndescription: mixed\r\n---\nbody';
  const fm = parseFrontmatter(input);
  assert.equal(fm.name, 'test');
  assert.equal(fm.description, 'mixed');
});

test('parseFrontmatter: no frontmatter returns null', () => {
  const input = '# Just a heading\n\nsome body text';
  assert.equal(parseFrontmatter(input), null);
});

test('parseFrontmatter: empty or null input returns null', () => {
  assert.equal(parseFrontmatter(''), null);
  assert.equal(parseFrontmatter(null), null);
});

test('parseFrontmatter: quoted values get unquoted', () => {
  const input = '---\nname: "quoted"\nrisk: \'high\'\n---\n';
  const fm = parseFrontmatter(input);
  assert.equal(fm.name, 'quoted');
  assert.equal(fm.risk, 'high');
});

// ---------------------------------------------------------------------------
// audit.mjs — CLI smoke tests
// ---------------------------------------------------------------------------

function runAudit(args, opts = {}) {
  return spawnSync(process.execPath, [AUDIT_ENTRY, ...args], {
    encoding: 'utf8',
    ...opts,
  });
}

test('audit.mjs: --help exits 0 and prints usage', () => {
  const result = runAudit(['--help']);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}`);
  assert.ok(result.stdout.length > 0, 'help output should not be empty');
  assert.match(result.stdout, /neko-harness-doctor|Usage|使い方/i);
});

test('audit.mjs: -h short flag also works', () => {
  const result = runAudit(['-h']);
  assert.equal(result.status, 0);
});

test('audit.mjs: nonexistent target exits non-zero', () => {
  const bogus = join(tmpdir(), 'neko-hd-nonexistent-' + Date.now());
  const result = runAudit(['--target', bogus]);
  assert.notEqual(result.status, 0, 'nonexistent target should exit non-zero');
  assert.ok(
    result.stderr.length > 0 || result.stdout.length > 0,
    'should emit an error message',
  );
});

// ---------------------------------------------------------------------------
// expandTilde — cross-platform tilde expansion (v0.2.3)
// ---------------------------------------------------------------------------
// PowerShell does not perform tilde expansion on unquoted arguments, so
// `neko-harness-doctor --target ~/.claude` reaches the CLI as the literal
// string `~/.claude`. We expand it ourselves so Bash and PowerShell users
// get the same behavior.

test('expandTilde: ~ alone returns homedir', () => {
  assert.equal(expandTilde('~'), homedir());
});

test('expandTilde: ~/foo returns joined home path (POSIX)', () => {
  assert.equal(expandTilde('~/foo'), join(homedir(), 'foo'));
});

test('expandTilde: ~\\foo returns joined home path (Windows)', () => {
  assert.equal(expandTilde('~\\foo'), join(homedir(), 'foo'));
});

test('expandTilde: absolute path passes through unchanged', () => {
  const abs = process.platform === 'win32' ? 'C:\\tmp\\foo' : '/tmp/foo';
  assert.equal(expandTilde(abs), abs);
});

test('expandTilde: empty / null / non-string passes through', () => {
  assert.equal(expandTilde(''), '');
  assert.equal(expandTilde(null), null);
  assert.equal(expandTilde(undefined), undefined);
});

test('expandTilde: paths with ~ later in the string are not expanded', () => {
  // Only leading ~ expands — `foo/~/bar` is a literal.
  assert.equal(expandTilde('foo/~/bar'), 'foo/~/bar');
});

// ---------------------------------------------------------------------------
// findDefaultWorkspace — upward walk for workspace marker (v0.2.3)
// ---------------------------------------------------------------------------
// Previously `workspace` defaulted to `process.cwd()`, which broke workflow
// indicators (IND-23/24/25) whenever users ran the CLI from a nested
// sub-project directory. We now walk upward looking for `.claude/`, `plans/`,
// or `CLAUDE.md` markers like git walks up for `.git`.

test('findDefaultWorkspace: picks directory that directly contains .claude/', () => {
  const root = mkdtempSync(join(tmpdir(), 'neko-hd-ws-'));
  try {
    mkdirSync(join(root, '.claude'));
    assert.equal(findDefaultWorkspace(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findDefaultWorkspace: walks upward from a nested sub-directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'neko-hd-ws-'));
  try {
    mkdirSync(join(root, '.claude'));
    const nested = join(root, 'some-repo', 'src');
    mkdirSync(nested, { recursive: true });
    assert.equal(findDefaultWorkspace(nested), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findDefaultWorkspace: picks directory with plans/ when no .claude/', () => {
  const root = mkdtempSync(join(tmpdir(), 'neko-hd-ws-'));
  try {
    mkdirSync(join(root, 'plans'));
    assert.equal(findDefaultWorkspace(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findDefaultWorkspace: picks directory with CLAUDE.md when no .claude/ or plans/', () => {
  const root = mkdtempSync(join(tmpdir(), 'neko-hd-ws-'));
  try {
    writeFileSync(join(root, 'CLAUDE.md'), '# root\n', 'utf8');
    const nested = join(root, 'subdir');
    mkdirSync(nested);
    assert.equal(findDefaultWorkspace(nested), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findDefaultWorkspace: returns startDir when no marker is found upward', () => {
  const root = mkdtempSync(join(tmpdir(), 'neko-hd-ws-'));
  try {
    const nested = join(root, 'empty', 'deeper');
    mkdirSync(nested, { recursive: true });
    // The return is either `nested` (no marker at all) or some ancestor that
    // happens to contain a marker on the real filesystem above tmpdir.
    // At minimum, the result must exist and must not throw.
    const result = findDefaultWorkspace(nested);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findDefaultWorkspace: NEKO_HARNESS_WORKSPACE env var wins', () => {
  const original = process.env.NEKO_HARNESS_WORKSPACE;
  const override = mkdtempSync(join(tmpdir(), 'neko-hd-ws-env-'));
  const elsewhere = mkdtempSync(join(tmpdir(), 'neko-hd-ws-start-'));
  try {
    mkdirSync(join(elsewhere, '.claude'));
    process.env.NEKO_HARNESS_WORKSPACE = override;
    assert.equal(findDefaultWorkspace(elsewhere), override);
  } finally {
    if (original === undefined) delete process.env.NEKO_HARNESS_WORKSPACE;
    else process.env.NEKO_HARNESS_WORKSPACE = original;
    rmSync(override, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// audit.mjs: --target ~/... expands on PowerShell-style input (v0.2.3)
// ---------------------------------------------------------------------------

test('audit.mjs: --target ~/nonexistent expands and reports the resolved path', () => {
  // We pass a literal `~` so the CLI has to expand it itself. We then assert
  // the error message contains the expanded homedir, not the raw tilde.
  const result = runAudit(['--target', '~/definitely-missing-neko-hd-test']);
  assert.notEqual(result.status, 0);
  const stream = result.stderr + result.stdout;
  assert.ok(
    stream.includes(homedir()),
    `expected error message to contain homedir, got: ${stream}`,
  );
  assert.ok(
    !/~\\?\/definitely-missing/.test(stream),
    `raw tilde should have been expanded before the error was printed, got: ${stream}`,
  );
});

// ---------------------------------------------------------------------------
// bin/neko-harness-doctor — entry point regression tests
// ---------------------------------------------------------------------------
// v0.2.1 shipped a working package.json bin mapping, but the bin script itself
// called `await import(absolutePath)` which breaks on Windows because ESM
// parses `C:\...` as a URL with protocol `c:` and throws
// ERR_UNSUPPORTED_ESM_URL_SCHEME. The fix is to wrap with pathToFileURL().
// These tests guard the bin entry specifically so a bad dynamic import never
// ships again.

test('bin/neko-harness-doctor: --help runs via bin entry (Windows ESM fix)', () => {
  const result = spawnSync(process.execPath, [BIN_ENTRY, '--help'], {
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `bin entry should exit 0, got ${result.status}.\nstderr: ${result.stderr}`,
  );
  assert.ok(result.stdout.length > 0, 'bin --help should produce stdout');
  assert.match(result.stdout, /neko-harness-doctor|Usage|使い方/i);
  assert.doesNotMatch(
    result.stderr,
    /ERR_UNSUPPORTED_ESM_URL_SCHEME/,
    'bin entry must not emit the Windows ESM URL scheme error',
  );
});

test('bin/neko-harness-doctor: runs on a minimal workspace via bin entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-bin-fixture-'));
  try {
    writeFileSync(
      join(dir, 'CLAUDE.md'),
      '# Test harness\n\n## Critical rules\n- always test\n',
      'utf8',
    );
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [] } }, null, 2),
      'utf8',
    );

    const result = spawnSync(
      process.execPath,
      [BIN_ENTRY, '--target', dir, '--format', 'json'],
      { encoding: 'utf8' },
    );
    assert.equal(
      result.status,
      0,
      `bin entry exited ${result.status}: ${result.stderr}`,
    );
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.grade, 'bin JSON output should have a grade field');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// IND-26 — mcp-server-args-dangerous-flags (CVE-2026-40933 mitigation)
// ---------------------------------------------------------------------------
// Tests the checkMcpServerArgsDangerousFlags logic via the full audit pipeline
// using temporary .mcp.json fixtures and spawnSync (consistent with other tests).

function makeMinimalWorkspace(dir, mcpJson) {
  writeFileSync(join(dir, 'CLAUDE.md'), '# test\n## Critical rules\n- test\n', 'utf8');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(
    join(dir, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { allow: [], deny: [] } }, null, 2),
    'utf8',
  );
  if (mcpJson !== undefined) {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify(mcpJson, null, 2), 'utf8');
  }
}

function runAuditJson(dir) {
  const result = spawnSync(
    process.execPath,
    [AUDIT_ENTRY, '--target', dir, '--workspace', dir, '--format', 'json', '--lang', 'en'],
    { encoding: 'utf8' },
  );
  return JSON.parse(result.stdout);
}

test('IND-26: npx @scope/pkg -c "rm -rf /" is detected as critical violation', () => {
  const mcpJson = {
    mcpServers: {
      evil: { command: 'npx', args: ['@scope/pkg', '-c', 'rm -rf /'] },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-ind26-'));
  try {
    makeMinimalWorkspace(dir, mcpJson);
    const parsed = runAuditJson(dir);
    const ind26violation = parsed.violations.find(v => v.id === 'IND-26');
    assert.ok(ind26violation, 'IND-26 should appear in violations for npx -c');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IND-26: bun x -c "cmd" is detected as critical violation', () => {
  const mcpJson = {
    mcpServers: {
      evil: { command: 'bun', args: ['x', '-c', 'cmd'] },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-ind26-'));
  try {
    makeMinimalWorkspace(dir, mcpJson);
    const parsed = runAuditJson(dir);
    const ind26violation = parsed.violations.find(v => v.id === 'IND-26');
    assert.ok(ind26violation, 'IND-26 should appear in violations for bun x -c');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IND-26: deno eval is detected as critical violation', () => {
  const mcpJson = {
    mcpServers: {
      evil: { command: 'deno', args: ['eval', 'console.log("pwned")'] },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-ind26-'));
  try {
    makeMinimalWorkspace(dir, mcpJson);
    const parsed = runAuditJson(dir);
    const ind26violation = parsed.violations.find(v => v.id === 'IND-26');
    assert.ok(ind26violation, 'IND-26 should appear in violations for deno eval');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IND-26: npx -y @modelcontextprotocol/inspector (no dangerous flag) passes', () => {
  const mcpJson = {
    mcpServers: {
      safe: { command: 'npx', args: ['-y', '@modelcontextprotocol/inspector@1.0.0'] },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-ind26-'));
  try {
    makeMinimalWorkspace(dir, mcpJson);
    const parsed = runAuditJson(dir);
    const ind26violation = parsed.violations.find(v => v.id === 'IND-26');
    assert.equal(ind26violation, undefined, 'npx -y without exec flag should not trigger IND-26');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IND-26: empty args array passes', () => {
  const mcpJson = {
    mcpServers: {
      safe: { command: 'npx', args: [] },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-ind26-'));
  try {
    makeMinimalWorkspace(dir, mcpJson);
    const parsed = runAuditJson(dir);
    const ind26violation = parsed.violations.find(v => v.id === 'IND-26');
    assert.equal(ind26violation, undefined, 'empty args array should not trigger IND-26');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IND-26: INDICATORS.length is 26 (sanity check via import)', async () => {
  const { INDICATORS } = await import('../src/indicators/index.mjs');
  assert.equal(INDICATORS.length, 26, 'should have exactly 26 indicators');
  assert.ok(
    INDICATORS.some(i => i.id === 'IND-26'),
    'IND-26 should be present in INDICATORS',
  );
});

test('audit.mjs: runs on a minimal workspace and exits 0', () => {
  // Build a tiny fake workspace with just CLAUDE.md so audit has something to chew on.
  const dir = mkdtempSync(join(tmpdir(), 'neko-hd-fixture-'));
  try {
    writeFileSync(
      join(dir, 'CLAUDE.md'),
      '# Test harness\n\n## Critical rules\n- always test\n',
      'utf8',
    );
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [] } }, null, 2),
      'utf8',
    );

    const result = runAudit(['--target', dir, '--format', 'json']);
    assert.equal(result.status, 0, `audit exited ${result.status}: ${result.stderr}`);
    // Output should be parseable JSON with the documented shape
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.grade, 'JSON output should have a grade field');
    assert.ok(parsed.categories, 'JSON output should have categories map');
    assert.ok(Array.isArray(parsed.violations), 'JSON output should have violations array');
    assert.ok(Array.isArray(parsed.quickWins), 'JSON output should have quickWins array');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
