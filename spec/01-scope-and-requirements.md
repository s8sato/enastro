# 01. Scope and Requirements

Status legend: `DECIDED` | `PROPOSED` | `OPEN` | `DEFERRED`（凡例は [00-product-vision.md](00-product-vision.md) 参照）。

## 1. RFC 2119 キーワードの定義 [DECIDED]

本プロジェクトの spec 文書では、RFC 2119 に準じて次のキーワードを用いる。

- **MUST**: 要件として必須。満たさない実装は受け入れられない。
- **SHOULD**: 強く推奨されるが、正当な理由があれば逸脱してよい（逸脱時は ADR か文書内に理由を残す）。
- **MAY**: 任意。実装してもしなくてもよい。

## 2. v0.1 の一本道（golden path）[DECIDED]

```
minimal Markdown vault
  → frontmatter parse
  → Wikilink resolution (+ backlink)
  → minimal graph IR
  → publish selection (publish: true)
  → deterministic static artifact (HTML + search index)
  → automated verification
```

- 実行形態: ローカル CLI のみ。CI 自動公開パイプラインは v0.1 に含めない。
- 出力先: 静的サイトを手元に生成する。GitHub Pages 等へのデプロイはユーザーが手動で行う。
- Graph UI（星空 UI）は v0.1 に含めない。ノート閲覧・全文検索・backlink・タグ検索が中心。

## 3. v0.1 から明示的に除外する機能（DEFERRED）[DECIDED]

以下は enastro の構想に含まれるが、v0.1 では実装しない。理由は「基礎的な content semantics / privacy semantics が確立する前に着手しない」という方針による。v0.1 の golden path が確立したことを受け、このうち一部は v0.2 で un-defer された（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)〜[ADR-0013](../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)、§3.1 参照）。

| 機能 | v0.1 状態 | v0.2 状態 |
|---|---|---|
| Graph UI / WebGL レンダラー / エネルギー粒子表現 | DEFERRED | DECIDED（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md), [ADR-0011](../decisions/ADR-0011-graph-ui-placement.md)） |
| ローカル AI・Web AI 向けの MCP / CLI query interface (`search_nodes` 等) | DEFERRED | DEFERRED（継続） |
| private → CI → public repo の自動公開パイプライン (REQ-PUB-008) | DEFERRED | DEFERRED（継続。§3.1 の CI/Pages とは別物） |
| 非 Obsidian 入力形式への対応 | DEFERRED | DEFERRED（継続） |
| mobile 対応・accessibility 対応 | DEFERRED（v0.1 では OPEN として未検証） | mobile のレスポンシブ/touch 対応のみ DECIDED（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)）。WCAG 準拠等の accessibility 対応は引き続き DEFERRED |
| 10,000 nodes / 50,000 edges 規模の性能最適化 | DEFERRED | 性能目標の確定・計測は DECIDED（[ADR-0012](../decisions/ADR-0012-v0.2-performance-reference-environment.md)）。最適化そのものは計測結果次第で継続ループへ |
| 複数 vault の同時対応 | DEFERRED | DEFERRED（継続） |
| VS Code 拡張 | DEFERRED | DEFERRED（継続） |
| CI による typecheck/test 実行、GitHub Pages への自動デプロイ | (v0.1 に記載なし) | DECIDED（[ADR-0013](../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)） |

タグによる検索・フィルタリング UI は除外**しない**。v0.1 のスコープに含む。

### 3.1 v0.2 で新たに DECIDED になった事項

- REQ-GRAPH-004, REQ-GRAPH-005: Graph UI（WebGL レンダラー、layout 事前計算 + 実行時ハイブリッド）。
- REQ-PERF-001: reference environment・benchmark 方法論の確定（数値目標の達成そのものは計測してから判断、未達を理由に機能を削らない）。
- REQ-UX-009（新設）: Graph UI ページ（`graph.html`）を副画面として追加。
- REQ-UX-010（新設）: レスポンシブレイアウト + touch pan/zoom 対応（WCAG 等の accessibility 対応は含まない）。
- REQ-OPS-001〜003（新設、§4.8）: CI による typecheck/test 実行、デモサイトの GitHub Pages 自動公開、
  エンドユーザー向け再利用可能な公開 workflow テンプレートの提供。

