# 06. UX and Visual Design

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. v0.1/v0.2 の主画面 [DECIDED]

- v0.1 の主画面はノート/ドキュメントビューである（REQ-UX-005）。Graph UI（星空 UI）は v0.1 に含めない（DEFERRED）。
- v0.2 では Graph UI を `graph.html` という**副画面**として追加する。ノート/ドキュメントビューは引き続き既定の着地点（主画面）のままとする（[ADR-0011](../decisions/ADR-0011-graph-ui-placement.md)）。
- 長期的には Graph UI を主画面に据える方針（製品構想と整合）。この移行方針・タイミングは v0.2 の human review フィードバックを踏まえた後続ループで再設計する。

## 2. v0.1 で提供する機能 [DECIDED]

- 全文検索（REQ-UX-001）
- タグによる検索・フィルタリング（REQ-UX-002）
- ノートごとの backlink 一覧（REQ-UX-003）
- 静的ホスティング可能な出力（REQ-UX-004）

## 2.1 v0.2 で追加する機能 [DECIDED]

- Graph UI（WebGL レンダラー・星表現・edge 上のエネルギー粒子表現、[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)）
- レスポンシブレイアウト + touch による pan/zoom 操作（REQ-UX-010）。WCAG 準拠等の包括的 accessibility 対応は対象外のまま。

## 3. Graph UI の視覚・interaction 仕様 [DECIDED（方針）/ PROPOSED（詳細パラメータ）]

- [ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md) により、Foam の `foam-graph`（force-graph + d3-force + `linkDirectionalParticles`）を概念上の参考にしつつ、WebGL（pixi.js）で再実装する方針を DECIDED とした。
- 星の視覚表現（色・サイズ・アニメーション）・edge 上のエネルギー粒子表現の具体的パラメータ（速度・密度・色等）は実装ループで PROPOSED として提示し、§4 の human review で確定する。

## 4. 「美しさ」の評価方法 [DECIDED]

- 視覚的な美しさ・操作感の心地よさは、自動テストでスコア化しない。
- これらは human review を必須の検証手段とし、[09-acceptance-and-evaluation.md](09-acceptance-and-evaluation.md) に明記する。

## 5. broken link / private-link のレンダリング表現 [OPEN]

- [02-content-semantics.md](02-content-semantics.md) §2.3, [03-publishing-semantics.md](03-publishing-semantics.md) §2.1 の具体的な見た目（例: グレーアウト、除去のみ、注記表示）は実装ループで PROPOSED として提示し、承認を得る。
