// Test suite for neko-harness-doctor
// Uses Node.js built-in test runner (node --test) to keep zero dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '../src/utils.mjs';

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