## 4. Requirement 一覧

要件 ID は `REQ-<AREA>-<3桁連番>` とする。AREA は以下を用いる。

- `PUB`: 公開フロー（selection / privacy propagation / repo 配置）
- `CONTENT`: content semantics（Markdown / OFM / wikilink 解決）
- `GRAPH`: Knowledge Graph IR
- `UX`: 閲覧・検索・ナビゲーション
- `SEC`: security / privacy invariant
- `BUILD`: artifact / build の決定性・契約
- `PERF`: 性能
- `EXPLORE`: 閲覧者ローカルの探索ステータス（既読管理・rewind）

### 4.1 PUB

| ID | 要件 | Status |
|---|---|---|
| REQ-PUB-001 | システムは frontmatter の `publish: true` を持つノートのみを公開対象として選択 **MUST**。 | DECIDED |
| REQ-PUB-002 | 公開 artifact は全 Knowledge Graph IR ではなく public projection からのみ生成 **MUST**。 | DECIDED |
| REQ-PUB-003 | 公開ノートが非公開ノートへ wikilink する場合、対応する edge を除去し、名前・パス・タグ・alias・存在を公開物に一切露出させない **MUST**。 | DECIDED |
| REQ-PUB-004 | REQ-PUB-003 の除去が発生した場合、build はビルドログ（非公開物）に warning を出す **MUST**。 | DECIDED |
| REQ-PUB-005 | 公開ノートが非公開ノートを embed する場合、REQ-PUB-003 / REQ-PUB-004 と同様に扱う **MUST**。 | DECIDED |
| REQ-PUB-006 | 添付ファイルは、参照されているだけでは公開されず、明示的な allowlist マークがある場合のみ公開 **MUST**。 | DECIDED |
| REQ-PUB-007 | 公開用リポジトリ / 出力には、ビルド済み静的 artifact のみを含め、Markdown ソース・vault パス・build 設定・ログを含めない **MUST**。 | DECIDED |
| REQ-PUB-008 | private repo push を契機とした CI からの自動公開は v0.1 で実装しない。 | DEFERRED |

### 4.2 CONTENT

| ID | 要件 | Status |
|---|---|---|
| REQ-CONTENT-001 | パーサーは wikilink `[[note]]` および alias 付き `[[note\|alias]]` を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-002 | パーサーは embed `![[note]]` を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-003 | パーサーは `#tag` 構文を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-004 | パーサーは YAML frontmatter（少なくとも `publish` とタグ相当のフィールド）を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-005 | 最小セット外の Obsidian 構文（callout・見出しリンク・block 参照・dataview・canvas 等）は、エラーにせずプレーンテキストとして素通しする **MUST**。 | DECIDED |
| REQ-CONTENT-006 | alias と同名ノートが衝突する場合、ID 一致を alias 一致より優先して解決する **MUST**（[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)、02-content-semantics.md §2.2 参照）。 | DECIDED |
| REQ-CONTENT-007 | 存在しないノートへの link（broken link）は build を失敗させず処理される **MUST**。表示方法はプレーンテキスト化し、`span.broken-link` を付与する（02-content-semantics.md §2.3 参照）。 | DECIDED |
| REQ-CONTENT-008 | 日本語ファイル名・Unicode を含むノート名を正しく解決 **MUST**。 | DECIDED |
| REQ-CONTENT-009 | ノートの ID はファイル名（拡張子を除いたもの、NFC 正規化）とし、vault 内で一意でなければならない **MUST**。ID の衝突は build を失敗させる **MUST**。ノートのタイトルは本文中の最初の第一レベル見出しとし、存在しない場合は ID をタイトルとして使う **MUST**。frontmatter の `title` は無視され、警告として記録される（build error にはしない）**MUST**（[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)、02-content-semantics.md §2.1, §2.4 参照）。 | DECIDED |
| REQ-CONTENT-010 | パーサーは `$...$`（インライン）・`$$...$$`（ブロック）を KaTeX 数式としてビルド時に server-side レンダリングする **MUST**。不正な LaTeX は build を失敗させず KaTeX 自身のエラー表示にフォールバックする **MUST**。`\(...\)`/`\[...\]` は非対応（[ADR-0017](../decisions/ADR-0017-math-rendering.md)、02-content-semantics.md §1.1 参照）。 | DECIDED |

