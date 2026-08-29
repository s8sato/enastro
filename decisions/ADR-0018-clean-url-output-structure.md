# ADR-0018: Clean (Extensionless, Directory-Style) Output URLs

## Status

DECIDED（2026-08-29 ユーザー承認）

## Context

`spec/05-artifact-contracts.md` §2 の v0.1 出力ファイル構成は、`index.html`（サイト
ルート）を除くすべてのページを `<name>.html` という拡張子付きファイルとして書き出し
ていた（`graph.html`、`notes/<note-id>.html`）。ユーザーはこれを、拡張子を持たない
ディレクトリ形式の URL（`graph/`、`notes/<note-id>/`）に統一するよう要求した。

`spec/05-artifact-contracts.md` §6 は「artifact のファイル構成・schema が変わる場合は
ADR を作成する」と定めており、本変更はこれに該当する。

## Decision

ルートの `index.html` を除くすべてのページを `<name>/index.html` として書き出す。
ブラウザは拡張子なしのディレクトリ URL（`<name>/`）を要求し、ホスト側がそれを
`<name>/index.html` に解決する。

```
dist/
├── index.html            # サイトルート（"./"、変更なし）
├── graph/
│   └── index.html        # "graph.html" だった "graph/"
├── notes/
│   └── <note-id>/
│       └── index.html    # "notes/<note-id>.html" だった "notes/<note-id>/"
├── search-index.json
├── graph.json
└── assets/
```

- ルートの `index.html` のみ例外的にディレクトリの暗黙的インデックスとして扱われる
  （既存の Web の慣習と同じで、変更を要しない）。
- 旧 `*.html` URL への後方互換（リダイレクト・二重生成）は提供しない。クリーンブレイク
  とする（v0.1 の PROPOSED 状態のためリリース後の外部リンクの安定性保証がまだない）。

### 検討した代替案

- **現状維持（`.html` 拡張子）**: 却下。ユーザーの明示的な要求に反する。
- **`.html` を保持しつつリダイレクト HTML を `<name>/index.html` に追加**: 却下。
  出力ファイル数が倍増し、`REQ-BUILD-001`（決定的 build）の検証対象が不必要に増える。
  クリーンブレイクで十分との判断（ユーザー確認済み）。

## Consequences

- ディレクトリ URL を `index.html` に解決する機能は、ホスト側（GitHub Pages、
  `npx http-server` 等）が標準で提供する。本プロジェクト自体が提供する唯一のサーバー
  実装である `src/e2e/static-server.ts`（E2E テスト専用、実運用では使われない）だけは、
  この解決ロジックを自前で持たないため、本 ADR の実装に合わせて追加する。
- 全ページ間の相対リンク生成（`src/render/page.ts`、`src/render/substitute-links.ts`、
  `src/render/substitute-tags.ts`、`src/render/client/graph-view.mjs`）は、各ページの
  ディレクトリ深さが1段ずつ増える（`graph.html` の深さ0→`graph/index.html` の深さ1、
  `notes/<id>.html` の深さ1→`notes/<id>/index.html` の深さ2）ことに合わせて再計算する。
- `spec/05-artifact-contracts.md` §2 の出力構成、および `spec/01-scope-and-requirements.md`
  の REQ-UX-015 に反映する。
