# 09. Acceptance and Evaluation

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. 検証方法の分類 [DECIDED]

| 検証方法 | 用途 |
|---|---|
| unit test | パーサー・サニタイズ・個々のロジックの正しさ |
| property-based test | 大量の入力パターンに対する不変条件（例: 「非公開ノート名は絶対に出力に現れない」） |
| golden test | 既知の入力に対する決定的な出力（決定的 build の検証、artifact 構成の回帰検出） |
| schema validation | graph.json / search-index.json 等の artifact 契約の検証 |
| privacy scan | 公開 artifact 全体を走査し、非公開情報の非出現を確認 |
| browser E2E test | ブラウザ上での実際の操作フロー検証（v0.1 では最小限、v0.2 で Graph UI 操作を追加） |
| visual regression | 見た目のピクセル/スクリーンショット差分検出（v0.2 でも自動化された visual regression は未導入、引き続き DEFERRED。README のデモ画像更新等は human review で代替） |
| accessibility test | a11y 検証（v0.2 でもタッチ操作対応のみ REQ-UX-010 で DECIDED。WCAG 準拠等の包括的検証は引き続き DEFERRED、OPEN） |
| performance benchmark | 性能目標の計測。v0.2 で REQ-PERF-001/ADR-0012 により DECIDED、`npm run bench`（`fixtures/benchmark-vault`）で計測を実施 |
| human review | 自動判定できない「美しさ」「心地よさ」等の主観的品質の確認 |

## 2. Requirement ごとの検証方法（v0.1 + v0.2 スコープ）

### 2.1 公開選択・content semantics

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-PUB-001 | golden test + schema validation | basic-vault |
| REQ-CONTENT-001〜004 | unit test | basic-vault |
| REQ-CONTENT-005 | unit test（非対応構文が素通しされ、build が失敗しないこと） | compatibility-vault |
| REQ-CONTENT-006 | unit test（衝突ケースの挙動が仕様通りであること）※規則自体は OPEN | basic-vault |
| REQ-CONTENT-007 | unit test（broken link で build が失敗しないこと） | basic-vault |
| REQ-CONTENT-008 | unit test + golden test（日本語ファイル名の解決） | compatibility-vault |
| REQ-CONTENT-010 | unit test（inline/block 数式のレンダリング、コードスパン非干渉、不正 LaTeX のフォールバック、trust:false の安全性） | demo-vault (markdown-showcase.md) |
| REQ-CONTENT-011 | unit test + human review（mermaid ダイアグラムの描画確認）※実現方式は ADR 確定後に検証方法を具体化 | demo-vault (markdown-showcase.md) |
| REQ-CONTENT-012 | unit test（`<details>`/`<summary>` がサニタイズ後も残ること） | demo-vault (markdown-showcase.md) |
| REQ-CONTENT-013 | unit test（callout 種別ごとの見た目・class 付与） | demo-vault (markdown-showcase.md) |
| REQ-GRAPH-002, 003 | unit test（edge/backlink の生成） | basic-vault |

### 2.2 privacy / security

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-PUB-003〜005, REQ-SEC-001 | privacy scan + golden test | privacy-vault |
| REQ-PUB-006, REQ-SEC-002 | privacy scan | privacy-vault |
| REQ-SEC-003 | unit test（既知の攻撃パターンに対するサニタイズ確認） | security-vault |
| REQ-SEC-004 | human review（LOOP.md の安全策が守られているかのレビュー、テストでは表現しきれないため） | - |

### 2.3 公開リポジトリ内容

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-PUB-007 | schema validation（出力ディレクトリに許可されたファイル種別のみ存在することを確認）+ privacy scan | basic-vault |

### 2.4 build 決定性

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-BUILD-001 | golden test（同一入力で 2 回 build し、出力 hash が一致することを確認） | basic-vault |
| REQ-BUILD-002 | schema validation | basic-vault |

### 2.5 UX

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-UX-001, 002, 003 | unit test + 最小限の browser E2E test | basic-vault |
| REQ-UX-004 | golden test（外部依存なしで静的ファイルとして開けること） | basic-vault |
| REQ-UX-005 | human review（主画面がノート/ドキュメントビューであること） | basic-vault |
| REQ-UX-006 | unit test（全ノートページに index.html へのナビゲーションリンクが存在すること） | basic-vault |
| REQ-UX-007 | unit test（git コミット日時ベースの算出・非 git 環境や未コミットファイルでの「不明」扱い・UTC 静的表示・検索対象への包含、[ADR-0015](../decisions/ADR-0015-note-modified-at-source.md)）+ browser E2E test（JS によるローカルタイムゾーン表示への強化） | basic-vault |
| REQ-UX-008 | unit test（`#tag` が index.html へのフィルタリンクに変換されること）+ browser E2E test（タグクリックでの遷移） | basic-vault |
| 美しさ・視覚的品質全般 | human review（自動スコア化しない） | - |

### 2.6 v0.2: Graph UI / 性能 / OPS