### 4.3 GRAPH

| ID | 要件 | Status |
|---|---|---|
| REQ-GRAPH-001 | システムは Knowledge Base を単一の Knowledge Graph IR へコンパイル **MUST**（projection 生成前に必ず経由する）。 | DECIDED |
| REQ-GRAPH-002 | wikilink は directed edge として表現 **MUST**。 | DECIDED |
| REQ-GRAPH-003 | システムは graph IR から backlink（逆方向 edge）を導出 **MUST**。 | DECIDED |
| REQ-GRAPH-004 | Graph UI（WebGL レンダラー・星表現・光の伝播表現）を v0.2 で実装する **MUST**。副画面 `graph.html` として追加し、ノートビューを主画面のまま維持する（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md), [ADR-0011](../decisions/ADR-0011-graph-ui-placement.md)）。 | DECIDED |
| REQ-GRAPH-005 | layout 座標の build 時事前計算、および実行時のユーザー操作に応じた追加の物理演算/再配置のハイブリッド方式を v0.2 で実装する **MUST**（[ADR-0006](../decisions/ADR-0006-graph-layout-precomputation-strategy.md), [ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md)）。 | DECIDED |

### 4.4 UX

| ID | 要件 | Status |
|---|---|---|
| REQ-UX-001 | 出力は公開ノートに対する全文検索を提供 **MUST**。 | DECIDED |
| REQ-UX-002 | 出力はタグによる検索・フィルタリングを提供 **MUST**。 | DECIDED |
| REQ-UX-003 | 出力はノートごとに backlink を表示 **MUST**。 | DECIDED |
| REQ-UX-004 | 出力は静的ホスティング可能でサーバーサイド runtime 不要な portable artifact である **MUST**。 | DECIDED |
| REQ-UX-005 | v0.1 の主画面はノート/ドキュメントビューであり、Graph UI は主画面にしない。長期的には Graph UI を主画面に据える方針。 | DECIDED（方向性）/ OPEN（詳細 UX） |
| REQ-UX-006 | ノートページには一覧ページ（`index.html`）へのナビゲーションリンクを常に表示する **SHOULD**。 | DECIDED |
| REQ-UX-015 | 出力される全ページ URL は拡張子を持たないディレクトリ形式（`<name>/`）とする。ルートの `index.html` のみ例外的にサイトルート `./` として扱う **SHOULD**（[ADR-0018](../decisions/ADR-0018-clean-url-output-structure.md)）。 | DECIDED |
| REQ-UX-007 | ノートページには ID の近くに最終更新日時（そのファイルを最後に変更した git コミットの日時。git 情報が得られない場合は「不明」として扱い非表示・検索対象外とする。mtime へのフォールバックは行わない、[ADR-0015](../decisions/ADR-0015-note-modified-at-source.md)）を表示し、検索対象に含める **SHOULD**。ビルドの決定性（REQ-BUILD-001）を保つため、静的 HTML には UTC 表示をフォールバックとして埋め込み、閲覧者のブラウザ上で JavaScript により閲覧者のローカルタイムゾーンでの表示に強化する。作成日時は取得元の信頼性の問題（filesystem birthtime の非対応・git checkout によるリセット）から v0.1 では対象外とする。 | DECIDED |
| REQ-UX-008 | ノートページの `#tag` はリンクとして表示され、クリックすると一覧ページ（`index.html`）の対応するタグでフィルタされた表示に遷移する **SHOULD**。 | DECIDED |
| REQ-UX-009 | Graph UI ページ（`graph/`）をノート一覧・ノートページから相互にリンクできる副画面として提供する **MUST**（[ADR-0011](../decisions/ADR-0011-graph-ui-placement.md)）。 | DECIDED |
| REQ-UX-010 | 出力は PC・モバイル両方でレスポンシブなレイアウトを提供し、Graph UI は touch による pan/zoom 操作をサポートする **MUST**。WCAG 準拠等の包括的 accessibility 対応は対象外（引き続き DEFERRED）。 | DECIDED |
| REQ-UX-011 | 出力は12種のカラーテーマをクライアント完結で切り替え可能とする **SHOULD**。テーマ選択は `localStorage` にのみ保存され、index/note/graph の3ページ間で一貫する。初回訪問時（`localStorage` に選択が保存されていない時）の初期テーマは `enastro.config.json` の `defaultTheme`（未指定時 `moon`、[ADR-0016](../decisions/ADR-0016-vault-config-driven-site-defaults.md)）で vault ごとに指定できるが、ユーザーが一度でも明示的に選択したテーマは常にそれより優先される。ビルドはこの初期値注入以外の点で特定テーマに依存しない(REQ-BUILD-001 と整合し、REQ-UX-004 のポータビリティを維持する)。既存の探索ステータス機能([ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md))と同様、ユーザーの選択自体の永続化は client-only の `localStorage` 完結パターンを踏襲し、ビルド成果物には一切書き込まない。 | DECIDED |
| REQ-UX-012 | Graph UI ページ（`graph.html`）は edge 上のエネルギー粒子の進行方向をトグルで切り替え可能とする **SHOULD**（[ADR-0010](../decisions/ADR-0010-graph-ui-rendering-strategy.md) が PROPOSED として残した粒子方向パラメータの具体化）。既定値は「wikilink」の方向（`edge.source` → `edge.target`、REQ-GRAPH-002 の directed edge と一致）とし、代替として「backlink」（参照先＝依存先ノートから参照元＝依存元ノートへ、知識の積み上げ方向）を選べる。初回訪問時の初期方向は `enastro.config.json` の `defaultParticleDirection`（未指定時 `wikilink`、[ADR-0016](../decisions/ADR-0016-vault-config-driven-site-defaults.md)）で vault ごとに指定できるが、ユーザーが一度でも明示的に選択した方向は常にそれより優先される。設定は `localStorage` にのみ保存され、graph ページのみに閉じる（index/note ページには表示しない）。graph IR の `edge.source`/`edge.target`・backlink（REQ-GRAPH-002/003）はどちらの設定でも一切変更されない。REQ-EXPLORE-005 の「探索済みノートの発射粒子を減光する」判定は、その時点で選択中の方向における実際の粒子発射元ノードに追従する。 | DECIDED |
| REQ-UX-013 | 出力サイトのタイトルは `enastro.config.json` の `siteTitle`（未指定時 `Notes`、[ADR-0016](../decisions/ADR-0016-vault-config-driven-site-defaults.md)）で vault ごとに指定できる **SHOULD**。`index.html` の `<title>` と見出し（`<h1>`）の両方、および `graph/` の `<title>`（`{siteTitle} · Graph view`）に反映される。note ページ（`notes/{id}/`）の `<title>` はノート自身のタイトルのままとし、対象外とする。 | DECIDED |
| REQ-UX-014 | ノート本文中の外部リンク（`http`/`https` の絶対 URL）は新しいタブで開く（`target="_blank"` `rel="noopener noreferrer"`）**SHOULD**。内部リンク（wikilink 解決済みノート、`#tag` リンク、attachment）は現在のタブ内で遷移する（変更しない）。 | DECIDED |

