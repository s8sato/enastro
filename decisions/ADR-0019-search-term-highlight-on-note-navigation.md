# ADR-0019: Search-Term Highlight on Note Navigation via URL Fragment

## Status

PROPOSED

## Context

REQ-UX-019 は、All notes ページ（`index.html`）の検索結果からノート詳細ページ
（`notes/<id>/`）へ遷移した後も、検索語を本文中でハイライトすることを求める。

検索は `search.mjs` がクライアントで `search-index.json` を絞り込むだけで、結果のリンク
（`renderIndexPage` が静的に出力する `notes/<id>/`）には検索語が含まれない。したがって、
検索語をノートページへ受け渡す手段と、ノートページ側でハイライトする方式を決める必要がある。

## Decision

- **受け渡し**: `search.mjs` が検索語の変化に合わせて各結果リンクの href に URL フラグメント
  `#hl=<encodeURIComponent(検索語)>` を付ける。検索語が空（空白のみを含む）の場合は付けない。
- **ハイライト**: ノートページで読み込む `assets/highlight.mjs` が `location.hash` から検索語を読み、
  `<article>` 内のテキストに出現する各語を `<mark class="search-hit">` で囲み、最初の一致へスクロールする。
  - 語の分割・照合規則は検索と同じにする（`filter.mjs` の `splitQueryTerms`：空白区切り、
    大文字小文字を区別しない部分一致）。照合に正規表現は使わない。
  - `pre`・`code`・`.katex`・`script`・`style` の配下は対象外とする。
  - DOM API（`splitText`・`createElement`）のみで操作し、`innerHTML` は使わない。
- **ビルド出力**: 変更はノートページへの `<script>` 追加と `highlight.mjs` の配置のみ。
  本文 HTML・`search-index.json` は変えない。
- ハイライトの解除 UI は設けない。

### 検討した代替案

- **query string（`?q=`）**: 却下。`?tags=` の前例には沿うが、静的ホストのアクセスログに検索語が残る。
- **`sessionStorage`**: 却下。新しいタブ・中クリックで開くと検索語が失われる。
- **Text Fragment（`#:~:text=`）**: 却下。複数語の AND 検索に対応できず、ブラウザ間で挙動が異なる。
- **ビルド時の `<mark>` 埋め込み**: 却下。検索語は閲覧時にしか存在しない。

## Consequences

- 検索語は URL フラグメントにのみ載り、ブラウザはこれをサーバーへ送信しない。公開 artifact や
  ストレージにも書き込まれないため、privacy invariant（spec/08 §1）に抵触しない。
- 決定的 build（REQ-BUILD-001）とクリーン URL（REQ-UX-015、ADR-0018）は維持される。
- 検索は id・title・tags・modifiedAt にも一致するため、本文に現れない語で絞り込んだ場合は
  ハイライトが 0 件になる。複数のテキストノードにまたがる語（例：一部だけ強調された語）も
  ハイライトされない。いずれも許容する。
- コードブロックへの行番号・コピー ボタン（REQ-UX-016/018）は、コードブロックを対象外としているため干渉しない。
