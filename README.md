# neko-harness-doctor

> Claude Code のハーネスを 25 のアンチパターン指標で自動診断する、無料・オープンソースの CLI ツール

[English README](./README.en.md) | 日本語

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-blue.svg)

## これは何

あなたの Claude Code 環境（`CLAUDE.md` / `settings.json` / `.mcp.json` / `hooks/` / `skills/` / `memory/` / `MCP` / `workflow`）を **25 のアンチパターン指標** で自動診断し、**S〜E のグレード** と **優先順位付き Quick Wins（改善提案）** を出力します。

## なぜ必要か

Claude Code の出力品質がセッションごとにバラつく原因の多くは **ハーネス設計の構造的欠陥** にあります:

- `CLAUDE.md` が肥大化して KV-Cache 効率が悪化している
- 重要なルールが中盤に埋もれていて Claude が読み落とす（Lost in the Middle）
- `bypassPermissions` が有効になっていて気付かないうちに危険操作が実行されている
- Skill の description が短すぎて Claude が正しく選択できない
- MCP サーバーのバージョンが固定されていない

これらは個別に手で確認すると膨大な作業ですが、このツール1本で5〜15秒で全部チェックできます。

## 特徴

- **25 アンチパターン指標**: 7 カテゴリを横断診断（CLAUDE.md構造 / settings / hooks / skills / memory / MCP / workflow）
- **S〜E グレード評価**: ハイブリッド方式（PASS率 + Critical即降格、最大3段）
- **Quick Wins**: 優先順位付き改善提案（デフォルト上位5件）
- **対話的修正フロー**: `--fix-mode propose` で修正提案を JSON 出力。Claude Code 側で承認→ Edit tool で適用する透明なワークフロー
- **Read-only**: CLI 本体は診断対象を**一切変更しません**。修正は常にユーザー承認後
- **機械判定優先**: LLM 不使用、grep / AST / JSON 解析で**決定性**を保証
- **i18n**: 日本語デフォルト、`--lang en` で英語切替
- **依存ゼロ**: Node.js 18+ のみ、`npm install` 後すぐ実行可能

## インストール

### npm（推奨）

```bash
npm install -g @aliksir/neko-harness-doctor
```

### GitHub clone

```bash
git clone https://github.com/aliksir/neko-harness-doctor.git
cd neko-harness-doctor
node bin/neko-harness-doctor --help
```

## クイックスタート

```bash
# ~/.claude/ を診断
neko-harness-doctor

# 特定のディレクトリを診断
neko-harness-doctor --target ~/.claude --workspace ~/work/myproject

# カテゴリ絞り込み
neko-harness-doctor --category claude-md

# JSON 出力
neko-harness-doctor --format json

# 英語切替
neko-harness-doctor --lang en

# 修正提案モード（Claude Code から呼ぶとき）
neko-harness-doctor --fix-mode propose --format json
```

## 出力例

```markdown
# neko-harness-doctor 診断結果

- **対象**: ~/.claude
- **総合グレード**: C (基本 B から Critical 1件で 1段降格)
- **PASS率**: 17/25 (68.0%)
- **Critical違反**: 1
- **実行時刻**: 2026-04-11T21:48:00.000Z

## カテゴリ別スコア

| カテゴリ | PASS/指標 | Critical | Major | Minor |
|---|---|---|---|---|
| CLAUDE.md構造 | 2/5 | 1 | 1 | 1 |
| settings.json | 4/4 | 0 | 0 | 0 |
| Hooks | 1/3 | 0 | 2 | 0 |
| Skills | 1/4 | 0 | 2 | 1 |
| Memory | 3/3 | 0 | 0 | 0 |
| MCP | 3/3 | 0 | 0 | 0 |
| Workflow | 3/3 | 0 | 0 | 0 |

## 検出された問題

### [CRITICAL] IND-03: critical-rules-not-in-first-third
- **検出箇所**: ~/.claude/CLAUDE.md
- **違反**: Earliest critical-rule heading at position=80.2% (outside first third)
- **出典**: Liu et al. 2023 "Lost in the Middle" (arXiv:2307.03172)
- **修正例**: Move critical rules to the first third (position 0 to 0.3) to avoid Lost-in-the-Middle
- **自動修正**: 手動のみ

## Quick Wins（優先順位）

1. **[CRITICAL]** IND-03 critical-rules-not-in-first-third — Move critical rules to the first third
2. **[MAJOR]** IND-05 volatile-elements-not-at-tail — Consolidate volatile elements at the tail
3. **[MAJOR]** IND-10 hook-missing-error-handling — Add try/catch to all hook scripts
...
```

## 対話的修正フロー（Claude Code 連携）

`--fix-mode propose` を使うと、修正提案を JSON で出力できます。Claude Code はこれを読んで、ユーザーに承認を求めた上で `Edit` tool を使って修正を適用します:

```json
[
  {
    "indicator": "IND-06",
    "autoFixable": true,
    "fixStrategy": "remove-bypass-permissions",
    "severity": "critical",
    "target": "/path/to/settings.json",
    "description": "\"bypassPermissions\": true is set",
    "evidence": "Principle of least privilege",
    "diff": {
      "before": "{ \"bypassPermissions\": true, ... }",
      "after": "{ ... }"
    }
  },
  {
    "indicator": "IND-03",
    "autoFixable": false,
    "severity": "critical",
    "target": "/path/to/CLAUDE.md",
    "description": "...",
    "manualSteps": [
      "Move critical rules to the first third (position 0 to 0.3)",
      "Review CLAUDE.md and refactor per the remediation guidance."
    ]
  }
]
```

