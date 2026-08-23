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

以下は enastro の構想に含まれるが、v0.1 では実装しない。理由は「基礎的な content semantics / privacy semantics が確立する前に着手しない」という方針による。

| 機能 | 状態 |
|---|---|
| Graph UI / WebGL レンダラー / エネルギー粒子表現 | DEFERRED |
| ローカル AI・Web AI 向けの MCP / CLI query interface (`search_nodes` 等) | DEFERRED |
| private → CI → public repo の自動公開パイプライン | DEFERRED |
| 非 Obsidian 入力形式への対応 | DEFERRED |
| mobile 対応・accessibility 対応 | DEFERRED（v0.1 では OPEN として未検証） |
| 10,000 nodes / 50,000 edges 規模の性能最適化 | DEFERRED |
| 複数 vault の同時対応 | DEFERRED |
| VS Code 拡張 | DEFERRED |

タグによる検索・フィルタリング UI は除外**しない**。v0.1 のスコープに含む。

## 4. Requirement 一覧

要件 ID は `REQ-<AREA>-<3桁連番>` とする。AREA は以下を用いる。

- `PUB`: 公開フロー（selection / privacy propagation / repo 配置）
- `CONTENT`: content semantics（Markdown / OFM / wikilink 解決）
- `GRAPH`: Knowledge Graph IR
- `UX`: 閲覧・検索・ナビゲーション
- `SEC`: security / privacy invariant
- `BUILD`: artifact / build の決定性・契約
- `PERF`: 性能

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
| REQ-CONTENT-001 | パーサーは wikilink `[[note]]` および alias 付き `[[note|alias]]` を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-002 | パーサーは embed `![[note]]` を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-003 | パーサーは `#tag` 構文を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-004 | パーサーは YAML frontmatter（少なくとも `publish` とタグ相当のフィールド）を解釈 **MUST**。 | DECIDED |
| REQ-CONTENT-005 | 最小セット外の Obsidian 構文（callout・見出しリンク・block 参照・dataview・canvas 等）は、エラーにせずプレーンテキストとして素通しする **MUST**。 | DECIDED |
| REQ-CONTENT-006 | alias と同名ノートが衝突する場合、ID 一致を alias 一致より優先して解決する **MUST**（[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)、02-content-semantics.md §2.2 参照）。 | DECIDED |
| REQ-CONTENT-007 | 存在しないノートへの link（broken link）は build を失敗させず処理される **MUST**。表示方法はプレーンテキスト化し、`span.broken-link` を付与する（02-content-semantics.md §2.3 参照）。 | DECIDED |
| REQ-CONTENT-008 | 日本語ファイル名・Unicode を含むノート名を正しく解決 **MUST**。 | DECIDED |
| REQ-CONTENT-009 | ノートの ID はファイル名（拡張子を除いたもの、NFC 正規化）とし、vault 内で一意でなければならない **MUST**。ID の衝突は build を失敗させる **MUST**。ノートのタイトルは本文中の最初の第一レベル見出しとし、存在しない場合は ID をタイトルとして使う **MUST**。frontmatter の `title` は無視され、警告として記録される（build error にはしない）**MUST**（[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)、02-content-semantics.md §2.1, §2.4 参照）。 | DECIDED |

### 4.3 GRAPH

| ID | 要件 | Status |
|---|---|---|
| REQ-GRAPH-001 | システムは Knowledge Base を単一の Knowledge Graph IR へコンパイル **MUST**（projection 生成前に必ず経由する）。 | DECIDED |
| REQ-GRAPH-002 | wikilink は directed edge として表現 **MUST**。 | DECIDED |
| REQ-GRAPH-003 | システムは graph IR から backlink（逆方向 edge）を導出 **MUST**。 | DECIDED |
| REQ-GRAPH-004 | Graph UI（WebGL レンダラー・星表現・光の伝播表現）は v0.1 で実装しない。 | DEFERRED |
| REQ-GRAPH-005 | layout 座標の build 時事前計算、および実行時の物理演算/再配置のハイブリッド方式は将来方針として維持するが、v0.1 では実装しない。 | DEFERRED |

### 4.4 UX

| ID | 要件 | Status |
|---|---|---|
| REQ-UX-001 | 出力は公開ノートに対する全文検索を提供 **MUST**。 | DECIDED |
| REQ-UX-002 | 出力はタグによる検索・フィルタリングを提供 **MUST**。 | DECIDED |
| REQ-UX-003 | 出力はノートごとに backlink を表示 **MUST**。 | DECIDED |
| REQ-UX-004 | 出力は静的ホスティング可能でサーバーサイド runtime 不要な portable artifact である **MUST**。 | DECIDED |
| REQ-UX-005 | v0.1 の主画面はノート/ドキュメントビューであり、Graph UI は主画面にしない。長期的には Graph UI を主画面に据える方針。 | DECIDED（方向性）/ OPEN（詳細 UX） |

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
| REQ-PERF-001 | 10,000 nodes / 50,000 edges 規模での性能目標（first interactive frame ≤ 1,000ms 等）は v0.1 の対象外。reference environment（hardware / browser / percentile）は未決定。 | DEFERRED / OPEN |

## 5. Traceability 表（抜粋）

| Product goal | Requirement | Architecture / ADR | Acceptance | Fixture |
|---|---|---|---|---|
| 00: 一本道の安全な生成 | REQ-PUB-001 | ADR-0001 | 09 §2.1 | fixtures/basic-vault |
| 00: 非公開情報の非漏洩 | REQ-PUB-003, REQ-SEC-001 | ADR-0002 | 09 §2.2 | fixtures/privacy-vault |
| 00: 添付の安全な公開 | REQ-PUB-006, REQ-SEC-002 | ADR-0003 | 09 §2.2 | fixtures/privacy-vault |
| 00: 公開 repo の攻撃面最小化 | REQ-PUB-007 | ADR-0004 | 09 §2.3 | fixtures/basic-vault (artifact 出力検査) |
| 00: 決定的 build | REQ-BUILD-001 | ADR-0005 | 09 §2.4 | fixtures/basic-vault (golden hash) |
| 00: 安全な HTML 取り込み | REQ-SEC-003 | ADR-0002 | 09 §2.2 | fixtures/security-vault |
| 00: 国際化されたファイル名の解決 | REQ-CONTENT-008 | (parser 実装) | 09 §2.1 | fixtures/compatibility-vault |

網羅的な表は実装が進むにつれて拡張する。
