# AGENTS.md

このリポジトリで作業する、人間・AI エージェントすべてに適用される規約。

## 1. spec-driven development

- 正本は `spec/` および `decisions/ADR-*.md` である。実装がこれらと食い違う場合、どちらを正すべきかを明示してユーザーの承認を求める（実装を仕様に黙って合わせる、または仕様を実装に黙って合わせる、のどちらも禁止）。
- 各要件・決定には `DECIDED` / `PROPOSED` / `OPEN` / `DEFERRED` のいずれかの状態が明記されている。
  - `DECIDED` はユーザーが決定した事項であり、エージェントが単独で変更してはならない。変更したい場合は新しい ADR を提案し、ユーザーの承認を得る。
  - `PROPOSED` はエージェントが提案し、まだ承認されていない事項。実装の前提にしてよいが、実装完了時にユーザーへ承認を求める。
  - `OPEN` は未決事項。エージェントが勝手に確定してはならない。
  - `DEFERRED` は MVP (v0.1) 以降へ延期した事項。理由なく先回りして実装してはならない。

## 2. 文書・コードの言語

- spec / ADR / README 等の文書は日本語（[ADR-0008](decisions/ADR-0008-documentation-and-code-language-policy.md)）。
- コード・identifier（変数名・関数名・型名等）は英語。
- コードコメントは英語を基本とするが、日本語話者向けの補足が必要な場合は日本語を許容する。

## 3. Privacy invariant は最優先

- [08-security-and-privacy.md](spec/08-security-and-privacy.md) の privacy invariant は、機能・性能・実装容易性より優先される。
- privacy invariant を満たすテストを、性能達成や実装簡略化のために緩和・削除・skip してはならない。

## 4. Requirement / ADR / Fixture の対応関係を保つ

- 新しい実装コードを追加する際は、対応する `REQ-*` を明示する（コミットメッセージまたは PR 説明に記載）。
- 新しい設計判断を行う場合は ADR を追加する。既存 ADR を変更する場合は理由を明記し、ユーザーの承認を得る。

## 5. ループ運用

- 実装作業は [LOOP.md](LOOP.md) のループ定義に従って行う。
- 各ループの Success condition / Stop condition / Escalation condition を厳守する。

## 6. 依存関係・製品コードの追加

- 新しい依存関係の追加は、そのループの Allowed scope に明記されている場合のみ行う。
- MVP に不要な機能を先回りして実装しない（[00-product-vision.md](spec/00-product-vision.md) 設計原則）。
