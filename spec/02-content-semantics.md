# 02. Content Semantics

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. 対応する Obsidian Flavored Markdown（OFM）の範囲 [DECIDED]

v0.1 では以下の最小セットのみをパーサーが解釈する（REQ-CONTENT-001〜004）。

- Wikilink: `[[note]]`, alias 付き `[[note|display text]]`
- Embed: `![[note]]`
- Tag: `#tag`（frontmatter の `tags:` および本文中のインライン tag）
- YAML frontmatter: 少なくとも `publish: true|false` と tag 相当のフィールド

以下は v0.1 では **非対応**（REQ-CONTENT-005, DEFERRED）。パーサーはこれらをエラーにせず、プレーンな Markdown/テキストとして素通しする。

- Callout (`> [!note]`)
- 見出しリンク (`[[note#heading]]`)
- ブロック参照 (`[[note#^blockid]]`)
- Dataview 風クエリ
- Canvas
- Footnote, table, math (KaTeX) 等の拡張構文の特別処理

## 2. Wikilink 解決規則

### 2.1 基本解決 [DECIDED]

- `[[note]]` はノートの **ID**（ファイル名から拡張子を除いたもの、NFC 正規化）と一致する
  ノートに解決する（[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)）。
  frontmatter の `title` は解決に一切関与しない。
- `[[note|alias]]` は解決先ノートは `note` と同一だが、表示テキストは `alias` を使う。
- ノートの ID は vault 内で一意でなければならない（拡張子を除いたファイル名の衝突は
  build を失敗させる **MUST**）。これは、リンクを常にファイル名で解決するという
  Obsidian 互換性と、ディレクトリ構成（非公開ディレクトリ名等）を artifact に一切
  含めないという privacy invariant（[08-security-and-privacy.md](08-security-and-privacy.md)）を両立するための設計である。

### 2.2 alias と同名ノートの衝突 [DECIDED]

vault 内で、あるノートの `aliases:` frontmatter が別ノートの ID と衝突する場合、
**ID 一致を alias 一致より優先する**（REQ-CONTENT-006、[ADR-0009](../decisions/ADR-0009-note-id-title-separation.md)）。

- 理由: ID（ファイル名）は vault 内での一意な識別子であり、Obsidian 自身も常にファイル名
  で `[[link]]` を解決する。alias による上書きを許容すると衝突時の解決結果が
  直感に反するため。
- 実装: `fixtures/basic-vault/note-c-alias.md` の `aliases: [note-b]` は
  `note-b.md` の ID と衝突するが、`[[note-b]]` は常に `note-b.md` に解決される。
- 同一の alias 文字列が複数ノート間で衝突する場合（alias 同士の衝突）は本項の対象外
  であり、別途 OPEN（Graph IR 構築ループで暫定挙動を実装し、必要なら別途 ADR 化する）。

### 2.3 broken link(存在しないノートへの link)[DECIDED]

- リンク先ノートが存在しない場合、build を失敗させない(REQ-CONTENT-007, MUST)。
- 表示方法: 元のリンク文字列(alias 表示名があればそれ、なければリンク先文字列)を
  プレーンテキストとして表示し、`<span class="broken-link">` でラップする
  (`src/render/substitute-links.ts`)。非公開ノートへの解決済みリンク(2.1参照)とは
  異なり、broken link は private な情報を一切含まないため、そのまま表示してよい。

### 2.4 タイトルの導出 [DECIDED]

- ノートの **タイトル**(表示用の名前)は、本文中の最初の第一レベル見出し(`# heading`)
  のテキストとする。第一レベル見出しが存在しない場合は ID をタイトルとして使う。
- frontmatter の `title` フィールドは無効な属性であり、指定されていても無視される
  (build error にはせず、警告として記録する)。
- ページには本文由来の見出し(存在する場合)以外に、タイトルを重複して表示する
  独立した `<h1>` 要素は生成しない。ノート ID は常にページ上部に小さく表示し、
  ワンクリックでコピーできるようにする。
- 詳細な設計判断・代替案は [ADR-0009](../decisions/ADR-0009-note-id-title-separation.md) を参照。

## 3. Backlink [DECIDED]

- あるノート A が B を wikilink する場合、B のページに A への backlink を自動生成する（REQ-GRAPH-003, REQ-UX-003）。
- backlink は公開 projection 内でのみ生成され、非公開ノートからの backlink は公開物に現れない（[03-publishing-semantics.md](03-publishing-semantics.md) 参照）。

## 4. ファイル名・文字コード [DECIDED]

- 日本語ファイル名や Unicode を含むノート名は正しく解決される（REQ-CONTENT-008）。
- ファイルシステムの正規化差異（NFC/NFD 等）による解決失敗を防ぐため、内部的にはタイトル文字列を正規化してから比較する（実装詳細は [04-architecture.md](04-architecture.md) 側で扱う）。

## 5. HTML / script の扱い [DECIDED]

- ノート本文に含まれる raw HTML やスクリプトタグは、公開 artifact へ含める前にサニタイズされる（REQ-SEC-003）。サニタイズの詳細規則は [08-security-and-privacy.md](08-security-and-privacy.md) を正とする。
