# fixtures/basic-vault

## 目的

通常の公開フロー（wikilink, backlink, alias/同名ノート衝突, broken link）を検証するための最小 vault。

対応 REQ: REQ-PUB-001, REQ-CONTENT-001〜004, REQ-CONTENT-006, REQ-CONTENT-007, REQ-GRAPH-002, REQ-GRAPH-003, REQ-BUILD-001, REQ-BUILD-002, REQ-UX-001〜004。

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

このディレクトリはまだプレースホルダーであり、実際のノートファイルは最初の vertical spec loop で作成する。
