# 08. Security and Privacy

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. Privacy invariant（最優先事項）[DECIDED]

以下は enastro のどの機能・性能目標よりも優先される不変条件である（REQ-SEC-001〜004）。実装・テストのいずれにおいても、これらを満たさない変更はマージしない。

1. 非公開ノートの本文は公開物に含まれない。
2. 非公開ノートの名前・パス・タグ・alias は公開物のいかなる場所（HTML, graph.json, search-index.json, ビルドログの公開部分等）にも現れない。
3. 「非公開ノートが存在する」という事実そのものが、公開物から推測可能な形で現れない（例: リンク切れの見た目から非公開ノートの存在が示唆されない）。
4. 添付ファイルは、明示的に allowlist されない限り公開されない。
5. ノート内の HTML/script は、公開前にサニタイズされる。

## 2. 非公開参照の扱い [DECIDED]

- 公開ノートから非公開ノートへの wikilink/embed は、public projection の生成段階で edge ごと除去する（REQ-PUB-003, REQ-PUB-005）。
- 除去が発生したことは、著者本人が読む非公開ビルドログにのみ warning として出力する（REQ-PUB-004）。

## 3. サニタイズ方針 [PROPOSED]

- ノート本文中の raw HTML は、既知の安全なタグ・属性のみを許可する allowlist 方式でサニタイズする。
- `<script>` タグ、`on*` イベント属性、`javascript:` スキームの href/src は常に除去する。
- 実装には実績のある HTML サニタイズライブラリの利用を優先し、自前の正規表現ベースのサニタイズを避ける（OWASP の推奨に整合）。
- 具体的なライブラリ選定は実装ループで提示する。

## 4. 検証方法 [DECIDED]

- privacy invariant は fixtures/privacy-vault, fixtures/security-vault に対する **privacy scan**（公開 artifact 全体を走査し、非公開ノートの識別子・タイトル・パスが一切出現しないことを確認する自動テスト）で検証する。
- サニタイズは fixtures/security-vault に対する **unit test**（既知の攻撃パターンを含む入力に対し、出力に script 実行可能な要素が残らないことを確認）で検証する。
- これらのテストは [LOOP.md](../LOOP.md) の安全策により、性能や実装都合を理由に緩和されてはならない。

## 5. 脅威モデルの範囲 [OPEN]

- 悪意ある vault 所有者（自分自身）を脅威主体に含めるかは OPEN（通常は含めない前提だが明記が必要）。
- 公開後の静的サイトに対する外部からの攻撃（例: 第三者が生成物を改ざんして再配布する）は本プロジェクトの直接のスコープ外とし、配布経路（GitHub Pages 等）のセキュリティに委ねる。

## 6. クライアント側ローカル状態（探索ステータス）[DECIDED]

- 「探索ステータス」（ノートごとの既読/未読、REQ-EXPLORE-001〜006、[ADR-0014](../decisions/ADR-0014-node-exploration-status-persistence.md)）は、閲覧者のブラウザの `localStorage` にのみ保存されるクライアント完結の状態であり、build 時にもサーバー側にも一切送信・保存されない。
- この状態は `graph.json` / `search-index.json` / 生成 HTML を含むいかなる公開 artifact にも書き込まれない（REQ-EXPLORE-006）。privacy invariant（§1）は非公開ノートの漏洩を対象としており、この探索ステータス機能は同invariant に抵触しないことを、既存の privacy scan（§4）と同種の考え方で確認する。

