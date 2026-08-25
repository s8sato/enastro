# enastro

**enastro** は、[Obsidian](https://obsidian.md/) の vault（ノートの保管フォルダ）の中から
「公開してよいノートだけ」を選んで、プライバシーを守りながら星空のような
Knowledge Graph サイトとして書き出す CLI ツールです。

サーバーもデータベースも不要です。生成されるのは HTML と JSON だけの静的ファイル一式なので、
GitHub Pages のような無料の静的ホスティングにそのまま置くだけで公開できます。

## デモ

![Graph view のスクリーンショット](docs/screenshots/graph-view.png)

実際に動く例を GitHub Pages 上に公開しています: **https://s8sato.github.io/enastro/**

（このデモは [fixtures/demo-vault](fixtures/demo-vault) というサンプル vault を、
このリポジトリの CI が自動でビルド・公開しているものです。）

### 性能: 10,000 nodes / 50,000 edges

https://github.com/user-attachments/assets/e0fb3ff7-5b91-43b7-88bb-a117f7adf170

`fixtures/benchmark-vault`（10,000 notes / 50,000 edges 規模）を対象に、Graph UI の pan/zoom
操作を実際に動かしている様子です。計測方法・数値目標との比較は
[spec/07-performance.md](spec/07-performance.md) を参照してください。

### グラフ画面でのタグによるフィルタリング

https://github.com/user-attachments/assets/0ef2ff1e-9df2-4151-b8b4-0b892f08ebc6

Graph view は All notes ページと同じタグフィルタ UI を備えています。タグを選択すると、
そのタグをすべて持つノート（AND 条件）だけが残り、それ以外のノード・エッジ・エネルギー粒子は
非表示になります。

## これは何がうれしいのか

- 手元の Obsidian vault には、人に見せたいノートと、見せたくない下書き・日記・秘密のメモが
  混在していますよね。enastro は、ノートの frontmatter に `publish: true` と書いたものだけを
  公開します。
- 公開しないノートへのリンク・タグ・別名（alias）・そのノートが存在すること自体が、
  公開されたサイトから一切わからないように作られています（**privacy invariant**）。
  「うっかり非公開メモの内容が漏れる」ことを防ぐのが、このツールの一番の目的です。
- ノート同士のつながりは、リンクの一覧（backlink）だけでなく、星空のように光る点と線として
  眺めることもできます（Graph view）。

詳しい設計思想は [spec/00-product-vision.md](spec/00-product-vision.md) を参照してください。

## クイックスタート（非エンジニア向け）

必要なもの: [Node.js](https://nodejs.org/)（バージョン 22 以上を推奨）がインストール済みのこと。

1. このリポジトリを取得し、依存関係をインストールします。

   ```bash
   git clone https://github.com/s8sato/enastro.git
   cd enastro
   npm install
   npm run build
   ```

2. 公開したい Obsidian vault の中で、公開したいノートの frontmatter（ファイル先頭の `---` で
   囲まれた部分）に `publish: true` を追加します。

   ```markdown
   ---
   publish: true
   tags: [公開したいノート]
   ---

   # ノートのタイトル

   本文...
   ```

3. サイトを生成します。

   ```bash
   npx enastro <あなたのvaultのパス> [出力先フォルダ（省略時は ./dist）]
   ```

4. 生成された出力フォルダ（既定では `dist/`）を、任意の静的サーバーで表示して確認します。

   ```bash
   npx http-server dist
   ```

   （`file://` として直接ブラウザで開くと、検索機能などが動かない場合があります。必ず
   何らかの http サーバー経由で開いてください。）

5. 問題なければ、`dist/` フォルダの中身をそのまま GitHub Pages 等の静的ホスティングにアップロード
   すれば公開完了です。

   > **注意**: `dist/` フォルダ（enastro が生成した静的サイト）は公開して問題ありませんが、
   > **vault リポジトリ本体（Markdown の生データ）を public にしてはいけません**。vault には
   > `publish: false` の下書き・日記なども含まれており、リポジトリ自体を public にすると
   > それらの生ファイルがそのまま世界に公開されてしまいます。privacy invariant が守るのは
   > enastro が生成した `dist/` の中身だけで、vault リポジトリの可視性は別問題です。

## GitHub Pages への自動公開（エンドユーザー向けテンプレート）

<details>
<summary>自分の vault を GitHub Actions で自動的に GitHub Pages へ公開する手順（クリックで展開）</summary>
<br>

自分の vault を、毎回手作業でアップロードするのではなく、GitHub Actions で自動的に
GitHub Pages へ公開したい場合の手順です。**vault リポジトリを private のまま保てるかどうかで
手順が変わる**ことに注意してください（GitHub Pages は Free プランでは public リポジトリでしか
有効化できません。private リポジトリで Pages を使うには GitHub Pro/Team/Enterprise が必要です）。

### パターン A: vault リポジトリを public にできる場合（最も簡単）

公開しても構わない vault（そもそも非公開ノートを含まない、または GitHub Pro 等で private
リポジトリでも Pages が使える）であれば、次の workflow を vault リポジトリの
`.github/workflows/deploy.yml` としてコピー&ペーストしてください
（[ADR-0013](decisions/ADR-0013-ci-github-pages-pipeline-scope.md)）。

```yaml
name: Deploy my vault to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # Full history (not the default shallow depth-1 clone) so each
          # note's displayed "Updated" date reflects its own real
          # last-commit date (REQ-UX-007, ADR-0015).
          fetch-depth: 0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22
      - run: npx enastro ./my-vault ./dist
      - uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0
```

`./my-vault` の部分を自分の vault のパスに書き換え、リポジトリの
「Settings → Pages → Source: GitHub Actions」を一度だけ有効にすれば、`main` ブランチへの
push のたびに自動でサイトが更新されます。

### パターン B: vault リポジトリを private のままにしたい場合（推奨・多くの人はこちら）

非公開ノートを含む vault は、通常 private リポジトリで管理したいはずです。この場合、
**vault リポジトリ自体には Pages を設定せず**、次の 2 リポジトリ構成にします。

- `my-notes`（private）: vault の生データを置く、今まで通りのリポジトリ。
- `my-notes-site`（public）: enastro が生成した `dist/` の中身だけを置く、公開用の別リポジトリ。
  Settings → Pages → Source を `Deploy from a branch`（例: `main` ブランチ）にしておく。

`my-notes` 側に、ビルドした `dist/` を `my-notes-site` へ push するだけの workflow を追加します
（GitHub Pages 用の公式 action ではなく、素の `git push` を使うだけなのでサードパーティ action には
依存しません）。`my-notes-site` への書き込み権限を持つ [Personal Access Token](https://github.com/settings/tokens)
（`my-notes-site` に対する `contents: write` 権限に絞った fine-grained token を推奨）を発行し、
`my-notes` リポジトリの Settings → Secrets and variables → Actions に `SITE_REPO_TOKEN` として
登録してください。

```yaml
name: Build and push my vault to the public site repo

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # Full history (not the default shallow depth-1 clone) so each
          # note's displayed "Updated" date reflects its own real
          # last-commit date (REQ-UX-007, ADR-0015).
          fetch-depth: 0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22
      - run: npx enastro ./my-vault ./dist
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          repository: <your-github-user>/my-notes-site
          token: ${{ secrets.SITE_REPO_TOKEN }}
          path: site-repo
      - run: |
          rsync -a --delete --exclude .git dist/ site-repo/
          cd site-repo
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || git commit -m "Update published site"
          git push
```

この手順は、private vault のまま安全に運用できる代わりに、2 つのリポジトリと 1 つの
Personal Access Token の管理が必要になります。この private → public の橋渡しをより自動化された
仕組みとして enastro 自身が提供することは、privacy invariant に関わる設計検討が必要なため
現時点では見送っています（REQ-PUB-008, [ADR-0013](decisions/ADR-0013-ci-github-pages-pipeline-scope.md)）。
上記はあくまで一例であり、enastro が動作を保証・テストしているものではありません。

いずれのパターンでも、このテンプレートは enastro が代わりに公開してくれるものではなく、
**あなた自身のリポジトリ**で動く独立した workflow です。

</details>

## できること

- Markdown frontmatter（`publish`, タグ相当のフィールド）の解釈
- wikilink `[[note]]` / alias 付き `[[note|alias]]` / embed `![[note]]` / `#tag` の解釈
- 非公開ノートへの参照を安全に除去した public projection の生成
- 添付ファイルは allowlist マークがある場合のみ公開
- 決定的（deterministic）な静的 artifact の生成(同一入力 → 同一 content-hash)
- ノートごとの backlink 表示、全文検索、タグによる検索・フィルタリング
- レスポンシブレイアウト・タッチ操作対応の Graph view（星空グラフ、pan/zoom/pinch/クリック対応、
  タグによるノードフィルタリング）
- GitHub Actions による CI（typecheck・test）と、GitHub Pages への自動デモ公開
- ブラウザの `localStorage` に閉じた探索ステータス（既読/未読）の記録、rewind による過去時点の
  巻き戻し表示、History パネルからの `Reset to here` / `Squash until here`
- 12種のカラーテーマをクライアント完結で切り替え可能（ビルド成果物には一切書き込まれない）

MCP/CLI query interface などは引き続き対象外です。詳細は
[spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) §3 を参照してください。

## 開発者向け

```bash
npm test         # vitest によるテスト一式（unit / golden / privacy scan / security / compatibility / e2e）
npm run typecheck
npm run build
```

- `spec/` — 正本となる仕様書（要件・アーキテクチャ・受け入れ基準など）
- `decisions/ADR-*.md` — 個々の設計判断（Architecture Decision Record）
- `fixtures/` — 各 REQ の検証に使う vault fixture 群（`fixtures/demo-vault` は上記デモサイトの元データ）
- `LOOP.md` — 実装作業の進め方（loop engineering）
- `AGENTS.md` — このリポジトリで作業するすべてのエージェント・開発者に適用される規約

性能測定（10,000 nodes / 50,000 edges の代表データセットに対する build 時間・Graph UI の応答性）は
[spec/07-performance.md](spec/07-performance.md) と
`npm run generate:benchmark-vault && npm run bench` を参照してください。

仕様と実装の対応関係（traceability）は
[spec/01-scope-and-requirements.md](spec/01-scope-and-requirements.md) §5 および
[spec/09-acceptance-and-evaluation.md](spec/09-acceptance-and-evaluation.md) を参照してください。

## ライセンス

[Apache License 2.0](LICENSE)（[ADR-0007](decisions/ADR-0007-oss-license.md) 参照）。
