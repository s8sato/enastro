# ADR-0004: Public Repository Content Policy

## Status

DECIDED

## Context

生成された Digital Garden を配置する公開リポジトリに、何を含めてよいかを決める必要がある。

## Decision

- 公開リポジトリ / 出力には、ビルド済みの静的 artifact（HTML/CSS/JS/JSON）のみを含める。
- Markdown ソース、vault 内部パス、build 設定、build ログは含めない。

検討した代替案:

- artifact + sanitize 済み Markdown ソース: GitHub 上での可読性は上がるが、sanitize 漏れのリスク面が増える。
- artifact + build 設定/ログ: 再現性検証に便利だが、意図しない情報（内部パス等）を含みやすい。

将来的に `--include-source` のようなオプションを追加する余地は残すが、v0.1 の既定・唯一の挙動は artifact のみとする。

## Consequences

- 公開面の攻撃面・漏洩面を最小化できる。
- GitHub 上で Markdown を直接閲覧したいユーザーには不便。
