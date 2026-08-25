# ADR-0016: Vault-Configurable Build-Time Site Defaults

## Status

DECIDED

## Context

`enastro.config.json`（[ADR-0003](ADR-0003-attachment-publish-allowlist.md)）は、これまで
`publishAttachments` のみを持つ添付ファイル allowlist 専用の設定ファイルだった。

一方、以下の3点は vault ごとに変えたいニーズがあるが、これまでビルドから固定的に扱われていた:

- サイトタイトル: `index.html` の `<title>`/`<h1>` が常に固定文字列（`<title>enastro</title>` /
  `<h1>Notes</h1>`）で、vault の内容に応じた名前を付けられなかった。
- テーマの初期値（REQ-UX-011）: 「ビルドは特定テーマに依存しない」と明記されており、初回訪問時
  （`localStorage` が空の時）の表示テーマは実装既定値（`moon`）に固定されていた。
- particle-direction の初期値（REQ-UX-012）: 同様に「設定は `localStorage` にのみ保存される」と
  明記されており、初回訪問時の初期方向は実装既定値（旧称 `dependency-first`、後述のとおり
  `backlink` に改称）に固定されていた。

REQ-UX-011/012 は DECIDED であり、これらの文言を変更するには本 ADR による明示的な改訂とユーザー
承認が必要（AGENTS.md 第1条）。

また、`dependency-first` という内部語彙は UI 上のラベル（Flow: backlink / wikilink 相当の表現）と
食い違っており、`backlink`（REQ-GRAPH-003 の backlink と同じ語）に統一する。

## Decision

1. `enastro.config.json` に以下の3フィールドを追加する（全て省略可、省略時は括弧内の既定値）:
   - `siteTitle: string`（既定値 `"Notes"`） — `index.html` の `<title>`/`<h1>` と `graph.html` の
     `<title>`（`{siteTitle} · Graph view`）に反映する。note ページ（`notes/{id}.html`）の
     `<title>` はノート自身のタイトルのままとし、対象外とする。
   - `defaultTheme: string`（既定値 `"moon"`） — 12種のテーマ id のいずれか。初回訪問時
     （`localStorage` に保存済みの選択が無い時）の初期テーマとしてビルド時に埋め込む。
   - `defaultParticleDirection: "wikilink" | "backlink"`（既定値 `"wikilink"`） — 初回訪問時の
     graph ページの粒子進行方向の初期値としてビルド時に埋め込む。
2. **ユーザーが一度でも明示的に選択した値（`localStorage` に保存された値）は、常にこのビルド時
   デフォルトより優先される。** ビルドは「初回訪問時にどちらを初期状態とするか」だけを vault ごとに
   選べるようにするものであり、ユーザー選択自体の永続化が `localStorage` にのみ行われるという
   REQ-UX-011/012 の不変条件（探索ステータス機能・[ADR-0014](ADR-0014-node-exploration-status-persistence.md)
   と同様の client-only 完結パターン）は維持する。ビルド成果物（`dist/`）にユーザーの選択を書き込む
   ことは引き続き一切行わない。
3. `defaultParticleDirection` の既定値を、内部語彙変更に合わせて `wikilink` とする
   （**既定値の変更**: 従来の実装既定値は `dependency-first`≒現 `backlink` だったが、
   REQ-GRAPH-002 の directed edge（`edge.source` → `edge.target`）と一致する `wikilink` を
   新たな既定値とする）。
4. 内部コード語彙 `dependency-first` を `backlink` に統一する（挙動は不変、名称の整合性のみの変更）。
   `src/render/client/particle-direction.mjs` / `graph-view.mjs` / 関連テストが対象。

## Consequences

- vault の著者は `enastro.config.json` を編集するだけで、サイトの見た目の初期状態
  （タイトル・初期テーマ・初期粒子方向）を自分の vault に合わせてカスタマイズできる。
- 省略時は全て既存互換の既定値（`"Notes"` / `"moon"` / `"wikilink"`）が適用されるため、
  既存 vault（`enastro.config.json` 未設置、または `publishAttachments` のみ指定済み）の
  ビルド結果は `defaultParticleDirection` の既定値変更以外、後方互換である。
- `defaultParticleDirection` の既定値変更（`backlink`→`wikilink`）は、既存 vault で
  `enastro.config.json` に `defaultParticleDirection` を明示していない場合、graph ページの
  初回訪問時の粒子の向きが変わるという破壊的変更を伴う。ユーザーが一度でもトグル操作をして
  `localStorage` に選択を保存していれば、その選択が優先されるため影響はない。
- `defaultTheme` の妥当性検証のために、12種のテーマ id リストが `src/vault/config.ts` と
  `src/render/client/theme-switcher.mjs` の2箇所に重複して存在する（server/build 側コードを
  browser-only client モジュールに依存させないための意図的な選択）。

## Mechanism

- 実装: `src/vault/config.ts`（`VaultConfig` 拡張・バリデーション）,
  `src/render/page.ts`（`RenderSiteConfig`、`renderIndexPage`/`renderGraphPage`/`renderNotePage`
  への配線、FOUC 抑止スクリプトの `defaultTheme` 埋め込み、particle-direction-toggle への
  `data-default-direction` 属性付与）, `src/build/site.ts`（`loadVaultConfig` の戻り値を
  render 関数へ配線）, `src/render/client/graph-view.mjs`（`data-default-direction` 属性を
  `localStorage` 未設定時のフォールバックとして参照）。
- 検証: unit test（`src/vault/config.test.ts` の新規フィールドバリデーション）、
  browser E2E test（`src/e2e/site-config.e2e.test.ts` — カスタム設定を注入した一時 vault での
  `<title>`/`<h1>`/`data-theme`/初期粒子方向の確認、`src/e2e/particle-direction.e2e.test.ts` —
  設定ファイル無しの `fixtures/basic-vault` での既定値 `wikilink` の確認）。
