# ADR-0013: CI / GitHub Pages Publishing Pipeline Scope (v0.2)

## Status

PROPOSED

## Context

v0.1 は CI・自動公開パイプラインを一切持たない。REQ-PUB-008（private repo push を契機とした CI からの
自動公開）は v0.1 で明示的に DEFERRED とされ、この ADR はそれとは別範囲の CI/Pages 機能を扱う。
ユーザーは「CI 経由の GitHub Pages 公開パイプライン」として、(a) enastro 自身のデモサイトの自動公開と
(b) エンドユーザーが自分の vault を公開するための再利用可能な仕組み、の両方を希望した。

## Decision

- `.github/workflows/ci.yml`: push / pull request をトリガーに `npm ci` → `npm run typecheck` →
  `npm test` を実行する。既存の vitest スイート（unit / golden / privacy scan / security /
  compatibility / e2e）をそのまま流用する。
- `.github/workflows/deploy-demo.yml`: `main` ブランチへの push（および手動 `workflow_dispatch`）を
  トリガーに、本リポジトリ内の小規模なデモ用 vault（fixture、詳細は実装ループで確定）を
  `enastro` でビルドし、`actions/upload-pages-artifact` + `actions/deploy-pages`
  （GitHub 公式 action、サードパーティ action への依存を避ける）で本リポジトリの GitHub Pages に
  デプロイする。GitHub 側の Pages 設定（Source: GitHub Actions）の有効化は、agent が変更できない
  リポジトリ設定であるため、ユーザーが一度だけ手動で行う。
- 再利用可能な公開テンプレート: エンドユーザーが**自分の** vault を**自分の** Pages にデプロイするための
  GitHub Actions workflow のサンプルを、README または `docs/` 配下にコピー&ペースト可能な形で提供する。
  これは enastro が代行するものではなく、ユーザー自身のリポジトリで動く独立した workflow である。
  REQ-PUB-008（private → public の自動ミラーリング）とは明確に別物であり、REQ-PUB-008 は引き続き
  DEFERRED のままとする。

検討した代替案:

- サードパーティの Pages デプロイ action（例: `peaceiris/actions-gh-pages`）: 実績はあるが、
  サプライチェーンリスクを避けるため GitHub 公式 action を優先する。
- REQ-PUB-008 も同時に解禁する: private→public のミラーリングは privacy invariant に関わる設計が
  重く、v0.2 のスコープ外として明確に据え置く。

## Consequences

- 新規に `.github/` ディレクトリと 2 つの workflow ファイルが追加される。
- デモ用 vault の内容確定（既存 fixtures/basic-vault の流用か、新規 fixtures/demo-vault の作成か）が
  実装ループの To-Do として残る。
- README にエンドユーザー向け公開テンプレートの説明を追加する必要がある。
