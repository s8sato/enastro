# ADR-0009: Note ID / Title Separation and ID-Based Wikilink Resolution

## Status

DECIDED

## Context

これまで enastro は「ノートのタイトル」という単一の概念を、(a) wikilink `[[note]]`
の解決キー、(b) 表示名、の両方に兼用してきた（[spec/02-content-semantics.md §2.1](../spec/02-content-semantics.md)）。
タイトルはファイル名、または frontmatter `title` で上書きされた値のいずれかであった
（REQ-CONTENT-001, REQ-CONTENT-006）。

この設計には実際上の問題がある。

1. **Obsidian 非互換**: 本物の Obsidian は wikilink を常にファイル名（と `aliases:`
   frontmatter）で解決し、`title:` のような任意の frontmatter フィールドはリンク解決に
   一切関与しない。しかし現行実装（[src/graph/resolve.ts](../src/vault/discover.ts)）は
   frontmatter `title` があるとタイトル索引がその値で上書きされ、`foo.md` に
   `title: "Bar"` と書くと本来 Obsidian で有効なはずの `[[foo]]` が解決できなくなる
   （ファイル名がどの索引にも登録されなくなるため）。
2. **見出しの重複**: 公開ページは `<h1>{タイトル}</h1>` を本文の直前に別途挿入するため、
   本文が独自の `# 見出し` から始まる場合、見た目上ほぼ同じ大見出しが2つ並ぶ
   （2026-08-23 のセッションで報告・議論）。

これらは ID とタイトルの役割を明確に分離し、タイトルの由来を「著者が別途指定する
frontmatter フィールド」ではなく「本文自身の内容」に一本化することで、同時に解消できる。

なお、ID 自体の生成規則（ファイルパスではなくファイル名 basename に固定し、vault 全体で
一意性を build 時に強制する）は本 ADR のスコープ外であり、既に spec/05-artifact-contracts.md
§2 の `PROPOSED` 事項の具体化として実装済み（Phase A、2026-08-23）。本 ADR は
その上に乗る「ID とタイトルの役割分離」および「wikilink 解決方式の変更」のみを扱う。

## Decision

1. **ID はリンク記述・URL・一意キーに用いる**。wikilink `[[X]]` は ID（=ファイル名
   basename）と一致するノートに解決する。alias（frontmatter `aliases:`）との衝突時は、
   ID 一致を alias 一致より優先する（現行 REQ-CONTENT-006 の「タイトル優先」を
   「ID 優先」に置き換える）。
2. **タイトルは表示専用の別概念とする**。タイトルは wikilink の解決に一切関与しない。
3. **frontmatter `title` は無効化する**。指定されていても無視し、非公開ビルドログのみに
   warning を出す（build は失敗させない）。既存 Obsidian vault が enastro 想定外の目的で
   `title:` を使っているケースへの不意打ちを避けるため。
4. **タイトルは「本文中の最初の h1 見出し」を採用し、無ければ ID をそのまま使う**。
   h1 抽出は本文パーサー（markdown-it）のトークン列から行い、コードブロックや
   blockquote 内の `#` を誤検出しない。
5. **公開ページは独立した `<h1>{タイトル}</h1>` を注入しない**。本文自身の最初の h1
   （存在すれば）がそのままページの唯一の大見出しとして機能する。h1 が本文に無い場合は、
   ID を小さく・ワンクリックでコピー可能な形でページ最上部に表示する（この ID 表示は
   h1 の有無によらず常に行う）。

検討した代替案:

- **タイトルは frontmatter で明示指定させ続ける**: 著者の自由度は高いが、Obsidian
  非互換の根本原因が残る。また「ファイル名／タイトルどちらを使えばリンクが解決するか」
  を著者が都度考える必要があり、認知負荷が高い。
- **本文見出しを一律 downshift する（`#`→`##`、`##`→`###`…）**: 見出し重複は解消できるが、
  Obsidian 非互換の問題は未解決のまま残る。また「ソースの `#` ≠ 出力の `<h1>`」という
  間接性を持ち込む点は本提案と同じトレードオフを負うにもかかわらず、Obsidian 互換性の
  改善という利点を得られない。
- **frontmatter `title` 指定時は build エラーにする**: 移行を強制できるが、
  enastro が関知しない目的で `title:` を使っている vault を無条件に壊すため、
  厳しすぎると判断（warning 運用を採用）。

## Consequences

- `spec/02-content-semantics.md §2.1-2.2` の改訂が必要（ID 優先の解決規則、タイトルの
  定義を「本文最初の h1」に変更）。
- `spec/01-scope-and-requirements.md` の REQ-CONTENT-006 の文言修正（「タイトル優先」→
  「ID 優先」）。
- `src/graph/resolve.ts`（`titleIndex` → `idIndex`）、`src/graph/build.ts`（タイトル導出
  ロジック）、`src/parser/frontmatter.ts`（`title` 無効化 + warning 検出）、
  `src/render/page.ts`（独立 `<h1>` 注入の削除、ID 表示 UI 追加）に実装変更が必要。
- 見出し抽出のための新規ヘルパー（`extractFirstH1`）と、ID コピー UI 用の新規クライアント
  アセットが必要。
- 既存 fixtures はいずれも frontmatter `title:` を使っていないため、fixtures 自体の
  破壊的変更は無い見込み（確認済み）。

## Open Items（本 ADR 承認後、実装ループで詰める）

- frontmatter `title` 検出時の warning 文言。
- 本文に h1 が複数ある場合は最初の1つを採用する（本 ADR で確定）。
- ID コピー UI の `navigator.clipboard` が使えない環境（`file://` 等）へのフォールバック。
