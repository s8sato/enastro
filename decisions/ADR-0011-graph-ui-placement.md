# ADR-0011: Graph UI Placement in v0.2 (Secondary Page)

## Status

PROPOSED

## Context

REQ-UX-005 は「v0.1 の主画面はノート/ドキュメントビューであり、Graph UI は主画面にしない。長期的には
Graph UI を主画面に据える方針」としており、方向性のみ DECIDED、詳細 UX は OPEN と記録されている
（[01-scope-and-requirements.md](../spec/01-scope-and-requirements.md) §4.4）。

v0.2 で Graph UI を実装するにあたり、これを直ちに主画面（サイトのトップページ）に据えるか、既存の
ノート一覧・ノートページを主画面のまま維持し、Graph UI を新しい副画面として追加するかを決める必要がある。

## Decision

- v0.2 では Graph UI を新しい独立ページ（`graph.html`）として追加する。既存のノート一覧
  （`index.html`）を引き続きサイトの既定の着地点とし、ナビゲーションから相互にリンクする
  （ノート一覧・ノートページから `graph.html` へのリンク、`graph.html` からノート一覧・個別ノートへの
  リンク）。
- Graph UI を主画面に格上げするかどうかは、v0.2 出荷後の human review フィードバック
  （[06-ux-and-visual-design.md](../spec/06-ux-and-visual-design.md) §4）を踏まえて後続バージョンで
  改めて判断する。

検討した代替案:

- Graph UI を直ちに主画面（トップページ）にする: REQ-UX-005 の長期方針に最短で到達できるが、
  初出のビジュアル・性能・操作感が未検証な段階でユーザーの初回体験を全面的に賭けるリスクが大きい。
  段階的移行のほうが安全と判断し不採用。

## Consequences

- REQ-UX-005 の「詳細 UX」部分のうち、v0.2 の扱いのみを DECIDED にする（長期の主画面化方針自体は
  引き続き OPEN のまま）。
- `renderIndexPage` / `renderNotePage` のナビゲーションに `graph.html` へのリンクを追加する実装が
  必要になる（[src/render/page.ts](../src/render/page.ts)）。
- 主画面化の再検討は、この ADR を変更する新しい ADR を伴う（AGENTS.md §1 の DECIDED 変更ルール）。
