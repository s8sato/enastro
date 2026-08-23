# 04. Architecture

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. パイプラインの分離 [DECIDED]

```
Knowledge Base (Markdown vault)
        ↓ parse
Parsed Documents (frontmatter, wikilink/embed/tag 抽出)
        ↓ normalize + resolve
Knowledge Graph IR (nodes, edges, tags, publish flag)
        ↓ project
  ├── local projection  (全ノード)
  └── public projection (publish:true ノートのみ、非公開参照は除去済み)
        ↓ render
Static artifact (HTML + search index + 最小 graph JSON)
```

- parsing / graph IR 構築 / projection / rendering / publishing は明確に分離されたモジュールとする（設計原則）。
- public artifact は必ず public projection を経由して生成し、full IR や local projection から直接生成してはならない（REQ-PUB-002）。

## 2. 実装言語・runtime・配布形態 [DECIDED]

- v0.1 は TypeScript / Node.js で実装する。CLI として npm 経由で配布する。
- Knowledge Graph IR は言語非依存な形（プレーンな JSON 互換のデータ構造）で定義し、将来的に性能が必要なコンポーネント（graph engine 等）を Rust/WASM に置き換え可能な境界を保つ。
  - 具体的には、IR を生成するモジュールと、IR を消費して projection/rendering を行うモジュールの間に明確なデータ契約（[05-artifact-contracts.md](05-artifact-contracts.md)）を置く。
- v0.1 時点では Rust/WASM は導入しない（依存を増やさない方針、ADR-0005 参照）。

## 3. Graph IR の最小データモデル [PROPOSED]

v0.1 で必要な最小限のフィールドのみを定義する（詳細 schema は [05-artifact-contracts.md](05-artifact-contracts.md)）。

- Node: `id`, `title`, `aliases`, `tags`, `publish`, `path`（公開 artifact には path を含めない）
- Edge: `source`, `target`, `kind`（`wikilink` | `embed`）, `direction`（directed）

## 4. Graph layout の計算方針 [DECIDED（v0.2）]

- layout 座標を build 時に事前計算し、実行時にはユーザー操作に応じた物理演算・再配置のみを行うハイブリッド方式を v0.2 で実装する（REQ-GRAPH-005）。
- 事前計算には `d3-force` を用いる。public projection（REQ-PUB-002）のグラフのみを入力とし、坐標を `graph.json` に烘き込む（[05-artifact-contracts.md](05-artifact-contracts.md) 改訂対象、[ADR-0006](../decisions/ADR-0006-graph-layout-precomputation-strategy.md), [ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md) 参照）。

## 5. Rendering / distribution [DECIDED]

- 出力は静的ファイル一式であり、サーバーサイド runtime を必要としない（REQ-UX-004）。
- Graph UI の描画には WebGL 系ライブラリ（pixi.js）を v0.2 で新規導入する（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)）。IR を生成するモジュール（graph 層）と、IR を消費して rendering を行うモジュール（render 層の client 側）の境界は引き続き明確に保つ。

## 6. 未決事項 [OPEN]

- Graph IR の永続化フォーマット（JSON か、より効率的なバイナリか）は v0.2 の実装結果（fixtures/benchmark-vault での計測）を踏まえて後継ループで再検討する。
- Rust/WASM への移行タイミングとトリガー条件（性能未達の具体的閾値）は未定。ADR-0012 の目標を大幅に下回る場合の検討材料とする。
