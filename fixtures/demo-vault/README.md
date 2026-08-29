# fixtures/demo-vault

## 目的

CI 経由で GitHub Pages に自動公開する enastro 自身のデモサイト（[ADR-0013](../../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)）向けの、小規模で見栄えの良い vault。

`fixtures/basic-vault`・`fixtures/privacy-vault` 等が個別の REQ 検証を目的とした最小構成なのに対し、
この vault は「ノートの取り方（PKM: Personal Knowledge Management）」というテーマで書かれた
約 20 件の相互リンクするノートで構成し、Graph UI（`graph/`）が実際にどう見えるかを
訪問者に示すためのものである。

対応 REQ: REQ-OPS-002（[ADR-0013](../../decisions/ADR-0013-ci-github-pages-pipeline-scope.md)）、REQ-UX-014（`welcome.md` の外部リンクが新しいタブで開くことを実演する）。

## 構成

- 大半のノートは `publish: true`。
- `private-draft.md` のみ `publish: false` とし、`welcome.md` から意図的にリンクさせることで、
  privacy invariant（非公開ノートへの参照が静かに除去されること、REQ-PUB-003/005）を
  デモサイト上でも実演する。
- `graph-view.md` は存在しないノート `[[future-ideas]]` への broken link を含み、
  broken link の非致命化（REQ-CONTENT-007）を実演する。
- `markdown-showcase.md` は inline `$...$` / block `$$...$$` の数式（KaTeX）レンダリング
  （REQ-CONTENT-010、[ADR-0017](../../decisions/ADR-0017-math-rendering.md)）を実演する。

## 検証方法

`.github/workflows/deploy-demo.yml` がこの vault を `enastro build` し、GitHub Pages に配信する。
ローカルでの動作確認は他の fixture と同様、次のコマンドで行える。

```bash
npm run build
node bin/enastro.mjs fixtures/demo-vault /tmp/enastro-demo-out
```