**原則**: CLI は提案のみ。実際の修正はユーザー承認後に Claude Code が `Edit` tool で行うため、完全に透明で差分プレビュー可能です。

## 25 指標の一覧

| カテゴリ | 指標数 | 主な内容 |
|---|---|---|
| CLAUDE.md構造 | 5 | 行数肥大化 / プレフィックス不安定 / Lost in the Middle / 重複セクション / 時変要素の末尾配置 |
| settings.json | 4 | bypassPermissions / auto-accept全許可 / permissions過剰 / hooks未設定 |
| Hooks | 3 | エラーハンドリング欠落 / 副作用リスク / PostToolUse乱用 |
| Skills | 4 | description不十分 / trigger曖昧 / risk未設定 / namespace衝突 |
| Memory | 3 | MEMORY.md肥大化 / lesson散逸 / ポインタ切れ |
| MCP | 3 | バージョン固定なし / 説明文不十分 / サプライチェーン未検証 |
| Workflow | 3 | ゲート定義不在 / 計画書運用不備 / review-protocol不在 |

詳細は [docs/indicators.md](./docs/indicators.md) を参照。

## グレード仕様

基本グレードは PASS 率で決定、Critical 違反 1 件につき 1 段階降格（最大3段）。

| グレード | PASS率 |
|---|---|
| S | ≥ 90% |
| A | ≥ 75% |
| B | ≥ 60% |
| C | ≥ 45% |
| D | ≥ 30% |
| E | < 30% |

詳細は [docs/grading.md](./docs/grading.md) を参照。

## 設定ファイル

`~/.neko-harness-doctor/config.json` で MCP publisher allowlist 等を拡張できます:

```json
{
  "mcp": {
    "publisherAllowlist": [
      "@anthropic-ai",
      "@my-org",
      "@trusted-vendor"
    ]
  }
}
```

詳細は [docs/configuration.md](./docs/configuration.md) を参照。

## オプション一覧

```
--target <path>       診断対象ディレクトリ（デフォルト: ~/.claude/）
--workspace <path>    plans/checklist/rules等を探す作業ディレクトリ
--format <fmt>        出力形式 json|markdown（デフォルト: markdown）
--category <name>     特定カテゴリのみ診断
--severity <level>    最小Severity critical|major|minor（デフォルト: minor）
--top <n>             Quick Wins の上位件数（デフォルト: 5）
--fix-mode <mode>     修正提案モード: off|propose（デフォルト: off）
--lang <lang>         出力言語 ja|en（デフォルト: ja）
--quiet               違反のみ表示
--help                ヘルプ表示

環境変数:
  NEKO_HARNESS_WORKSPACE  --workspace のフォールバック

終了コード:
  0 - 診断完了
  1 - 診断対象が見つからない
  2 - 内部エラー
```

## 既存の類似ツールとの違い

| ツール | 守備範囲 | neko-harness-doctor との関係 |
|---|---|---|
| `skill-security-check` | Skill 単体のセキュリティ監査 | 補完（本ツールは Skill 構造の横断監査のみ） |
| `cc-skill-security-review` | コード変更のセキュリティレビュー | 補完（本ツールは実装済み設定の監査） |
| `analyze-permissions` | settings.json 権限分析 | 補完（本ツールはさらに広い8領域を横断診断） |

## FAQ

**Q: LLM を呼び出しますか？**
A: いいえ。全て grep / AST / JSON 解析で決定的に判定します。同じ入力なら常に同じ出力です。CI 統合に最適。

**Q: ファイルを書き換えますか？**
A: **CLI 本体は一切書き換えません**。修正は `--fix-mode propose` で提案 JSON を出力するところまで。実際の適用は Claude Code が `Edit` tool で行います（ユーザー承認後）。

**Q: 依存パッケージは？**
A: runtime 依存ゼロ。Node.js 18+ の stdlib のみで動作します。

**Q: 指標を追加・カスタマイズできますか？**
A: v0.2.0 時点ではビルトイン 25 指標のみ。ユーザー定義指標は将来検討。publisher allowlist 等の閾値は `~/.neko-harness-doctor/config.json` で拡張可能。

## ライセンス

[MIT](./LICENSE)

## Acknowledgments

- **Liu et al. 2023** "Lost in the Middle" (arXiv:2307.03172) — IND-03 の根拠
- **Anthropic Prompt Caching Guide** — IND-01/02/05 の根拠
- **OpenSSF Secure Supply Chain Best Practices** — IND-20/22 の根拠
- **IEEE peer review standard / Four Eyes Principle** — IND-25 の根拠

## ロードマップ

- [x] **v0.1.0** — 25指標初版、i18n、fix-mode=propose
- [x] **v0.2.0** — shell hook 対応（IND-10）、`hd-ignore` インライン除外、外部スキル除外（`--skip-external`）、CRLF パースバグ修正、CI/テストスイート
- [ ] **v0.3.0** — ESLint 導入、ユーザー定義指標、MCPツール説明文の実測（起動時動的取得）
- [ ] **v0.4.0** — IND-22 の postinstall 実測統合
- [ ] **v1.0.0** — 安定版リリース
