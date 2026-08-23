# 05. Artifact Contracts

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. 決定的 build [DECIDED]

- 同一の入力（vault の内容 + 設定ファイル）に対して、build は同一内容の artifact を生成する（REQ-BUILD-001）。
- 検証方法: 同じ入力で 2 回 build し、出力ディレクトリ全体の content hash（例: 全ファイルの sha256 を集約したもの）が一致することを golden test で確認する。

## 2. v0.1 出力ファイル構成 [PROPOSED]

```
dist/
├── index.html            # トップページ（公開ノート一覧）
├── graph.html            # Graph UI ページ（v0.2, ADR-0010/0011）
├── notes/
│   └── <note-id>.html    # 公開ノートごとのページ（本文 + backlink 一覧）
├── search-index.json     # 全文検索・タグ検索用インデックス
├── graph.json            # graph IR（public projection の nodes/edges + 事前計算済みレイアウト座標）
└── assets/
    ├── site.css
    ├── graph-view.mjs     # Graph UI クライアントスクリプト（v0.2）
    ├── pixi.min.mjs       # vendored WebGL レンダラー（v0.2, ADR-0010）
    └── ...（search.mjs 等、既存のクライアントスクリプト）
```

- ファイル名・URL に非公開情報（元のディレクトリ構成等）を使わない。`<note-id>` はファイル名（拡張子を除いたもの、NFC 正規化）であり、vault 内で一意である必要がある（REQ-CONTENT-009、[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)）。
- 上記構成は v0.1 実装開始時に確定させる（現時点では PROPOSED）。`graph.html`・`assets/graph-view.mjs`・`assets/pixi.min.mjs` は v0.2 で追加された（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)、[ADR-0011](../decisions/ADR-0011-graph-ui-placement.md)）。

## 3. graph.json の schema [DECIDED（v0.2, ADR-0006/0010/0012）]

```json
{
  "nodes": [
    { "id": "string", "title": "string", "tags": ["string"], "x": 0.0, "y": 0.0 }
  ],
  "edges": [
    { "source": "string", "target": "string", "kind": "wikilink|embed" }
  ]
}
```

- `path`、非公開 alias、非公開ノートへの参照は一切含めない（REQ-SEC-001）。
- `x`/`y` は build 時に公開 projection のみを対象として決定的な force-directed layout（d3-force、固定 tick 数、乱数不使用）で事前計算された座標であり（REQ-BUILD-001 の決定的 build を維持）、Graph UI（`graph.html`）がブラウザ内でレイアウト計算を行わずに済むようにするためのものである。
- schema はハンドライトの structural validator（`src/build/validate-graph-schema.ts`）で自動検証する（REQ-BUILD-002）。closed whitelist のため、`id`/`title`/`tags`/`x`/`y` 以外のフィールドを持つノードはエラーになる。

## 4. search-index.json [OPEN]

- 全文検索エンジンの選定（自前の簡易転置インデックス か 既存ライブラリ）は実装ループで決定する。
- スキーマの詳細は実装開始時に確定する。

## 5. 非公開ビルドログ [DECIDED]

- REQ-PUB-004 に基づく warning（非公開ノートへの参照除去）は、`dist/` の外側（例: CLI の標準出力、または `.enastro/build.log` のような非公開ディレクトリ）にのみ出力し、`dist/` には一切含めない。

## 6. バージョニング [PROPOSED]

- artifact のファイル構成・schema が変わる場合は ADR を作成し、`graph.json` 等に schema version フィールドを含めることを検討する。v0.1 では単一バージョンのみを想定する。