### 4.5 SEC

| ID | 要件 | Status |
|---|---|---|
| REQ-SEC-001 | 公開物は非公開ノートの名前・パス・タグ・alias・リンク先の存在を一切漏洩させない **MUST**（privacy invariant）。 | DECIDED |
| REQ-SEC-002 | 添付ファイルはデフォルト非公開とし、公開には明示的な allowlist マークを要する **MUST**。 | DECIDED |
| REQ-SEC-003 | ノート内のユーザー由来 HTML/script は、公開 artifact に含める前にサニタイズされる **MUST**（XSS 対策）。 | DECIDED |
| REQ-SEC-004 | REQ-SEC-001〜003 の privacy invariant は、性能・利便性・実装容易性のために warning へ格下げされたり無効化されたりしてはならない **MUST**。 | DECIDED |

### 4.6 BUILD

| ID | 要件 | Status |
|---|---|---|
| REQ-BUILD-001 | 同一の入力 vault と設定に対して、build は content-hash が一致する artifact を生成 **MUST**（deterministic build）。 | DECIDED |
| REQ-BUILD-002 | artifact のファイル構成・JSON schema はバージョニングされ、schema validation で検証可能である **SHOULD**。v0.1 での schema は最小限とし、`graph.json` は手書きバリデータ（ajv 等の依存なし）で検証する。 | DECIDED |

