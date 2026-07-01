// hooks.mjs - Hooks indicators (IND-10 to IND-12, IND-31, IND-36 to IND-39)

import { basename, join } from 'path';
import { execSync } from 'child_process';
import { safeRead, parseJSON, findHookScripts, findSettingsJson, safeList } from '../utils.mjs';

/**
 * Detect if a hook script has some form of error handling.
 * Shell scripts and JS/TS scripts use different idioms.
 */
function hasErrorHandling(filePath, content) {
  const isShell = /\.sh$/i.test(filePath);
  if (isShell) {
    // Shell idioms: set -e / set -o errexit / trap ... ERR / || exit
    return /\bset\s+-e\b/.test(content)
      || /\bset\s+-o\s+errexit\b/.test(content)
      || /\btrap\s+['"]?[^'"]*['"]?\s+ERR\b/.test(content)
      || /\|\|\s*exit\b/.test(content);
  }
  // JS/mjs idioms: try/catch or process.on('uncaughtException')
  return /try\s*{[\s\S]*?catch/.test(content)
    || /process\.on\s*\(\s*['"]uncaught/.test(content);
}

/**
 * Check for inline ignore directive: `hd-ignore: IND-NN`
 * Allows authors to mark intentional violations (e.g. write-by-design hooks).
 */
function hasIgnoreDirective(content, indicatorId) {
  const re = new RegExp(`hd-ignore:\\s*${indicatorId}\\b`);
  return re.test(content);
}

const coreHooksIndicators = [
  {
    id: 'IND-10',
    category: 'hooks',
    name: 'hook-missing-error-handling',
    severity: 'major',
    evidence: 'Hook reliability best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true, note: 'no hooks found' };
      const bad = [];
      for (const f of files) {
        const c = safeRead(f);
        if (!c) continue;
        // Honor inline ignore directive
        if (hasIgnoreDirective(c, 'IND-10')) continue;
        if (!hasErrorHandling(f, c)) bad.push(basename(f));
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) lack error handling: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Add try/catch (JS) or `set -e` / `trap ... ERR` (shell) to all hook scripts. Inline opt-out: `hd-ignore: IND-10`',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-11',
    category: 'hooks',
    name: 'hook-side-effects',
    severity: 'major',
    evidence: 'Hook purity principle (read-only enforcement)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true };
      const bad = [];
      for (const f of files) {
        const c = safeRead(f);
        if (!c) continue;
        // Honor inline ignore directive (e.g. persistent-state hooks)
        if (hasIgnoreDirective(c, 'IND-11')) continue;
        if (/writeFileSync|appendFileSync|rmSync|unlinkSync|fetch\(|https?:\/\//i.test(c)) {
          bad.push(basename(f));
        }
      }
      if (bad.length > 0) {
        return {
          passed: false,
          violation: `${bad.length} hook(s) contain side effects: ${bad.slice(0, 3).join(', ')}`,
          remediation: 'Keep hooks read-only; avoid file writes and network calls. Inline opt-out: `hd-ignore: IND-11 — reason`',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-12',
    category: 'hooks',
    name: 'post-tool-use-overuse',
    severity: 'minor',
    evidence: 'Performance best practice',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true };
      const json = parseJSON(safeRead(settings));
      if (!json?.hooks?.PostToolUse) return { passed: true };
      const pt = json.hooks.PostToolUse;
      const count = Array.isArray(pt) ? pt.length : Object.keys(pt).length;
      if (count >= 10) {
        return {
          passed: false,
          violation: `PostToolUse hooks: ${count} (threshold 10)`,
          location: settings,
          remediation: 'Consolidate multiple hooks into one script or distribute to PreToolUse',
        };
      }
      return { passed: true };
    },
  },

  // -------------------------------------------------------------------------
  // v0.4 indicators (IND-31)
  // Source: designs/20260523_doctor-v0.4-roadmap.md
  // -------------------------------------------------------------------------

  {
    id: 'IND-36',
    category: 'hooks',
    name: 'hook-settings-unregistered',
    severity: 'major',
    evidence: 'code-wiring-principle.md — hooks/ にファイルがあるが settings.json に未登録',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true, note: 'hooks/ なし' };

      // settings.json から登録済みhookコマンドを収集
      const settings = findSettingsJson(ctx.target);
      if (!settings) return { passed: true, note: 'settings.json なし' };
      const json = parseJSON(safeRead(settings));
      if (!json?.hooks) return { passed: true, note: 'hooks セクションなし' };

      // 全hookエントリのcommandからファイル名を抽出
      const registered = new Set();
      for (const phase of ['PreToolUse', 'PostToolUse']) {
        const entries = json.hooks[phase];
        if (!Array.isArray(entries)) continue;
        for (const e of entries) {
          const cmd = e?.command || '';
          // "node path/to/hook.mjs" からbasename抽出
          const parts = cmd.split(/[\s/\\]+/);
          const last = parts[parts.length - 1];
          if (last) registered.add(last);
        }
      }

      // hooks/ 内ファイルで settings.json に未登録のものを検出
      const unregistered = [];
      for (const f of files) {
        const name = basename(f);
        if (hasIgnoreDirective(safeRead(f) || '', 'IND-36')) continue;
        if (!registered.has(name)) unregistered.push(name);
      }

      if (unregistered.length > 0) {
        return {
          passed: false,
          violation: `${unregistered.length} hook(s) が settings.json に未登録: ${unregistered.slice(0, 5).join(', ')}`,
          location: settings,
          remediation: 'settings.json の hooks.PreToolUse/PostToolUse にエントリを追加するか、不要なhookファイルを削除してください',
        };
      }
      return { passed: true };
    },
  },

  {
    id: 'IND-31',
    category: 'hooks',
    name: 'yoshi-binary-unavailable',
    severity: 'minor',
    evidence: 'yoshi token optimizer (CLAUDE.md yoshi section, feedback_no_external_api.md)',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      // Allow opt-out via env var (e.g. CI environments without yoshi)
      if (process.env.NEKO_HARNESS_SKIP_YOSHI) {
        return { passed: true, note: 'skipped via NEKO_HARNESS_SKIP_YOSHI' };
      }
      let stdout;
      try {
        stdout = execSync('yoshi --version', {
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString().trim();
      } catch {
        return {
          passed: false,
          violation: 'yoshi not on PATH or did not respond',
          remediation: 'Install yoshi (C:/work/yoshi/) and put it on PATH. Required for Bash output compression in `bash` hook scripts.',
        };
      }
      // Match "yoshi 0.6.0" or "0.6.0" or anything with a version number
      const m = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!m) {
        return {
          passed: false,
          violation: `yoshi --version returned unexpected output: ${stdout.slice(0, 60)}`,
          remediation: 'Upgrade yoshi to v0.6.0 or later (PowerShell deny avoidance requires v0.6+).',
        };
      }
      const major = parseInt(m[1], 10);
      const minor = parseInt(m[2], 10);
      // Require >= v0.6.0 (PowerShell deny avoidance, `yoshi git -C` requires v0.7.0)
      if (major === 0 && minor < 6) {
        return {
          passed: false,
          violation: `yoshi version ${m[0]} is below v0.6.0 (PowerShell deny avoidance requires v0.6+)`,
          remediation: 'Upgrade yoshi to v0.6.0+ (`yoshi git -C <path>` ergonomics requires v0.7.0+).',
        };
      }
      return { passed: true, note: `yoshi ${m[0]} detected` };
    },
  },

];

// ルール/ポリシー参照を検出するパターン（IND-38/39 共用）
const RULE_REF_RE = /rules\/|CLAUDE\.md|CR-[1-7]|tier[12]|pii[_-]|nightly|gates|destructive|Sprint|post-change|code-wiring|review-protocol|hooks-overview/i;

// -------------------------------------------------------------------------
// v0.5.0 結線検出指標 (IND-37/38/39)
// 出典: code-wiring-principle.md — ルール↔hookの接続関係チェック
// -------------------------------------------------------------------------
const wiringIndicators = [

  {
    id: 'IND-37',
    category: 'hooks',
    name: 'hooks-overview-drift',
    severity: 'major',
    evidence: 'code-wiring-principle.md — hooks-overview.md と実ファイルの乖離',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      // hooks-overview.md を読み込む（存在しない場合は PASS）
      const overview = safeRead(join(ctx.target, 'hooks', 'hooks-overview.md'));
      if (!overview) return { passed: true, note: 'hooks-overview.md not found' };

      // overview からバッククォート引用のhookファイル名を抽出
      const documented = new Set();
      for (const m of overview.matchAll(/`([a-z][-a-z0-9_.]*\.(?:mjs|sh|ps1))`/g)) {
        documented.add(m[1]);
      }

      // pre_tool_use / post_tool_use サブディレクトリの実ファイルを列挙
      const actual = new Set();
      for (const subdir of ['pre_tool_use', 'post_tool_use']) {
        const dir = join(ctx.target, 'hooks', subdir);
        for (const ent of safeList(dir)) {
          if (!ent.isFile()) continue;
          const name = ent.name;
          // バックアップ・テスト・隠しファイルはスキップ
          if (name.endsWith('.bak') || name.includes('.test.') || name.startsWith('.')) continue;
          if (/\.(mjs|sh|ps1)$/.test(name)) actual.add(name);
        }
      }

      // 差分を計算（overview に記載なし / ディスク上に存在しない）
      const undocumented = [...actual].filter(f => !documented.has(f));
      const missing = [...documented].filter(f => !actual.has(f));

      if (undocumented.length === 0 && missing.length === 0) return { passed: true };

      const parts = [];
      if (undocumented.length > 0) parts.push(`undocumented: ${undocumented.join(', ')}`);
      if (missing.length > 0) parts.push(`missing from disk: ${missing.join(', ')}`);

      return {
        passed: false,
        violation: `hooks-overview ドリフト: ${parts.join('; ')}`,
        location: join(ctx.target, 'hooks', 'hooks-overview.md'),
        remediation: 'hooks-overview.md を実 hook ファイルと一致するよう更新するか、不要なエントリを削除してください。',
      };
    },
  },

  {
    id: 'IND-38',
    category: 'hooks',
    name: 'hook-rule-reference-missing',
    severity: 'minor',
    evidence: 'code-wiring-principle.md — hook がどのルールを強制するか自己文書化',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true, note: 'no hooks found' };

      // ルール参照コメントがないhookファイルを収集
      const unreferenced = [];
      for (const f of files) {
        const content = safeRead(f);
        if (!content) continue;
        if (hasIgnoreDirective(content, 'IND-38')) continue;
        if (!RULE_REF_RE.test(content)) {
          unreferenced.push(basename(f));
        }
      }

      // 3件未満は許容（メトリクス系hook等、参照なしが正当なケースがある）
      if (unreferenced.length < 3) return { passed: true };

      return {
        passed: false,
        violation: `${unreferenced.length} 件の hook にルール/ポリシー参照がありません: ${unreferenced.slice(0, 5).join(', ')}`,
        remediation: 'hook ソースにルールを参照するコメントを追加してください（例: // Enforces: rules/X.md または // CR-N 準拠）。除外: hd-ignore: IND-38',
      };
    },
  },

  {
    id: 'IND-39',
    category: 'hooks',
    name: 'wiring-coverage-low',
    severity: 'minor',
    evidence: 'code-wiring-principle.md — 結線文書化の全体健全性',
    autoFixable: false,
    fixStrategy: null,
    check(ctx) {
      const files = findHookScripts(ctx.target);
      if (files.length === 0) return { passed: true, note: 'no hooks found' };

      // hooks-overview カバレッジ率を計算
      const overview = safeRead(join(ctx.target, 'hooks', 'hooks-overview.md'));
      const documented = new Set();
      if (overview) {
        for (const m of overview.matchAll(/`([a-z][-a-z0-9_.]*\.(?:mjs|sh|ps1))`/g)) {
          documented.add(m[1]);
        }
      }

      // 実ファイル集合を構築
      const actual = new Set();
      for (const subdir of ['pre_tool_use', 'post_tool_use']) {
        const dir = join(ctx.target, 'hooks', subdir);
        for (const ent of safeList(dir)) {
          if (!ent.isFile()) continue;
          const name = ent.name;
          if (name.endsWith('.bak') || name.includes('.test.') || name.startsWith('.')) continue;
          if (/\.(mjs|sh|ps1)$/.test(name)) actual.add(name);
        }
      }

      // overview カバレッジ率（実ファイルのうち overview に記載されている割合）
      const overviewRate = actual.size > 0
        ? [...actual].filter(f => documented.has(f)).length / actual.size
        : 1;

      // ルール参照カバレッジ率（ルール参照コメントがある hook の割合）
      let ruleRefCount = 0;
      for (const f of files) {
        const content = safeRead(f);
        if (!content) continue;
        if (RULE_REF_RE.test(content)) ruleRefCount++;
      }
      const ruleRefRate = files.length > 0 ? ruleRefCount / files.length : 1;

      // 総合カバレッジ = 2指標の平均
      const coverage = Math.round(((overviewRate + ruleRefRate) / 2) * 100);

      if (coverage >= 80) {
        return {
          passed: true,
          note: `結線カバレッジ: ${coverage}% (overview: ${Math.round(overviewRate * 100)}%, rule-ref: ${Math.round(ruleRefRate * 100)}%)`,
        };
      }

      return {
        passed: false,
        violation: `結線カバレッジ: ${coverage}% (overview: ${Math.round(overviewRate * 100)}%, rule-ref: ${Math.round(ruleRefRate * 100)}%)`,
        remediation: '結線文書化を改善してください: hooks-overview.md の更新、hook ソースへのルール参照コメント追加。',
      };
    },
  },
];

export const hooksIndicators = [...coreHooksIndicators, ...wiringIndicators];
