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

- `[[note]]` はノートのタイトル（ファイル名から拡張子を除いたもの、または frontmatter の title）と一致するノートに解決する。
- `[[note|alias]]` は解決先ノートは `note` と同一だが、表示テキストは `alias` を使う。

### 2.2 alias と同名ノートの衝突 [OPEN]

vault 内で、あるノートの `aliases:` frontmatter が別ノートのタイトルと衝突する場合、どちらを優先して解決するかは未決定（REQ-CONTENT-006）。

- 候補 A: タイトル一致を alias 一致より優先する。
- 候補 B: alias 一致をタイトル一致より優先する。
- 候補 C: 衝突をエラー扱いにし、build を失敗させる。

`fixtures/basic-vault` にこのケースの fixture を用意し、実装ループで具体的な既定動作を PROPOSED として提示し、承認を得てから DECIDED にする。

### 2.3 broken link（存在しないノートへの link）[PROPOSED]

- リンク先ノートが存在しない場合、build を失敗させない（REQ-CONTENT-007, MUST）。
- 表示方法（例: プレーンテキスト化 / `.broken-link` クラス付与）は UX 観点の詳細設計であり、[06-ux-and-visual-design.md](06-ux-and-visual-design.md) で確定する。

## 3. Backlink [DECIDED]

- あるノート A が B を wikilink する場合、B のページに A への backlink を自動生成する（REQ-GRAPH-003, REQ-UX-003）。
- backlink は公開 projection 内でのみ生成され、非公開ノートからの backlink は公開物に現れない（[03-publishing-semantics.md](03-publishing-semantics.md) 参照）。

## 4. ファイル名・文字コード [DECIDED]

- 日本語ファイル名や Unicode を含むノート名は正しく解決される（REQ-CONTENT-008）。
- ファイルシステムの正規化差異（NFC/NFD 等）による解決失敗を防ぐため、内部的にはタイトル文字列を正規化してから比較する（実装詳細は [04-architecture.md](04-architecture.md) 側で扱う）。

## 5. HTML / script の扱い [DECIDED]

- ノート本文に含まれる raw HTML やスクリプトタグは、公開 artifact へ含める前にサニタイズされる（REQ-SEC-003）。サニタイズの詳細規則は [08-security-and-privacy.md](08-security-and-privacy.md) を正とする。
