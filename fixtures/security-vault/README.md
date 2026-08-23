# fixtures/security-vault

## 目的

悪意ある HTML/script を含むノートに対するサニタイズを検証する vault。

対応 REQ: REQ-SEC-003。

## 想定するノート構成（実装ループで作成）

- `xss-script-tag.md`: `<script>alert(1)</script>` を本文に含む。
- `xss-event-handler.md`: `<img src=x onerror="alert(1)">` のような属性ベースの攻撃を含む。
- `xss-javascript-uri.md`: `<a href="javascript:alert(1)">` のような URI スキームベースの攻撃を含む。
- `xss-svg.md`: SVG 内スクリプト実行 (`<svg onload=...>`) 等、HTML sanitizer が見落としやすいパターンを含む。

## 検証方法

- unit test: 上記いずれの入力に対しても、生成された HTML にスクリプト実行可能な要素（`<script>`, `on*` 属性, `javascript:` スキーム）が残らないことを確認する。
- 既知の HTML サニタイズライブラリのテストベクタを参考に、OWASP XSS Filter Evasion のパターンをいくつか採用することを検討する。

## 現状

`xss-script-tag.md`, `xss-event-handler.md`, `xss-javascript-uri.md`, `xss-svg.md` を
作成済み。`src/sanitize/{config,sanitize,index}.ts` に `sanitize-html`（allowlist 方式）
を用いた `sanitizeHtml()` を実装し、`src/sanitize/sanitize.test.ts` で検証している。

- `<script>` タグ、`onerror`/`onload` 等の `on*` 属性、`href="javascript:...` は
  出力から完全に除去される。
- `<svg>` はタグ allowlist に含めず、要素ごと除去する。
- 一方で `<strong>`, `<a href="https://...">` 等の許可済みタグ・属性は保持される
  （過剰除去でないことも確認）。

現時点ではノート本文（Markdown + 埋め込み raw HTML）に直接 `sanitizeHtml()` を適用して
検証しており、Markdown → HTML への変換（render ループ）はまだ存在しない。実際の公開
パイプラインでは、render 後の HTML に対しても同じ関数を適用する想定。
