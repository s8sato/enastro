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

このディレクトリはまだプレースホルダーであり、実際のノートファイルはサニタイズ実装を扱う vertical slice loop で作成する。