### 4.7 PERF

| ID | 要件 | Status |
|---|---|---|
| REQ-PERF-001 | 10,000 nodes / 50,000 edges 規模での性能目標（first interactive frame ≤ 1,000ms 等）を v0.2 で確定し、fixtures/benchmark-vault で計測する **SHOULD**。reference environment（hardware / browser / percentile）は [ADR-0012](../decisions/ADR-0012-v0.2-performance-reference-environment.md) で確定。目標未達でも node/edge/機能を黙って省略してはならない。 | DECIDED |

### 4.8 OPS

| ID | 要件 | Status |
|---|---|---|
| REQ-OPS-001 | CI は push / pull request をトリガーに typecheck と test 一式を実行する **MUST**（[ADR-0013](../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)）。 | DECIDED |
| REQ-OPS-002 | `main` ブランチへの push を契機に、本リポジトリのデモ vault をビルドし GitHub Pages に自動デプロイする **MUST**（[ADR-0013](../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)。GitHub 公式 action のみ使用）。 | DECIDED |
| REQ-OPS-003 | エンドユーザーが自分の vault を自分の GitHub Pages に公開するための再利用可能な workflow テンプレートを文書として提供する **SHOULD**（REQ-PUB-008 とは別物、自動ミラーリングは伴わない）。 | DECIDED |

### 4.9 EXPLORE

