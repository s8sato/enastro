# ADR-0008: Documentation and Code Language Policy

## Status

DECIDED

## Context

これから作成する全 spec 文書・ADR・コード規約のデフォルト言語を決める必要がある。

## Decision

- spec / ADR / README 等の文書は日本語で記述する。
- コード・identifier（変数名・関数名・型名等）は英語で記述する。

検討した代替案:

- 文書・コードともに英語: 国際 OSS としての到達性は高いが、現時点の執筆負荷が増す。
- 文書・コードともに日本語: identifier の日本語ローマ字化は国際的な慣習から外れる。
- 主要 spec は英語、議論ログは日本語の bilingual 併記: 二重管理コストが発生する。

## Consequences

- 将来、英語話者コントリビューターが増えた場合、主要文書の翻訳判断が必要になる。
- コードは英語のため、OSS としての国際的な可読性は維持される。
