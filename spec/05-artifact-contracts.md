# 05. Artifact Contracts

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. 決定的 build [DECIDED]

- 同一の入力（vault の内容 + 設定ファイル）に対して、build は同一内容の artifact を生成する（REQ-BUILD-001）。
- 検証方法: 同じ入力で 2 回 build し、出力ディレクトリ全体の content hash（例: 全ファイルの sha256 を集約したもの）が一致することを golden test で確認する。

## 2. v0.1 出力ファイル構成 [PROPOSED]

```
dist/
├── index.html            # トップページ（公開ノート一覧 or 最初のノート）
├── notes/
│   └── <note-id>.html    # 公開ノートごとのページ（本文 + backlink 一覧）
├── search-index.json     # 全文検索・タグ検索用インデックス
└── graph.json            # 最小 graph IR（public projection の nodes/edges）
```

- ファイル名・URL に非公開情報（元のファイルパス等）を使わない。`<note-id>` は公開用に生成される安定 ID（例: スラッグ）とする。
- 上記構成は v0.1 実装開始時に確定させる（現時点では PROPOSED）。

## 3. graph.json の最小 schema [PROPOSED]

```json
{
  "nodes": [
    { "id": "string", "title": "string", "tags": ["string"] }
  ],
  "edges": [
    { "source": "string", "target": "string", "kind": "wikilink|embed" }
  ]
}
```

- `path`、非公開 alias、非公開ノートへの参照は一切含めない（REQ-SEC-001）。
- schema は JSON Schema として定義し、schema validation で自動検証する（REQ-BUILD-002）。

## 4. search-index.json [OPEN]

- 全文検索エンジンの選定（自前の簡易転置インデックス か 既存ライブラリ）は実装ループで決定する。
- スキーマの詳細は実装開始時に確定する。

## 5. 非公開ビルドログ [DECIDED]

- REQ-PUB-004 に基づく warning（非公開ノートへの参照除去）は、`dist/` の外側（例: CLI の標準出力、または `.enastro/build.log` のような非公開ディレクトリ）にのみ出力し、`dist/` には一切含めない。

## 6. バージョニング [PROPOSED]

- artifact のファイル構成・schema が変わる場合は ADR を作成し、`graph.json` 等に schema version フィールドを含めることを検討する。v0.1 では単一バージョンのみを想定する。
