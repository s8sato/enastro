# fixtures/privacy-vault

## 目的

privacy invariant（非公開情報の非漏洩）を検証するための vault。

対応 REQ: REQ-PUB-003, REQ-PUB-004, REQ-PUB-005, REQ-PUB-006, REQ-SEC-001, REQ-SEC-002。

## 想定するノート構成（実装ループで作成）

- `public-note.md`: `publish: true`。非公開ノート `private-note.md` へ `[[private-note]]` でリンクし、さらに `![[private-note]]` で embed する。
- `private-note.md`: `publish: false`（または未指定）。機微な名前・タグ・aliasを持つ。
- `attachments/public.png`: 公開ノートから参照され、かつ明示的に公開マークが付与された添付ファイル。
- `attachments/private.png`: 公開ノートから参照されているが、公開マークが付与されていない添付ファイル（公開されてはならない）。

## 検証方法

- privacy scan: 生成された `dist/` 配下の全ファイルを走査し、`private-note` というノート名・そのタイトル・タグ・alias・`private.png` というファイル名がどこにも出現しないことを確認する。
- golden test: `public-note` のレンダリング結果に、非公開ノートへの edge/リンクが一切存在しないことを固定の期待値と比較する。
- 非公開ビルドログには、除去された edge に関する warning が出力されることを確認する（公開物には出ないことも同時に確認）。

## 現状

このディレクトリはまだプレースホルダーであり、実際のノート・添付ファイルは privacy 検証を扱う vertical slice loop で作成する。