| ID | 要件 | Status |
|---|---|---|
| REQ-EXPLORE-001 | 閲覧者はノートごとに「未読」「既読」の2値ステータスを持つ **MUST**。既読化はノートページ上の手動ボタン（Mark as read）操作でのみ発火し、スクロール検知等による自動既読は行わない **MUST**（[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md)）。 | DECIDED |
| REQ-EXPLORE-002 | ステータスはブラウザの `localStorage` にのみ保存され、`localStorage.setItem` が失敗(ストレージ上限超過等)した場合は、その場で閲覧者に警告を表示する **MUST**。警告発生時も、その場のページ表示上は変更を即時反映してよいが、リロード後に保存されない場合がある旨を示す **SHOULD**。 | DECIDED |
| REQ-EXPLORE-003 | 保存されたステータス変更は追記型のイベントログとして記録され、閲覧者は任意の過去時点まで表示を巻き戻す（rewind）ことができる **MUST**。一切イベントが記録されていない「初期状態」（全ノート未読）も、History リスト上の常に選択可能なエントリとして保持される **MUST**。rewind はログを削除せず、閲覧用のカーソル移動として扱う **MUST**。rewind 中は新たなステータス変更操作を無効化する **MUST**（[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md) 改訂）。 | DECIDED |
| REQ-EXPLORE-004 | 探索ステータスはノート ID をキーに管理され、グラフのトポロジー変化（ノード/エッジの増減）の影響を受けない **MUST**。存在しなくなった ID のステータスは単に参照されず、新規 ID は未読として扱われる **MUST**。 | DECIDED |
| REQ-EXPLORE-005 | 既読ノートについて、一覧ページのビュレット、グラフ UI 上の当該ノード、当該ノードを起点とするエネルギー粒子が減光・無彩色化して表示される **MUST**。 | DECIDED |
| REQ-EXPLORE-006 | 探索ステータスはいかなるビルド成果物（`graph.json`, `search-index.json`, 生成 HTML）にも一切書き込まれない **MUST**（[08-security-and-privacy.md](08-security-and-privacy.md) の privacy invariant と整合）。 | DECIDED |
| REQ-EXPLORE-007 | サイト読み込み時、探索ログに登場するノート ID が現在の公開ノート一覧（`search-index.json`）に存在しない場合、閲覧者に通知する **SHOULD**。また、既読状態のノートについて、その既読イベントの記録時刻より当該ノートの最終更新日時（`search-index.json` の `modifiedAt`。その情報源は REQ-UX-007、[ADR-0015](../decisions/ADR-0015-note-modified-at-source.md)）が新しい場合、自動的に未読イベントを追記し、その旨を通知する **SHOULD**。この2つの通知は原因が異なるため独立した別々の枠に表示し、件数ではなく対象ノート ID を列挙する **SHOULD**。いずれもフェッチ失敗時（オフライン等）は同期機能のみを黙ってスキップし、他の探索ステータス機能に影響しない **MUST**（[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md) 改訂）。 | DECIDED |
| REQ-EXPLORE-008 | 閲覧者は rewind 中のカーソル位置を対象に、次の2つの明示的・破壊的操作を実行できる **MAY**: (a) "Reset to here" — カーソル時点以前（`ts <= T`）の履歴は保持したまま、カーソル時点より後（`ts > T`）の履歴を永続的に削除する（`git reset --hard` 相当。履歴の集約・書き換えは行わない）。(b) "Squash until here" — カーソル時点までの範囲の履歴（イベントログ）すべてを、正味の効果を保持したまま永続化された Snapshot に畳み込み、個々のイベントをログから削除する。いずれも実行前に確認を要求し、rewind 自体（閲覧専用、REQ-EXPLORE-003）とは明確に区別される **MUST**。Snapshot は更新時刻（`snapshotUpdatedAt`）を持ち、History リスト上の Snapshot 行に他のイベント行と同じ書式で表示される **MUST**。初期値はローカルストレージ初期化時（有効な状態が見つからず新規状態を組み立てた時点）に確定・即時永続化され、"Squash until here" 実行時にその実行時刻へ更新される **MUST**。"Reset to here" はこの値を変更しない **MUST**（[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md) 改訂）。 | DECIDED |
| REQ-EXPLORE-009 | rewind 中のカーソル位置は必ず「now」「Snapshot」「過去のイベント時点」のいずれかであり、未定義状態を取らない **MUST**。「now」とはイベントログのうち最新のもの（それより後のイベントが存在しない時点）を指す **MUST** ——そのため、History リスト上でログの最新イベント行を選択した場合も now と同一に扱われる（ハイライトなし・rewind の read-only 化なし）**MUST**。初期状態・"Return to now"・"Reset to here" 実行後のカーソル位置は now、"Squash until here" 実行後のカーソル位置は Snapshot になる **MUST**。カーソル位置および History ドロワーの開閉状態はページ遷移・リロードをまたいで `localStorage` に永続化される **MUST**（[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md) 改訂、擬似 SPA 化）。ボタンの活性条件は次のとおり再定義される **MUST**: カーソル位置が now のとき "Return to now" と "Reset to here" は非活性、カーソル位置が Snapshot のとき "Squash until here" は非活性（それ以外は活性）。Graph view (`graph.html`) の History ドロワー位置は、`#tag-filters` の高さに関わらず All Notes/note ページと一致する **MUST**（`<nav>` の下端のみを基準とする）。 | DECIDED |

