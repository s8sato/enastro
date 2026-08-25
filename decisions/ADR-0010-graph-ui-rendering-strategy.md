# ADR-0010: Graph UI Rendering and Interaction Strategy (v0.2)

## Status

PROPOSED

## Context

v0.1 は Graph UI（星空 UI・WebGL レンダラー・エネルギー粒子表現）を明示的に対象外とした
（[ADR-0001](ADR-0001-v0.1-golden-path-and-exclusions.md)、REQ-GRAPH-004）。v0.1 の golden path
（content semantics / privacy semantics）が確立したため、v0.2 でこれに着手する。

[04-architecture.md](../spec/04-architecture.md) §5 は「D3/SVG を中心にした graph レンダラーは既定路線と
せず、着手時に WebGL 系 renderer を含めて再評価する」としていた。ユーザーは v0.2 の着手にあたり、
WebGL 系ライブラリの新規導入を希望し、視覚・interaction の参考実装として Foam の `foam-graph` パッケージ
（`packages/foam-graph/src/components/graph-canvas.ts`、`foam-graph.json`、`FoamPageSidebar.astro` の
埋め込みパターン）を挙げた。

Foam の実装を調査した結果、実態は WebGL ではなく Canvas 2D（`force-graph` ライブラリ + `d3-force` による
物理演算、`ctx.arc` 等での毎フレーム描画）である。ただし次の概念は enastro にも有用であるため、コード
そのものはコピーせず、概念のみを参考に再実装する。

- `d3-force` による力学レイアウト（node 間の斥力・edge のバネ・衝突回避）。
- `linkDirectionalParticles` に相当する、edge 上を移動する粒子（エネルギー粒子表現）。
- pan/zoom/fit-to-view、hover/click を custom event として発火する疎結合な component 設計。
- node サイズを近傍数（次数）にスケールさせる視覚エンコーディング。

## Decision

- Graph UI の描画には WebGL 系ライブラリを新規に導入する。第一候補は **pixi.js**
  （2D シーングラフに特化し、three.js のような 3D 機能を必要としない本用途に対して依存が軽く、
  sprite/particle 描画 API が充実している）。代替として regl（より低レベル、実装コストが高い）を検討したが、
  開発速度を優先し pixi.js を採用する。
- 物理演算（力学レイアウト）には `d3-force` を採用する。理由: Foam と同じ実績あるライブラリであり、
  レンダラー（pixi.js）から独立した純粋な計算ライブラリであるため、[ADR-0006](ADR-0006-graph-layout-precomputation-strategy.md)
  が定める「build 時事前計算 + 実行時ハイブリッド」の境界を保ちやすい。
- レイアウト座標は ADR-0006 の方針通り build 時に `d3-force` で事前計算し、`graph.json` に烘き込む
  （[05-artifact-contracts.md](../spec/05-artifact-contracts.md) 改訂対象）。実行時は事前計算済み座標を初期状態
  として使い、pan/zoom/drag 等のユーザー操作に応じた追加の物理演算のみを行う。
- edge のエネルギー粒子表現は、edge 上を一定速度で移動する発光スプライトとして実装する。速度・密度・色等の
  具体的パラメータは human review 前提の PROPOSED 事項とし、実装ループの中で調整し
  [06-ux-and-visual-design.md](../spec/06-ux-and-visual-design.md) §4 に従い human review で確定する。
- Foam のソースコードはコピーしない。参照した概念・API 形状はこの ADR に文章として記録し、enastro の
  データモデル（`GraphNode`/`GraphEdge`、public projection 前提の privacy invariant）に合わせて独自に実装する。

検討した代替案:

- three.js: 3D 対応が過剰（本用途は 2D の星空表現）で bundle サイズ・学習コストが増える。
- D3/SVG 継続: 大規模 graph（10,000 nodes / 50,000 edges、REQ-PERF-001）で DOM ノード数がボトルネックになりやすく、
  性能目標との相性が悪い。
- Foam と同じ Canvas 2D + force-graph: ユーザーが明示的に WebGL を希望したため不採用。

## Consequences

- REQ-GRAPH-004（Graph UI / WebGL レンダラー）を v0.2 で DECIDED とし実装する。
- pixi.js が新規の実行時依存として追加される（`package.json`）。
- `graph.json` の schema にレイアウト座標フィールドを追加する必要があり、
  [05-artifact-contracts.md](../spec/05-artifact-contracts.md) の改訂と手書きバリデータの更新を伴う。
- 新しい artifact 面（graph.json の座標・pixi.js クライアントコード）が privacy invariant
  （REQ-SEC-001）を破らないことを、実装ループで privacy-vault の新規テストとして必ず検証する。
- エネルギー粒子の進行方向は、human review の結果ユーザーが `graph.html` 上でトグル可能な設定
  （REQ-UX-012, PROPOSED）とした。既定は「dependency-first」（参照先→参照元、知識の積み上げ方向）、
  代替は wikilink の方向そのまま（`edge.source` → `edge.target`）。どちらも graph IR の
  `edge.source`/`edge.target` 自体は変更しない、render 層（`graph-view.mjs`）限定の設定。
