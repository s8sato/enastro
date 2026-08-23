# LOOP.md

enastro の実装は、目標・実装・検証・修正を反復する loop engineering で進める。
各ループは、着手前に次の要素を明記した「ループ定義」として提示し、ユーザーの承認を得てから実行する。

## ループ定義のテンプレート

```
Goal:                 このループで達成する具体的な状態（REQ-* を参照）
Context:              関連する spec / ADR / 前回ループの結果
Allowed scope:        変更してよいディレクトリ・ファイル・依存関係
Forbidden changes:    このループで変更してはならないもの
Implementation actions: 実行予定の具体的な作業
Verifiers:            実行する検証（unit/property/golden/schema validation/privacy scan/E2E/visual regression/a11y/perf/human review）
Success condition:    ループが成功したと判断する条件
Stop condition:       途中で停止し報告すべき条件
Escalation condition: ユーザーに判断を仰ぐべき条件
Evidence to report:   完了報告に含める証跡（実行コマンド、測定値、diff 等）
```

## 安全策（すべてのループに適用）

1. エージェントは仕様を満たすために acceptance criterion を勝手に弱めない。
2. エージェントはテストを通すために fixture を都合よく変更しない。
3. エージェントは性能達成のために node、edge、機能を黙って省略しない。
4. エージェントは privacy invariant を warning へ格下げしない。
5. 同じ失敗を反復するとき（目安: 同一原因で 2 回連続失敗）は無制限に続行せず停止・報告する。
6. 仕様間に矛盾がある場合は推測で解消せず停止・報告する。
7. scope 外の大規模 refactoring を行わない。
8. 実行した command、測定値、未解決事項を完了報告に含める。
9. 文書と実装に差が生じた場合は、どちらを変更すべきかを明示してユーザーの承認を求める。
10. `DECIDED` とされた事項を、新しい ADR とユーザー承認なしに変更しない。

## ループの粒度

- 1 ループは 1 つの vertical slice、または 1 つの明確な検証可能な単位に対応させる。
- 星空 UI、MCP、VS Code 拡張、大規模性能最適化のループは、基礎的な content semantics / privacy semantics
  （[02-content-semantics.md](spec/02-content-semantics.md), [03-publishing-semantics.md](spec/03-publishing-semantics.md),
  [08-security-and-privacy.md](spec/08-security-and-privacy.md)）が確立するまで開始しない。

## 完了報告の様式

各ループの完了時、次を報告する。

1. 実行した command とその結果
2. 満たした REQ / 満たせなかった REQ
3. 測定値・テスト結果
4. 未解決事項・次ループへの引き継ぎ事項
5. 文書との差分（あれば）とその扱い方の提案