## 5. Traceability 表

| Product goal | Requirement | Architecture / ADR | Acceptance | Fixture |
|---|---|---|---|---|
| 00: 一本道の安全な生成 | REQ-PUB-001 | ADR-0001 | 09 §2.1 | fixtures/basic-vault |
| 00: public projection 経由の生成 | REQ-PUB-002 | ADR-0001 | 09 §2.1 | fixtures/basic-vault |
| 00: 非公開情報の非漏洩 | REQ-PUB-003, REQ-SEC-001 | ADR-0002 | 09 §2.2 | fixtures/privacy-vault |
| 00: 非公開 edge 除去時の warning | REQ-PUB-004 | ADR-0002 | 09 §2.2 | fixtures/privacy-vault |
| 00: 非公開ノートの embed 除去 | REQ-PUB-005 | ADR-0002 | 09 §2.2 | fixtures/privacy-vault |
| 00: 添付の安全な公開 | REQ-PUB-006, REQ-SEC-002 | ADR-0003 | 09 §2.2 | fixtures/privacy-vault |
| 00: 公開 repo の攻撃面最小化 | REQ-PUB-007 | ADR-0004 | 09 §2.3 | fixtures/basic-vault (artifact 出力検査) |
| 01: wikilink / alias 解釈 | REQ-CONTENT-001 | (parser 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: embed 解釈 | REQ-CONTENT-002 | (parser 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: `#tag` 解釈 | REQ-CONTENT-003 | (parser 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: frontmatter 解釈 | REQ-CONTENT-004 | (parser 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: 非対応構文の素通し | REQ-CONTENT-005 | (parser 実装) | 09 §2.1 | fixtures/compatibility-vault |
| 01: ID 優先の衝突解決 | REQ-CONTENT-006 | ADR-0009 | 09 §2.1 | fixtures/basic-vault |
| 01: broken link の非致命化 | REQ-CONTENT-007 | (graph/render 実装) | 09 §2.1 | fixtures/basic-vault |
| 00: 国際化されたファイル名の解決 | REQ-CONTENT-008 | (parser 実装) | 09 §2.1 | fixtures/compatibility-vault |
| 00: note id/title 分離 | REQ-CONTENT-009 | ADR-0009 | 09 §2.1 | fixtures/basic-vault |
| 01: Knowledge Graph IR への一元化 | REQ-GRAPH-001 | (graph 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: wikilink の directed edge 化 | REQ-GRAPH-002 | (graph 実装) | 09 §2.1 | fixtures/basic-vault |
| 01: backlink 導出 | REQ-GRAPH-003 | (graph 実装) | 09 §2.1 | fixtures/basic-vault |
| 00: 安全な HTML 取り込み | REQ-SEC-003 | ADR-0002 | 09 §2.2 | fixtures/security-vault |
| 00: privacy invariant の格下げ禁止 | REQ-SEC-004 | LOOP.md 安全策 | 09 §4 | - |
| 00: 決定的 build | REQ-BUILD-001 | ADR-0005 | 09 §2.4 | fixtures/basic-vault (golden hash) |
| 00: artifact schema 検証 | REQ-BUILD-002 | (build 実装、手書きバリデータ) | 09 §2.4 | fixtures/basic-vault |
| 00: 全文検索 | REQ-UX-001 | (render/build 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: タグ検索・フィルタリング | REQ-UX-002 | (render/build 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: backlink 表示 | REQ-UX-003 | (render 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: portable static artifact | REQ-UX-004 | (build 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: ノート/ドキュメントビューが主画面 | REQ-UX-005 | (render 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: 一覧ページへのナビゲーション | REQ-UX-006 | (render 実装) | 09 §2.5 | fixtures/basic-vault |
| 00: 最終更新日時の表示・検索対象化 | REQ-UX-007 | (render/build 実装), ADR-0015 | 09 §2.5 | fixtures/basic-vault |
| 00: タグのフィルタリンク化 | REQ-UX-008 | (render 実装) | 09 §2.5 | fixtures/basic-vault |
| 02: Graph UI レンダリング | REQ-GRAPH-004 | ADR-0010, ADR-0011 | 09 §2.6 | fixtures/demo-vault, fixtures/benchmark-vault |
| 02: layout 事前計算/実行時ハイブリッド | REQ-GRAPH-005 | ADR-0006, ADR-0010 | 09 §2.6 | fixtures/benchmark-vault |
| 02: Graph UI 副画面としての追加 | REQ-UX-009 | ADR-0011 | 09 §2.6 | fixtures/demo-vault |
| 02: レスポンシブ/touch 対応 | REQ-UX-010 | (render/client 実装) | 09 §2.6 | fixtures/demo-vault |
| 02: 性能目標の確定・計測 | REQ-PERF-001 | ADR-0012 | 09 §2.6 | fixtures/benchmark-vault |
| 02: CI typecheck/test | REQ-OPS-001 | ADR-0013 | 09 §2.6 | - |
| 02: GitHub Pages 自動デプロイ | REQ-OPS-002 | ADR-0013 | 09 §2.6 | fixtures/demo-vault |
| 02: 再利用可能な公開テンプレート | REQ-OPS-003 | ADR-0013 | 09 §2.6 | - |
| 02: 探索ステータス（既読/未読）の記録 | REQ-EXPLORE-001 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: ストレージ上限警告 | REQ-EXPLORE-002 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: rewind（イベントログ + カーソル） | REQ-EXPLORE-003 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: トポロジー変化耐性 | REQ-EXPLORE-004 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: 探索ステータスのスタイル反映 | REQ-EXPLORE-005 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: 公開 artifact への非漏洩 | REQ-EXPLORE-006, REQ-SEC-001 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: ID不一致通知・自動unread同期 | REQ-EXPLORE-007 | ADR-0014, ADR-0015 | 09 §2.6 | fixtures/basic-vault |
| 02: Reset to here / Squash until here | REQ-EXPLORE-008 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 02: カーソル位置永続化・ボタン活性条件再定義 | REQ-EXPLORE-009 | ADR-0014 | 09 §2.6 | fixtures/basic-vault |
| 03: 12色テーマ切り替え | REQ-UX-011 | (render/client 実装、ADR-0014 の localStorage 完結パターンを踏襲、ADR-0016) | 09 §2.6 | fixtures/basic-vault |
| 03: エネルギー粒子の進行方向トグル | REQ-UX-012 | ADR-0010（PROPOSED パラメータの具体化）、ADR-0016 | 09 §2.6 | fixtures/demo-vault, fixtures/benchmark-vault |
| 03: サイトタイトルの vault ごとの指定 | REQ-UX-013 | ADR-0016 | 09 §2.6 | fixtures/basic-vault |
| 03: 数式（KaTeX）レンダリング | REQ-CONTENT-010 | ADR-0017 | 09 §2.1 | fixtures/demo-vault |
| 04: 外部リンクを新しいタブで開く | REQ-UX-014 | (render 実装) | 09 §2.5 | fixtures/demo-vault |
| 04: クリーンURL（拡張子なしディレクトリ形式） | REQ-UX-015 | ADR-0018 | 09 §2.5 | fixtures/basic-vault |

DEFERRED な REQ（REQ-PUB-008、非 Obsidian 対応、複数 vault 対応、VS Code 拡張、WCAG accessibility 等）は
本表に含めず、§3（v0.1 から明示的に除外する機能）の表で管理する。
