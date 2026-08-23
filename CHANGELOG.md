# Changelog

本プロジェクトのバージョンは [Semantic Versioning](https://semver.org/lang/ja/) に準拠する。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) を参考にする。

## [0.1.0] - 2026-08-23

v0.1 の golden path（最小構成での「安全な公開」の実現）を満たす最初のリリース。

### 追加

- **公開選択・privacy invariant**: frontmatter の `publish: true` によるノート選択、非公開ノートへの
  wikilink/embed edge の除去と build 時 warning、添付ファイルの allowlist 制御
  （REQ-PUB-001〜007, REQ-SEC-001〜002, ADR-0001, ADR-0002, ADR-0003）。
- **content semantics**: wikilink `[[note]]` / alias `[[note|alias]]` / embed `![[note]]` / `#tag` /
  YAML frontmatter の解釈、非対応 Obsidian 構文（callout・block 参照など）の非エラー素通し、
  日本語・Unicode ファイル名の解決、broken link の非致命化
  （REQ-CONTENT-001〜008）。
- **note id/title 分離**: ノート ID はファイル名（NFC 正規化、vault 内一意、衝突時は build 失敗）、
  タイトルは本文中の最初の H1（存在しなければ ID）とする方針を採用（REQ-CONTENT-009, ADR-0009）。
- **Knowledge Graph IR**: wikilink の directed edge 化、backlink の導出（REQ-GRAPH-001〜003）。
- **HTML サニタイズ**: ユーザー由来 HTML/script の XSS 対策サニタイズ（REQ-SEC-003, ADR-0002）。
- **決定的 build**: 同一入力から同一 content-hash の artifact を生成、`graph.json` の手書きスキーマ
  バリデーション（REQ-BUILD-001〜002, ADR-0005）。
- **UX**: 全文検索、タグによる検索・フィルタリング、ノートごとの backlink 表示、静的ホスティング
  可能な portable artifact、一覧ページへのナビゲーションリンク、最終更新日時（mtime）の表示、
  `#tag` のフィルタリンク化（REQ-UX-001〜008）。
- `LICENSE`（Apache License 2.0、ADR-0007）を追加。

### v0.1 で対象外（DEFERRED）

以下は構想には含まれるが、v0.1 では実装しない
（詳細は [spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) §3 参照）。

- Graph UI / WebGL レンダラー・エネルギー粒子表現
- ローカル AI・Web AI 向けの MCP / CLI query interface
- private → CI → public repo の自動公開パイプライン
- 非 Obsidian 入力形式への対応
- mobile 対応・accessibility 対応
- 10,000 nodes / 50,000 edges 規模の性能最適化
- 複数 vault の同時対応
- VS Code 拡張

### 既知の制約

- npm へのパッケージ公開は未実施（`package.json` は `private: true` のまま）。
- REQ-UX-005（Graph UI を将来の主画面とする方向性）は方向性のみ DECIDED、詳細 UX は OPEN。
- REQ-PERF-001（大規模 vault での性能目標）は reference environment 未決定のため DEFERRED / OPEN。
