# fixtures/basic-vault

## 目的

通常の公開フロー（wikilink, backlink, alias/同名ノート衝突, broken link）を検証するための最小 vault。

対応 REQ: REQ-PUB-001, REQ-CONTENT-001〜004, REQ-CONTENT-006, REQ-CONTENT-007, REQ-GRAPH-001〜003, REQ-BUILD-001, REQ-BUILD-002, REQ-UX-001〜004。

## 想定するノート構成（実装ループで作成）

- `note-a.md`: `publish: true`。`note-b.md` へ `[[note-b]]` と `[[note-b|表示名]]` の両方でリンクする、少なくとも1つの `#tag` を持つ。
- `note-b.md`: `publish: true`。`note-a.md` からの backlink が生成されることを検証する対象。
- `note-c-alias.md`: `publish: true`。`aliases: [note-b]` のように、別ノートのタイトルと衝突する alias を持つ（REQ-CONTENT-006 の挙動確認用）。
- `note-d-broken-link.md`: `publish: true`。存在しないノートへの `[[does-not-exist]]` を含む。

この vault には添付ファイルが存在しないため `enastro.config.json`（`publishAttachments` allowlist、
fixtures/privacy-vault 参照）は不要であり、作成していない。

## 検証方法

- unit test: パーサーが wikilink/embed/tag/frontmatter を正しく抽出する。
- golden test: 同一入力を 2 回 build して出力の content hash が一致する（REQ-BUILD-001）。
- schema validation: `graph.json` が [05-artifact-contracts.md](../../spec/05-artifact-contracts.md) の schema に適合する。

## 現状

`note-a.md`, `note-b.md`, `note-c-alias.md`, `note-d-broken-link.md` を作成済み。
これらは `src/parser/index.test.ts`（frontmatter/wikilink/embed/tag 抽出）と
`src/graph/build.test.ts`（node/edge/backlink 構築）の unit test から参照される。

alias とタイトルの衝突（`note-c-alias.md` の `aliases: [note-b]` と `note-b.md` の
タイトルの衝突、REQ-CONTENT-006）は **候補A（タイトル一致を alias 一致より優先）**
で DECIDED 済み（[spec/02-content-semantics.md](../../spec/02-content-semantics.md) §2.2）。
`src/graph/resolve.ts` の `resolveTarget` がこの規則で `[[note-b]]` を常に
`note-b.md` に解決することを `src/graph/build.test.ts` で検証している。

Graph IR の node/edge/backlink 構築（REQ-GRAPH-001〜003）と broken link の非致命的な
扱い（REQ-CONTENT-007）は `src/graph/**` で実装済み。publish selection・privacy
projection（REQ-PUB-001〜005）は `src/projection/**` で実装済み。

artifact 生成（`src/build/site.ts`）と Markdown→HTML レンダリング（`src/render/**`）
も実装済みで、この vault から `dist/index.html`, `dist/notes/<id>.html`,
`dist/graph.json`, `dist/search-index.json` を生成できる（REQ-BUILD-001/002,
REQ-CONTENT-007, REQ-UX-003/004）。検証内容:

- `src/render/substitute-links.test.ts`: wikilink/embed の3ケース（公開リンクへの
  置換・非公開ターゲットの完全削除・broken link の `.broken-link` span 化）。
- `src/build/site.test.ts`: この vault に対する統合テスト（出力ファイル一覧、
  `note-a` → `note-b` のリンク、`note-b` の backlink 表示、`note-d-broken-link`
  の broken-link span、`graph.json` の schema validation）。
- `src/build/site.golden.test.ts`: 同一 vault を2回 build し、出力の content hash
  が一致することを確認（REQ-BUILD-001）。
- `src/build/validate-graph-schema.test.ts`: `graph.json` の手書きバリデータの
  unit test（ajv 等の依存なし、REQ-BUILD-002）。

なお REQ-UX-001（全文検索）・REQ-UX-002（タグ検索/フィルタ）は `search-index.json`
の生成に加え、クライアントサイドの検索・タグ絞り込み UI（`src/render/client/filter.mjs`,
`src/render/client/search.mjs`, 依存なしの vanilla ESM）も実装済み。`renderIndexPage()`
が `index.html` に検索ボックス・タグフィルタ領域・`data-id` 付きノート一覧・
`<script type="module" src="assets/search.mjs">` を出力し、`buildSite()` が
`dist/assets/` にこれらのクライアントアセットをコピーする。JavaScript 無効時は
元のノート一覧がそのまま表示される（progressive enhancement）。検証内容:

- `src/render/client/filter.test.ts`: フィルタの純粋関数 `filterEntries()` の
  unit test（AND タグ一致、大小無視の部分一致、クエリ/タグ空時の全件マッチ等）。
- `src/build/site.search-ui.test.ts`: この vault に対する統合テスト（クライアント
  アセットがソースとバイト一致でコピーされること、`index.html` に検索/フィルタ
  UI 要素が含まれること）。

`fetch("search-index.json")` はブラウザの `file://` プロトコルでは CORS 制限に
より動作しないため、静的 HTTP サーバ経由での配信を前提とする。CLI（`bin/enastro.mjs`）
は最小実装済み。
