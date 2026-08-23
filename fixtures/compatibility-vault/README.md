# fixtures/compatibility-vault

## 目的

日本語ファイル名・Unicode、および非対応 OFM 構文の素通し（エラーにならないこと）を検証する vault。

対応 REQ: REQ-CONTENT-005, REQ-CONTENT-008。

## ノート構成

- `日本語のノート.md`: `publish: true`。日本語ファイル名・タイトルでの wikilink 解決を検証する。`絵文字-emoji-📘.md` へのリンクと、日本語のインラインタグ `#日本語タグ` を含む。
- `絵文字-emoji-📘.md`: `publish: true`。Unicode（絵文字含む）ファイル名の解決を検証する。
- `unsupported-syntax.md`: `publish: true`。callout (`> [!note]`)、見出しリンク (`[[note#heading]]`)、block 参照 (`[[note#^abc123]]`)、dataview コードブロック、canvas 風 JSON blob 等、v0.1 非対応構文を含み、build がエラーにならずプレーンテキストとして扱われることを検証する。

## 検証方法

- integration test（`src/build/site.compatibility.test.ts`）: `buildSite()` を実際にこの vault に対して実行し、
  - 日本語・絵文字ファイル名のノートが正しく discover・resolve され、`dist/notes/` に正しいファイル名で出力されること
  - `日本語のノート` → `絵文字-emoji-📘` の wikilink が解決され、`絵文字-emoji-📘` のページに backlink が生成されること（href は markdown-it により percent-encode される）
  - `graph.json` に3ノードの Unicode id が正しく含まれること
  - 非対応構文（callout, 見出しリンク, block 参照, dataview, canvas 風 JSON）が変換・消失なくそのまま出力 HTML に残ること

## 現状

実装済み（Loop 7）。`src/build/site.compatibility.test.ts` で artifact レベルの検証を行っている。
