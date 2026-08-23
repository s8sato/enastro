# enastro

enastro は、Obsidian vault の中から公開したいノートだけを選び、プライバシーを守りながら
静的な Knowledge Graph サイトとして書き出す CLI ツールです。

## コンセプト

- 手元の Obsidian vault には公開ノートと非公開ノートが混在している。
- frontmatter に `publish: true` を持つノートだけが公開対象になる。
- 非公開ノートへの wikilink・embed・タグ・alias・存在そのものは、公開 artifact に一切漏洩しない
  （privacy invariant）。
- 出力は HTML + 検索用 JSON のみで構成された、サーバーサイド runtime 不要の静的サイト。
  GitHub Pages 等へのデプロイはユーザーが手動で行う想定（v0.1 では自動公開パイプラインは持たない）。

詳しい設計思想は [spec/00-product-vision.md](spec/00-product-vision.md) を、v0.1 のスコープと除外機能は
[spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) を参照してください。

## v0.1 でできること

- Markdown frontmatter（`publish`, タグ相当のフィールド）の解釈
- wikilink `[[note]]` / alias 付き `[[note|alias]]` / embed `![[note]]` / `#tag` の解釈
- 非公開ノートへの参照を安全に除去した public projection の生成
- 添付ファイルは allowlist マークがある場合のみ公開
- 決定的（deterministic）な静的 artifact の生成（同一入力 → 同一 content-hash）
- ノートごとの backlink 表示、全文検索、タグによる検索・フィルタリング

v0.1 では Graph UI（星空 UI）・MCP/CLI query interface・自動公開パイプラインなどは対象外です。
詳細は [spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) §3 を参照してください。

## クイックスタート

```bash
npm install
npm run build   # TypeScript のコンパイル + クライアント資産のコピー
npx enastro <vaultDir> [outDir]   # 既定の出力先は ./dist
```

生成された `outDir`（既定 `dist/`）は静的ファイルのみで構成されているため、任意の静的ホスティングに
そのまま配置できます。ローカルで確認する場合は、`outDir` を任意の静的サーバーで配信してください
（`file://` で直接開くとブラウザの制約により一部機能が動作しない場合があります）。

## 開発者向け

```bash
npm test         # vitest によるテスト一式（unit / golden / privacy scan / security / compatibility / e2e）
npm run typecheck
npm run build
```

- `spec/` — 正本となる仕様書（要件・アーキテクチャ・受け入れ基準など）
- `decisions/ADR-*.md` — 個々の設計判断（Architecture Decision Record）
- `fixtures/` — 各 REQ の検証に使う vault fixture 群
- `LOOP.md` — 実装作業の進め方（loop engineering）
- `AGENTS.md` — このリポジトリで作業するすべてのエージェント・開発者に適用される規約

仕様と実装の対応関係（traceability）は
[spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) §5 および
[spec/09-acceptance-and-evaluation.md](spec/09-acceptance-and-evaluation.md) を参照してください。

## ライセンス

[Apache License 2.0](LICENSE)（[ADR-0007](decisions/ADR-0007-oss-license.md) 参照）。
