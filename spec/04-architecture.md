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

## 4. Graph layout の計算方針 [DEFERRED]

- 将来的には、layout 座標を build 時に事前計算し、実行時にはユーザー操作に応じた物理演算・再配置のみを行うハイブリッド方式を採用する方針（REQ-GRAPH-005）。
- v0.1 では Graph UI 自体を実装しないため、この方針は設計メモとして記録するのみで実装しない。

## 5. Rendering / distribution [DECIDED]

- 出力は静的ファイル一式であり、サーバーサイド runtime を必要としない（REQ-UX-004）。
- D3/SVG を中心にした graph レンダラーは既定路線とせず、v0.1 以降に着手する際に WebGL 系 renderer を含めて再評価する（設計原則: 技術選定は既定路線としない）。

## 6. 未決事項 [OPEN]

- Graph IR の永続化フォーマット（JSON か、より効率的なバイナリか）は、Graph UI 着手時に性能要件と合わせて再検討する。
- Rust/WASM への移行タイミングとトリガー条件（性能未達の具体的閾値）は未定。
