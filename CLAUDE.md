# neko-harness-doctor

Claude Code のハーネス（CLAUDE.md / settings.json / .mcp.json / hooks / skills / memory / MCP / workflow）を 25 のアンチパターン指標で自動診断し、S〜E グレードと Quick Wins（修正提案）を出力する CLI ツール。

## 技術スタック

- Node.js >= 18（ESM）
- 外部依存ゼロ（Node.js stdlib のみ）
- パッケージ名: `@aliksir/neko-harness-doctor`（npm）

## セットアップ

```bash
npm install -g @aliksir/neko-harness-doctor
```

ローカル開発（clone から）:

```bash
git clone https://github.com/aliksir/neko-harness-doctor.git
cd neko-harness-doctor
```

## ビルド

該当なし（ESM 単一ファイル構成のためビルド不要）

## テスト

```bash
node --test test/test.mjs
```

または:

```bash
npm test
```

## 開発規約

- `src/audit.mjs` の `INDICATORS` 配列が 25 指標の SSOT。ドキュメントと乖離したら SSOT 側を正とする
- CLI 本体は診断対象ファイルを一切変更しない（Read-only 原則）。修正は `--fix-mode propose` で JSON 出力し、Claude Code 側の Edit tool で適用する
- 外部ネットワーク通信（fetch / http）を追加しない
- runtime 依存はゼロを維持する。devDependencies（vitest 等）は許可
- 違反メッセージ・グレード説明・Quick Wins は日本語主体。英語は `--lang en` フラグで切替
- 新指標を追加する場合は fabrication 禁止。出典（ブログ記事・公式ドキュメント等）を必ず付ける
