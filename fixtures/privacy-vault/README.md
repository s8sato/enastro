# fixtures/privacy-vault

## 目的

privacy invariant（非公開情報の非漏洩）を検証するための vault。

対応 REQ: REQ-PUB-003, REQ-PUB-004, REQ-PUB-005, REQ-PUB-006, REQ-SEC-001, REQ-SEC-002。

## 想定するノート構成（実装ループで作成）

- `public-note.md`: `publish: true`。非公開ノート `private-note.md` へ `[[private-note]]` でリンクし、さらに `![[private-note]]` で embed する。
- `private-note.md`: `publish: false`（または未指定）。機微な名前・タグ・aliasを持つ。
- `another-public-note.md`: `publish: true`。`public-note.md` へ `[[public-note]]` でリンクする（通常の公開間 edge/backlink が保持されることを確認する対照ケース）。
- `attachments/public.png`: 公開ノートから参照され、かつ明示的に公開マークが付与された添付ファイル。
- `attachments/private.png`: 公開ノートから参照されているが、公開マークが付与されていない添付ファイル（公開されてはならない）。

## 検証方法

- privacy scan: 生成された `dist/` 配下の全ファイルを走査し、`private-note` というノート名・そのタイトル・タグ・alias・`private.png` というファイル名がどこにも出現しないことを確認する。
- golden test: `public-note` のレンダリング結果に、非公開ノートへの edge/リンクが一切存在しないことを固定の期待値と比較する。
- 非公開ビルドログには、除去された edge に関する warning が出力されることを確認する（公開物には出ないことも同時に確認）。

## 現状

`public-note.md`, `private-note.md`, `another-public-note.md` を作成済み。
`src/projection/build.test.ts` で `buildPublicProjection`（REQ-PUB-001, 002, 003,
005, REQ-SEC-001）を検証している。具体的には:

- `private-note` が public projection の nodes/edges のいずれにも一切現れないこと
  （id・title・tags・alias の文字列レベルでの privacy scan 相当のテストを含む）
- `public-note` → `private-note` への wikilink と embed の両方の edge が除去されること
- `another-public-note` → `public-note` という通常の公開間 edge/backlink は保持される
  こと（対照ケース）
- 除去された edge について、著者向けの warning（関数の戻り値 `warnings: string[]`）が
  記録されること（REQ-PUB-004）。ただし実際のビルドログファイルへの出力・`dist/` 生成は
  CLI 実装ループ以降の対象であり、まだ存在しない。

`attachments/public.png`, `attachments/private.png` および添付ファイル allowlist
（REQ-PUB-006, REQ-SEC-002）は未実装。別途「添付ファイル公開」ループで扱う。
