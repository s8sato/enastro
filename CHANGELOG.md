# Changelog

本プロジェクトのバージョンは [Semantic Versioning](https://semver.org/lang/ja/) に準拠する。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) を参考にする。

## [0.2.0] - 2026-08-23

v0.1 の golden path の上に、Graph UI・性能測定・レスポンシブスタイリング・CI/Pages 自動公開を追加。

### 追加

- **Graph UI（星空グラフ + エネルギー粒子表現）**: pixi.js による WebGL レンダラーを新しい独立ページ
  `graph.html` として追加。d3-force による build 時の決定的なレイアウト事前計算（`graph.json` に
  `x`/`y` を追加）、ノード（次数に応じたサイズ・配色）・edge・edge 上を流れるアニメーション粒子の描画、
  pan/zoom/pinch とノードクリックによるノートページ遷移に対応（REQ-GRAPH-004〜005,
  REQ-UX-009〜010, ADR-0006, ADR-0010〜0012）。
- **性能測定**: 10,000 notes / 50,000 edges 規模の `fixtures/benchmark-vault` 生成スクリプト
  （`npm run generate:benchmark-vault`）と、build 時間・初回インタラクティブフレーム・タグ
  フィルタ latency・pan/zoom FPS を計測する `scripts/bench.mjs`（`npm run bench`）を追加
  （REQ-PERF-001, ADR-0012）。計測結果（p50/max）は
  [spec/07-performance.md](spec/07-performance.md) の目標と比較して報告済み。first interactive
  frame（p50 379.8ms）とタグフィルタ latency（p50 83.0ms）は目標を達成した一方、pan/zoom FPS
  （約 5fps、10,000 ノード規模での個別 `PIXI.Graphics` 描画に起因）と build 時間（p50 約 60 秒）は
  今後の最適化候補として引き続き未対応のまま報告する（LOOP.md の「計測と最適化の分離」方針に
  従い、目標未達を理由に測定基準を緩めない）。
- **レスポンシブ・ダークテーマスタイリング**: ノートページ・一覧ページ・Graph UI に共通する
  `assets/site.css` を新設し、PC・モバイル双方のビューポートに対応するレイアウトを追加
  （REQ-UX-009）。
- **CI / GitHub Pages 自動公開**: `ci.yml`（typecheck・test の自動実行）に加え、
  `fixtures/demo-vault`（PKM をテーマにした約 20 件のサンプルノート、privacy invariant と
  broken link の実演を含む）を `.github/workflows/deploy-demo.yml` で自動ビルドし、公式の
  `actions/upload-pages-artifact` / `actions/deploy-pages` のみを用いて GitHub Pages へ
  自動公開するパイプラインを追加。エンドユーザーが自分の vault を同様に公開できる、独立した
  再利用可能な workflow テンプレートを README に追加（REQ-OPS-002〜003, ADR-0013）。
- **build 時シンタックスハイライト**: markdown コードブロックを highlight.js による静的（ビルド時）
  ハイライトに対応。クライアント JS の追加なしで言語別の配色を実現し、REQ-UX-004（portable static
  artifact）・REQ-BUILD-001（決定的 build）を維持したまま、sanitize allowlist（REQ-SEC-003）を
  `.hljs` 系クラスに拡張。
- **markdown 記法ショーケースノート**: `fixtures/demo-vault` に、対応済みの Markdown/OFM 記法
  （箇条書き・強調・打ち消し線・インラインコード・コードブロック・引用・テーブル・画像埋め込み等、
  REQ-CONTENT-001〜005）を一望できるデモノートを追加。
- **Graph UI の細部改善**: タッチ操作でのノードプレビュー（1 回目のタップでハイライトのみ、2 回目の
  タップでノートページへ遷移）とマウスホバーの動作を分離し、モバイルで指がラベルを隠して確認できない
  問題を解消。全ノードのエネルギー粒子放出タイミングを単一の共有サイクルタイマーへ統一し、edge ごとに
  バラバラだった発光アニメーションを同期（REQ-UX-010）。
- **ダークテーマの視認性改善**: 記事本文のコントラスト調整、コードブロック/インラインコード・引用・
  テーブル・見出しレベルのスタイリングを他要素と統一し、判別しにくかった箇所を改善（REQ-UX-009）。

### サプライチェーンセキュリティ強化

- `ci.yml` / `deploy-demo.yml` の GitHub Actions 参照をすべて可変タグ（`@v4` 等）からコミット SHA
  固定に変更し、上流タグの付け替えによる CI 改ざんリスクを低減。
- `ci.yml` に `permissions: contents: read` を明示（最小権限化）し、`npm audit signatures` /
  `npm audit --audit-level=high` の CI ステップを追加。
- `.github/dependabot.yml` を新設し、npm / github-actions の週次更新 PR を有効化（SHA 固定により
  止まるバージョン追従を補う）。
- `package.json` に `engines.node >= 22` を追加し、CI の Node バージョンと明示的に対応させた。

### 参照 ADR

ADR-0010（pixi.js + d3-force の採用）、ADR-0011（Graph UI を v0.2 では副画面として追加）、
ADR-0012（性能測定方法論）、ADR-0013（CI/Pages パイプラインのスコープ）。

### 既知の制約（引き続き未解消）

- pan/zoom FPS が目標（60fps 目安）を大きく下回る（実測約 5fps、10,000 ノード規模）。個別描画
  ではなく `PIXI.ParticleContainer` 等へのバッチ化が今後の改善候補。
- build 時間が実測 p50 約 60 秒（10,000 notes / 50,000 edges）。`buildResolutionIndex()` 周りの
  計算量が疑われるが未調査。
- REQ-UX-005（Graph UI を将来の主画面とする方向性）は引き続き方向性のみ DECIDED、詳細 UX は OPEN。
- private → public repo の自動公開パイプライン（enastro 自身の vault を CI でミラーする機能）は
  引き続き DEFERRED。v0.2 で追加したのは enastro 自身のデモサイト公開と、エンドユーザー向けの
  再利用可能テンプレートのみ。

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
