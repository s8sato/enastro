# fixtures/compatibility-vault

## 目的

日本語ファイル名・Unicode、および非対応 OFM 構文の素通し（エラーにならないこと）を検証する vault。

対応 REQ: REQ-CONTENT-005, REQ-CONTENT-008。

## 想定するノート構成（実装ループで作成）

- `日本語のノート.md`: `publish: true`。日本語ファイル名・タイトルでの wikilink 解決を検証する。
- `絵文字-emoji-📘.md`: Unicode（絵文字含む）ファイル名の解決を検証する。
- `unsupported-syntax.md`: `publish: true`。callout (`> [!note]`)、見出しリンク (`[[note#heading]]`)、block 参照 (`[[note#^abc123]]`) 等、v0.1 非対応構文を含み、build がエラーにならずプレーンテキストとして扱われることを検証する。

## 検証方法

- unit test: 上記ファイルに対する parse がエラーを投げない。
- golden test: 非対応構文がそのままテキストとして出力に含まれる（変換や消失をしない）。

## 現状

このディレクトリはまだプレースホルダーであり、実際のノートファイルは content-semantics を扱う vertical slice loop で作成する。
