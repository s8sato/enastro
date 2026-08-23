# 06. UX and Visual Design

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. v0.1 の主画面 [DECIDED]

- v0.1 の主画面はノート/ドキュメントビューである（REQ-UX-005）。Graph UI（星空 UI）は v0.1 に含めない（DEFERRED）。
- 長期的には Graph UI を主画面に据える方針（製品構想と整合）。この移行方針・タイミングは Graph UI 着手ループで再設計する。

## 2. v0.1 で提供する機能 [DECIDED]

- 全文検索（REQ-UX-001）
- タグによる検索・フィルタリング（REQ-UX-002）
- ノートごとの backlink 一覧（REQ-UX-003）
- 静的ホスティング可能な出力（REQ-UX-004）

## 3. Graph UI 関連の未決事項 [OPEN]

以下は Graph UI 着手時に改めてユーザーへ質問する。

- 参考にしたい UI / 明確に避けたい UI
- 星の視覚表現（色・サイズ・アニメーション）の具体的な仕様
- edge 上の光/エネルギー粒子表現の具体的な仕様

## 4. 「美しさ」の評価方法 [DECIDED]

- 視覚的な美しさ・操作感の心地よさは、自動テストでスコア化しない。
- これらは human review を必須の検証手段とし、[09-acceptance-and-evaluation.md](09-acceptance-and-evaluation.md) に明記する。

## 5. broken link / private-link のレンダリング表現 [OPEN]

- [02-content-semantics.md](02-content-semantics.md) §2.3, [03-publishing-semantics.md](03-publishing-semantics.md) §2.1 の具体的な見た目（例: グレーアウト、除去のみ、注記表示）は実装ループで PROPOSED として提示し、承認を得る。
