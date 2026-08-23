# fixtures/basic-vault

## 目的

通常の公開フロー（wikilink, backlink, alias/同名ノート衝突, broken link）を検証するための最小 vault。

対応 REQ: REQ-PUB-001, REQ-CONTENT-001〜004, REQ-CONTENT-006, REQ-CONTENT-007, REQ-GRAPH-001〜003, REQ-BUILD-001, REQ-BUILD-002, REQ-UX-001〜004。

## 想定するノート構成（実装ループで作成）

- `note-a.md`: `publish: true`。`note-b.md` へ `[[note-b]]` と `[[note-b|表示名]]` の両方でリンクする、少なくとも1つの `#tag` を持つ。
- `note-b.md`: `publish: true`。`note-a.md` からの backlink が生成されることを検証する対象。
- `note-c-alias.md`: `publish: true`。`aliases: [note-b]` のように、別ノートのタイトルと衝突する alias を持つ（REQ-CONTENT-006 の挙動確認用）。
- `note-d-broken-link.md`: `publish: true`。存在しないノートへの `[[does-not-exist]]` を含む。
- `enastro.config.*`（仮称）: publish 対象ディレクトリ等の最小設定。

## 検証方法

- unit test: パーサーが wikilink/embed/tag/frontmatter を正しく抽出する。
- golden test: 同一入力を 2 回 build して出力の content hash が一致する（REQ-BUILD-001）。
- schema validation: `graph.json` が [05-artifact-contracts.md](../../spec/05-artifact-contracts.md) の schema に適合する。

## 現状

`note-a.md`, `note-b.md`, `note-c-alias.md`, `note-d-broken-link.md` を作成済み。
これらは `src/parser/index.test.ts`（frontmatter/wikilink/embed/tag 抽出）と
`src/graph/build.test.ts`（node/edge/backlink 構築）の unit test から参照される。

`enastro.config.*` は未作成（publish selection を扱う次ループ以降で追加する）。

alias とタイトルの衝突（`note-c-alias.md` の `aliases: [note-b]` と `note-b.md` の
タイトルの衝突、REQ-CONTENT-006）は **候補A（タイトル一致を alias 一致より優先）**
で DECIDED 済み（[spec/02-content-semantics.md](../../spec/02-content-semantics.md) §2.2）。
`src/graph/resolve.ts` の `resolveTarget` がこの規則で `[[note-b]]` を常に
`note-b.md` に解決することを `src/graph/build.test.ts` で検証している。

Graph IR の node/edge/backlink 構築（REQ-GRAPH-001〜003）と broken link の非致命的な
扱い（REQ-CONTENT-007）は `src/graph/**` で実装済み。publish selection・privacy
projection（REQ-PUB-001〜005）・artifact 生成（REQ-BUILD-001/002, REQ-UX-001〜004）は
未実装であり、次ループ以降の対象。
