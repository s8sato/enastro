# ADR-0003: Attachment Publish Allowlist

## Status

DECIDED

## Context

添付ファイル（画像等）の公開可否を、参照の有無だけで決めるか、明示的なマークを要求するかを
決める必要がある。private by default 原則との整合性が問われる。

## Decision

- 添付ファイルは、公開ノートから参照されているという理由だけでは公開されない。
- 添付ファイルごとに明示的な公開マーク（allowlist）が付与されている場合のみ公開する。
- allowlist の具体的な指定方法は実装ループで提案し、承認を得る。

## Consequences

- 著者は画像等を公開するたびに明示的な操作が必要になる（執筆コストの増加）。
- 誤って機密画像やスクリーンショットを公開してしまうリスクを最小化できる。

## Mechanism (DECIDED, Loop 6)

具体的な allowlist 指定方法として、以下を採用する:

- vault 直下に配置する `enastro.config.json` の `publishAttachments` フィールド（vault相対パスの
  完全一致の文字列配列）で指定する。glob/パターンマッチは v0.1 では DEFERRED とする（完全一致のみ、
  誤って広範囲に公開するリスクを避けるため）。
- `enastro.config.json` にはこの他、ビルド時のサイト表示デフォルトを指定する `siteTitle` /
  `defaultTheme` / `defaultParticleDirection` フィールドも追加された
  （[ADR-0016](ADR-0016-vault-config-driven-site-defaults.md)）。
- サイドカーマーカーファイル方式や添付専用 frontmatter 方式ではなく config ファイル方式を選んだ理由:
  設定が一箇所に集約されプライバシー面で監査しやすく、config を書き忘れた場合は自動的に非公開
  （private by default）になるため。
- allowlist された添付ファイルは、元の vault 相対パスを保ったまま `dist/<同じ相対パス>` にコピーされる。
- 公開ノートが allowlist されていない添付ファイルを `[[...]]` / `![[...]]` で参照した場合は、
  非公開ノートへの参照（本 ADR 上部）と完全に同じ扱い（表示テキストを含め完全削除）とする。
  除去した事実は非公開のビルドログにのみ warning として出力する。
- 実装: `src/vault/config.ts`（config 読み込み）, `src/vault/discover-attachments.ts`（添付ファイル探索）,
  `src/vault/resolve-attachment.ts`（basename ベースの解決）, `src/render/substitute-links.ts`（置換）,
  `src/build/site.ts`（`dist/` へのコピー）。検証: fixtures/privacy-vault を用いた artifact レベルの
  privacy scan（`src/build/site.privacy.test.ts`）。
