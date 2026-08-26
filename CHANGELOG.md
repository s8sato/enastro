# Changelog

本プロジェクトのバージョンは [Semantic Versioning](https://semver.org/lang/ja/) に準拠する。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) を参考にする。

## [Unreleased]

### 修正

- **非 ASCII（日本語等）ファイル名の vault で `modifiedAt`（"Updated" 表示）が
  一切表示されない不具合**: `getGitModifiedAtMap()`（`src/vault/git-modified-at.ts`）が
  実行する `git log --name-only` は、git の既定設定 `core.quotePath=true` の影響で
  非 ASCII バイトを含むパスを C-quote/8進エスケープして返す。この結果、
  `discoverVault()` が計算する生の UTF-8 相対パスと一致せず、日本語ファイル名の
  ノートすべてで `modifiedAt` の参照が失敗し、"Updated" 表示・検索対象・
  REQ-EXPLORE-007 の自動 unread 判定のいずれからも静かに除外されていた
  （ADR-0015 の「不明」フォールバックに落ちる）。`git` 呼び出しに
  `-c core.quotePath=false` を追加して修正した。CI に git が無い／履歴が浅いこと
  が原因ではない（`fetch-depth: 0` は無関係に必要な設定のまま）。

## [0.3.2] - 2026-08-26

### 追加

- **数式（KaTeX）レンダリング**: ノート本文中の inline `$...$` / block `$$...$$` 数式を、
  ビルド時に KaTeX でサーバーサイドレンダリングして静的 HTML に埋め込む。コードブロック・
  インラインコード中の `$` には反応しない。不正な LaTeX は build を失敗させず、KaTeX 自身の
  エラー表示にフォールバックする（REQ-CONTENT-010、
  [ADR-0017](decisions/ADR-0017-math-rendering.md)）。

- **vault 単位のビルド時サイトデフォルト**: `enastro.config.json` に `siteTitle` / `defaultTheme` /
  `defaultParticleDirection` を追加。`siteTitle`（既定値 `"Notes"`）は `index.html` の
  `<title>`/`<h1>` と `graph.html` の `<title>` に反映される。`defaultTheme`（既定値 `"moon"`）・
  `defaultParticleDirection`（既定値 `"wikilink"`）は、`localStorage` に保存済みの選択が無い
  初回訪問時の初期値としてのみ使われ、ユーザーの明示的な選択は常にこれより優先される
  （REQ-UX-011/012/013、[ADR-0016](decisions/ADR-0016-vault-config-driven-site-defaults.md)）。

### 変更

- **particle-direction の既定値・内部語彙**: graph ページの粒子進行方向の既定値を
  「dependency-first」から `wikilink` に変更。内部コード語彙も UI ラベルと整合させるため
  `dependency-first` から `backlink` に統一した(挙動は不変、名称のみの変更)。

### 修正

- **git 依存インストール時の `dist-ts` 欠落**: README のパターン A/B が案内する
  `npx github:s8sato/enastro ...` で enastro を git 依存としてインストールした場合、
  ビルド成果物(`dist-ts/`)が生成・同梱されず `ERR_MODULE_NOT_FOUND` で CLI が起動できない
  不具合を修正。`package.json` に `prepare` script(git 依存インストール時に自動でビルドを
  走らせる)と `files` allowlist(`.gitignore` に関わらず `bin`/`dist-ts` をパッケージへ確実に
  含める)を追加した。再発防止として、CI に `npm pack` で生成した tarball を別プロジェクトへ
  install して CLI を実行する `package-install-smoke` ジョブを追加。

## [0.3.1] - 2026-08-25

v0.3.0 の探索ステータス(History)機能・テーマ切り替え機能を仕上げる修正・改善リリース。

### 追加

- **エネルギー粒子の進行方向トグル**: Graph UI に、edge 上のエネルギー粒子の進行方向を
  切り替えるトグルを追加。既定値は「dependency-first」(参照先の依存先ノートから参照元の
  依存元ノートへ、知識の積み上げ方向)とし、代替として wikilink の方向を選べる。設定は
  `localStorage` にのみ保存され graph ページに閉じ、graph IR の `edge.source`/`edge.target`・
  backlink は一切変更されない(REQ-UX-012、[ADR-0010](decisions/ADR-0010-graph-ui-rendering-strategy.md)
  が PROPOSED として残していたパラメータを具体化し DECIDED とした)。

- **History パネルの刷新**: rewind 用の History UI を、ヘッダー右端トリガー付きの
  透過ドロワーに刷新。イベントログは新しい記録が上に来る順序で表示し、末尾に常設の
  "Initial state" / Snapshot 行を置く。破壊的操作は "Return to now"(最軽量)・
  "Squash until here"(不可逆だが無駄を畳み込むだけ)・"Reset to here"(不可逆で重い)の順に並べ、
  実行前に確認を要求する(REQ-EXPLORE-003/008)。

- **Snapshot 概念の導入**: "Prune until here" を "Squash until here" に改め、カーソル時点までの
  イベントログを正味の効果を保持したまま永続化された Snapshot に畳み込む方式に変更。Snapshot は
  更新時刻を持ち、History リスト上で他のイベント行と同じ書式で表示される(REQ-EXPLORE-008)。

- **History カーソル位置の永続化**: rewind 中のカーソル位置および History ドロワーの開閉状態を
  `localStorage` に永続化し、ページ遷移・リロードをまたいで保持する擬似 SPA 化。「now」を
  「イベントログのうち最新のもの」として明確に定義し直し、ボタンの活性条件(カーソルが now の
  とき Return/Reset を非活性、Snapshot のとき Squash を非活性)を再定義した(REQ-EXPLORE-009)。

### 修正

- History ドロワーの操作性・可読性を改善(背景透過度、ボタンの待機状態表示、カーソル位置の表示)。
- Flow(粒子方向)ボタンを右下固定配置にし、トグル時にボタン幅が変化しないよう修正。
- Graph view の History ドロワー位置を、タグフィルタの高さに関わらず All Notes/note ページと
  一致するよう修正(`<nav>` の下端のみを基準とする)。
- `getStatusSnapshot` が永続化されたカーソル位置を正しく解決するよう修正。

## [0.3.0] - 2026-08-25


v0.2.0 以降にリリースされた v0.2.1・v0.2.2 の内容(Graph UI の細部改善・グラフ画面でのタグ
フィルタリング)を統合し、新たに探索ステータス(既読/未読・History・rewind)機能と12色
テーマ切り替え機能を追加した節目のリリース。

### 追加

- **探索ステータス(既読/未読)と History パネル**: ブラウザの `localStorage` にのみ閉じた形で、
  ノートの既読/未読を記録する機能を新設([ADR-0014](decisions/ADR-0014-node-exploration-status-persistence.md))。
  - ノートページの `Mark as read` / `Mark as unread` ボタンで既読状態を切り替え、既読ノートは
    一覧ページのビュレット・グラフ UI 上の当該ノード・そのノードを起点とするエネルギー粒子が
    減光・無彩色化して表示される(REQ-EXPLORE-001, REQ-EXPLORE-005)。既読ノートには読了日時
    (ノートページの最終更新日時と統一した書式)を表示し、既読/未読の一目での判別材料とする。
  - ステータス変更は追記型のイベントログとして記録され、共有の History パネルから任意の過去
    時点まで表示を巻き戻す(rewind)ことができる。History リストの末尾には、一切イベントが
    記録されていない「初期状態」(全ノート未読)を表す常設の選択可能なエントリ("Initial
    state")を常に表示し、rewind 中に閲覧しているカーソル位置のエントリはリスト内でハイライト
    される(REQ-EXPLORE-003)。タイムスタンプ表示はタイムゾーン注記なしの日時のみの表記で
    統一する。
  - `localStorage.setItem` が容量超過等で失敗した場合、閲覧者にその場で警告を表示する
    (REQ-EXPLORE-002)。
  - グラフのトポロジー変化(ノード/エッジの増減)の影響を受けず、存在しなくなった ID は
    単に参照されず、新規 ID は未読として扱われる(REQ-EXPLORE-004)。サイト読み込み時、
    探索ログに登場するノート ID が現在の公開ノート一覧に存在しない場合、および既読ノートの
    最終更新日時が既読イベントの記録時刻より新しい場合(自動 unread 同期)に、それぞれ独立
    した枠でノート ID を列挙して通知する(REQ-EXPLORE-007)。
  - rewind 中のカーソル位置を対象に、それ以降の履歴を永続的に破棄する "Reset to here" と、
    正味の変化がない read/unread の往復を除去する "Prune until here" の2つの明示的・破壊的
    操作を追加。いずれも実行前に確認を要求する(REQ-EXPLORE-008)。
  - 探索ステータスはいかなるビルド成果物(`graph.json`, `search-index.json`, 生成 HTML)にも
    一切書き込まれない(REQ-EXPLORE-006, REQ-SEC-001)。

- **12色テーマ切り替え**: index/note/graph の全ページで有効な、フローティングのテーマ切り替え
  UI(`.exploration-bar` と対称の左下配置)を追加。ダイヤル状のホバープレビュー UI と、
  キーボード操作のみでも選択可能なアクセシブルな `<select>` を併設し、選択結果は
  `localStorage`(`enastro:theme:v1`)にのみ保存されクライアント完結で3ページ間を通して
  一貫する。ビルド成果物は特定テーマに依存せず(REQ-BUILD-001 と整合、REQ-UX-004 の
  ポータビリティを維持)、探索ステータス機能と同様の client-only `localStorage` 完結
  パターンを踏襲する(REQ-UX-011)。

- **グラフ画面でのタグによるフィルタリング**: Graph view に All notes ページと同じタグフィルタ
  UI を追加。タグを選択すると、そのタグをすべて持つノート(AND 条件)だけが残り、それ以外の
  ノード・エッジ・エネルギー粒子は非表示になる(REQ-UX-002 と整合)。

### 変更

- **UI 各所の細部改善**:
  - All notes ページのヘッダ(検索・タグフィルタ)をスクロールに対して固定表示にし、
    ノートカードはタイトル文字列だけでなくカード全体のクリック/タップで遷移できるようにした。
    Graph view と同様の透過度でノートページのヘッダも一貫して固定表示する。
  - モバイル端末での Graph view の描画解像度を `devicePixelRatio` に追従させ、文字やノードの輪郭の粗さを解消。
    また、ノードのタップによるプレビュー（ハイライト＋タイトル表示）を、余白のタップや pan/zoom 操作では解除しないよう変更。

### 修正

- **ノートの `modifiedAt` を git commit date 由来に変更**: これまで `fs.Stat.mtime`
  (ファイルシステムが管理する最終書き込み時刻)に由来していた `modifiedAt`
  の算出を、そのファイルを最後に変更した git コミットの日時のみを情報源とする方式に変更し、
  git 情報が得られない場合は「不明」として扱い非表示・検索対象外とするようにした
  (mtime へのフォールバックは)。`git clone`/`git checkout` はチェックアウト時に
  全ファイルの mtime を「その瞬間」にリセットしてしまうため、CI 経由の自動ビルド
  (`ci.yml`, `deploy-demo.yml`)のたびに REQ-EXPLORE-007 の自動 unread 同期がほぼ
  無差別に誤発火し、`src/e2e/exploration.e2e.test.ts` の一部テストが CI でのみ
  間欠的に失敗する原因にもなっていた([ADR-0015](decisions/ADR-0015-note-modified-at-source.md)、
  REQ-UX-007, REQ-EXPLORE-007 改訂)。

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
