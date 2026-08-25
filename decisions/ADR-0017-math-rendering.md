# ADR-0017: Math (KaTeX) Rendering — Server-Side, Placeholder-Bypassed Sanitization

## Status

DECIDED（2026-08-26 ユーザー承認）

## Context

`spec/02-content-semantics.md` §1 は「math (KaTeX)」を REQ-CONTENT-005 の DEFERRED
対象として明示的に列挙していた。パーサーはこれをエラーにせずプレーンテキストとして
素通しするのみで、実際のレンダリングは行っていなかった
（`fixtures/demo-vault/markdown-showcase.md` の「封印された奥義」節に、未対応である
旨のプレースホルダー記述がある）。

本 ADR は、この DEFERRED 項目を実装対象に昇格させ（新設 REQ-CONTENT-010）、その
実現方式を決定する。

### 検討した論点

1. **レンダリングをどこで行うか（build time server-side か、browser client-side か）**

   本リポジトリは既に highlight.js による構文ハイライトを build time に
   `hljs.highlight()`（Node API）で実行し、結果を静的 HTML に焼き込む方式を採用している
   （`src/render/render-note.ts`）。これは REQ-UX-004（サーバーランタイム不要な portable
   static artifact）・REQ-BUILD-001（決定的ビルド）と一貫しており、client 側に新たな
   JS ライブラリを配信する必要もない。数式レンダリングも同じ理由から
   **server-side, build time**（`katex.renderToString()`）を採用する。

2. **KaTeX の出力を sanitize-html の allowlist にどう通すか**

   `src/sanitize/config.ts` は REQ-SEC-003 に基づく厳格な allowlist
   （tag/attribute/class の明示列挙）である。KaTeX の HTML 出力は、正しい字形・位置
   合わせのために大量の内部 CSS class（`mord`/`mbin`/`vlist`/`strut`/`sizing` 等、
   `katex-` 接頭辞を持たないものも多い）と、要素ごとの inline `style` 属性
   （`top`/`margin-left`/`vertical-align` 等の数値指定）に依存する。

   これを allowlist に反映する案（class 名の正規表現・style プロパティ値パターンの
   個別許可）も検討したが、**不採用**とした。理由:

   - KaTeX の内部 class 語彙はライブラリの実装詳細であり、バージョンアップで無告知に
     追加・変更・削除されうる。allowlist をそれに追従させ続けるのは継続的な
     メンテナンスコストであり、追従を怠ると「特定の記法だけ静かに崩れて描画される」
     という気づきにくい形の劣化を招く（過去のセッションで確認された
     「メンテナンスコスト軽減・ドキュメント陳腐化対策」という repo 全体の懸念と同種）。
   - inline `style` 属性を広く許可することは、たとえ数値パターンに制限しても
     allowlist 全体の複雑さと将来のレビュー負荷を増やす。

   代わりに、**プレースホルダー方式**を採る（詳細は Decision 参照）。KaTeX が生成する
   HTML は、sanitize-html の allowlist フィルタを一切通さず、その代わりに
   **KaTeX 自身の `trust: false`** をこのコンテンツ種別に対する信頼境界として用いる。
   `trust: false`（既定値）は `\href`（http(s) 以外のスキーム）・`\includegraphics`・
   `\htmlId`/`\htmlClass`/`\htmlStyle`/`\htmlData` 等、任意の HTML/CSS を注入しうる
   コマンドを無効化する、KaTeX 自身が提供するセキュリティ機構である。

3. **区切り文字と出力モード**

   Obsidian 互換の `$...$`（inline）・`$$...$$`（block）のみをサポートする
   （`\(...\)`/`\[...\]` は非対応、必要になれば追加可能な小さな変更）。
   出力は KaTeX の `output: "html"`（HTML のみ、MathML 二重ツリーを含まない）とする。
   REQ-UX-010 が WCAG 等の包括的 accessibility 対応を既に DEFERRED としているため、
   MathML によるスクリーンリーダー対応の追加コストは今回見送る。