| REQ | 検証方法 | fixture |
|---|---|---|
| REQ-GRAPH-004 | unit test（graph.json への layout 座標出力）+ browser E2E test（`src/e2e/graph-ui.e2e.test.ts`、ノード描画・クリックでのノートページ遷移） | demo-vault, benchmark-vault |
| REQ-GRAPH-005 | unit test（build 時の d3-force layout 事前計算結果の決定性） | benchmark-vault |
| REQ-UX-009 | browser E2E test（`graph.html` への相互リンクの存在・遷移） | demo-vault |
| REQ-UX-010 | browser E2E test（`src/e2e/graph-ui.e2e.test.ts`、pointer/touch イベントによる pan/zoom・tap-to-preview/tap-to-navigate の動作確認）+ human review（レスポンシブレイアウトの見た目） | demo-vault |
| REQ-PERF-001 | performance benchmark（`npm run bench`、`scripts/bench.mjs` による build 時間・first interactive frame・タグフィルタ latency・pan/zoom FPS の計測。reference environment は [ADR-0012](../decisions/ADR-0012-v0.2-performance-reference-environment.md)） | benchmark-vault |
| REQ-OPS-001 | human review（CI ワークフロー（`.github/workflows/ci.yml`）が push/pull request で typecheck・test を実行することの確認。ワークフロー自体を検証する自動テストは持たない） | - |
| REQ-OPS-002 | human review（`.github/workflows/deploy-demo.yml` によるデモサイトの GitHub Pages 自動公開の動作確認） | demo-vault |
| REQ-OPS-003 | human review（README のテンプレート workflow が記載通りに動作することの確認。enastro 自身のテストではエンドユーザー環境を再現しない） | - |
| REQ-EXPLORE-001〜005 | unit test（`src/render/client/exploration.test.ts`、ログ計算・rewind・quota捕捉）+ browser E2E test（`src/e2e/exploration.e2e.test.ts`、Mark as read・index/graph の減光・rewind・ストレージ警告） | basic-vault |
| REQ-EXPLORE-006 | privacy scan 相当の確認（既存の `site.privacy.test.ts` 等を再実行し、`graph.json`/`search-index.json`/生成 HTML に既読情報が含まれないことを確認） | basic-vault |
| REQ-EXPLORE-007 | unit test（`parseModifiedAt`, search-index.json 同期ロジック）+ browser E2E test（ID不一致通知、更新されたノートの自動unread通知、fetch失敗時のフォールバック） | basic-vault |
| REQ-EXPLORE-008 | unit test（`resetLogAt`, `squashStateUntil`）+ browser E2E test（Reset to here / Squash until here の確認ダイアログ・実行後の状態） | basic-vault |
| REQ-EXPLORE-009 | unit test（`src/render/client/exploration.test.ts`、カーソル位置の永続化・now/Snapshot 判定・ボタン活性条件）+ browser E2E test（`src/e2e/exploration.e2e.test.ts`、ページ遷移/リロードをまたぐカーソル・ドロワー開閉状態の保持） | basic-vault |
| REQ-UX-011 | unit test（`src/render/client/theme-switcher.test.ts`、テーマ選択の永続化・適用ロジック）+ unit test（`src/vault/config.test.ts`、`defaultTheme` のバリデーション）+ browser E2E test（`src/e2e/theme-switcher.e2e.test.ts`、ダイヤル/`<select>` からの選択・3ページ間での一貫性、`src/e2e/site-config.e2e.test.ts`、`defaultTheme` の初回訪問時反映）+ human review（12テーマの見た目） | basic-vault |
| REQ-UX-012 | unit test（`src/render/client/particle-direction.test.ts`、方向トグルのロジック・backlink/edge データの不変性）+ unit test（`src/vault/config.test.ts`、`defaultParticleDirection` のバリデーション）+ browser E2E test（`src/e2e/particle-direction.e2e.test.ts`、トグル操作と粒子発射元の切り替わり・既定値、`src/e2e/site-config.e2e.test.ts`、`defaultParticleDirection` の初回訪問時反映） | demo-vault, benchmark-vault |
| REQ-UX-013 | unit test（`src/vault/config.test.ts`、`siteTitle` のバリデーション）+ browser E2E test（`src/e2e/site-config.e2e.test.ts`、`index.html`/`graph.html` の `<title>`/`<h1>` への反映） | basic-vault |
| REQ-UX-014 | unit test（`src/render/external-links.test.ts`、http(s) URL のみに `target`/`rel` が付与されること、相対リンク・mailto は不変） | demo-vault |
| REQ-UX-016 | unit test（行番号表示のCSS/マークアップ生成） | basic-vault |
| REQ-UX-017 | unit test（`lang` 情報の言語ラベルへの反映） | basic-vault |
| REQ-UX-018 | unit test + browser E2E test（コピーボタン押下でクリップボードへコード本文のみが渡ること、フィードバック表示） | basic-vault |
| REQ-UX-019 | browser E2E test（検索→ノート遷移後の検索語ハイライト） | basic-vault |

## 3. 引き続き自動検証を実施しない項目 [DEFERRED]

- visual regression（v0.2 でも自動化された visual regression は未導入。継続 DEFERRED）
- accessibility test（WCAG 準拠等の包括的検証。対象範囲が未定義のため継続 OPEN。タッチ操作対応のみ
  REQ-UX-010 の browser E2E test で検証する）

## 4. Human review が必須な項目 [DECIDED]

以下は自動判定に置き換えず、必ず人間のレビューを経る。

- 生成されたノートページ・検索結果の可読性
- privacy scan で検出されない、文脈依存の情報漏洩（例: 本文の言い回しから非公開ノートの内容が推測できてしまう場合）
- ADR で確定した設計方針からの逸脱がないかの最終確認