4. **markdown-it プラグインの追加依存**

   `markdown-it-texmath` 等の既存プラグインではなく、`$`/`$$` 検出・プレースホルダー
   差し込みを行う小さな自前の markdown-it block/inline rule を実装する
   （`src/render/math.ts`）。追加する npm 依存を `katex` 一つに限定し、
   サプライチェーン上の攻撃対象面を最小化する。

## Decision

1. `katex`（npm）を build 時 dependency として追加する。
2. `src/render/math.ts` に、markdown-it の block rule（`$$...$$`）・inline rule
   （`$...$`、`\$` エスケープ対応）を実装する。これらはコードフェンス／インライン
   コードの markdown-it 標準ルールより後に評価されるため、コード内の `$` が誤って
   数式として解釈されることはない。
3. 各ルールの renderer は `katex.renderToString(tex, { throwOnError: false, trust:
   false, strict: "ignore", output: "html", displayMode })` を呼び、結果 HTML を
   `env.__mathFragments`（`markdown.render(text, env)` の `env` 上の配列）に退避し、
   一意なプレースホルダー文字列（例: `` `\u0000MATH:${index}\u0000` ``）をトークンの
   出力として返す。
4. `src/render/render-note.ts` の `renderNoteBody()` は、`sanitizeHtml()` 実行後に
   プレースホルダーを `env.__mathFragments` の実 HTML に置換する。プレースホルダーは
   単なるテキストであり、`sanitizeHtml()` を無傷で通過する。KaTeX が生成した HTML
   自体はサニタイズ後にのみ挿入されるため、allowlist の対象に一切ならない。
5. `src/sanitize/config.ts` の allowlist は変更しない。KaTeX 出力を通すためのコメントを
   1行加え、将来の読者が誤って allowlist 拡張で「修正」しないようにする。
6. `katex.min.css` とそのフォント一式は、`pixi.js` と同じ
   `require.resolve()`ベースの vendoring パターンで `node_modules/katex/dist` から
   ビルド成果物にコピーする（`src/build/site.ts`）。全ページ共通の `<head>` に
   `<link rel="stylesheet">` を追加する。

## Consequences

- 数式を含まない vault でも、`katex.min.css` とフォント一式（数百 KB）が
  常にビルド成果物に含まれる。既存の `pixi.min.mjs`/`site.css` と同じ
  「常時同梱」パターンに合わせた単純さを優先した判断であり、性能要件
  （spec/07-performance.md）上の懸念が実際に生じた場合は、vault が数式を
  含む場合にのみコピーする最適化を別途検討する。
- サニタイザーの allowlist は KaTeX 特有の class/style を一切知らなくてよい
  （メンテナンス容易性）が、その代償として「KaTeX が生成した HTML はサニタイズ
  対象外」という例外パスが render-note.ts に存在することになる。この例外パスの
  正しさは KaTeX 自身の `trust: false` に依存するため、`katex` の
  バージョンアップ時は `trust`/`strict` オプションの既定値・意味に変更がないか
  確認する運用注意点として残る。
- `\(...\)`/`\[...\]` 記法は非対応（必要になれば `math.ts` への小さな追加で対応可）。

## Mechanism

- 実装: `src/render/math.ts`（新設）, `src/render/render-note.ts`（配線）,
  `src/build/site.ts`（katex アセット vendoring）, `src/render/page.ts`（CSS link）,
  `src/sanitize/config.ts`（コメントのみ）。
- 検証: unit test（`src/render/math.test.ts` — inline/block 描画、コード内 `$` の
  非干渉、不正 LaTeX の非クラッシュ、`\href{javascript:...}` の無害化）、
  `fixtures/demo-vault/markdown-showcase.md` の目視確認、既存 golden/compatibility/
  security テストの回帰確認。
