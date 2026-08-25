# 03. Publishing Semantics

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. 公開選択規則 [DECIDED]

- ノートは frontmatter `publish: true` を持つ場合のみ公開対象になる（REQ-PUB-001）。
- `publish` が未指定、または `false` のノートは非公開ノートとして扱う（private by default）。
- 公開 artifact は、全 Knowledge Graph IR ではなく、公開対象ノートのみからなる public projection から生成する（REQ-PUB-002, REQ-GRAPH-001）。

## 2. 公開ノートが非公開ノートを参照した場合の挙動 [DECIDED]

### 2.1 wikilink の場合

- 公開ノート A が非公開ノート B を `[[B]]` で参照する場合、public projection には A→B の edge を含めない（REQ-PUB-003）。
- B の名前・パス・タグ・alias・存在（「B というノートがある」という事実そのもの）を、公開 HTML・graph JSON・search index 等いかなる公開 artifact にも露出させない（REQ-SEC-001）。
- 該当箇所は、A のノート本文中では非公開情報を含まない形（例: リンクの除去またはプレーンテキスト化）でレンダリングする。具体的なレンダリング表現は [02-content-semantics.md](02-content-semantics.md) §2.3 および実装ループで確定する。
- build はこの除去が発生したことを、非公開のビルドログにのみ warning として出力する（REQ-PUB-004）。warning 自体が非公開情報を含んでよいのは、著者本人が読むビルドログに限る。

### 2.2 embed の場合

- 公開ノートが非公開ノートを `![[B]]` で embed する場合も、§2.1 と同様に扱う（REQ-PUB-005）。

## 3. 添付ファイルの公開規則 [DECIDED]

- 添付ファイル（画像等）は、公開ノートから参照されているという理由だけでは公開されない。
- 添付ファイルは、ファイル自体に明示的な公開マーク（allowlist）が付与されている場合のみ公開対象になる（REQ-PUB-006, REQ-SEC-002）。
- allowlist の具体的な指定方法: vault 直下の `enastro.config.json` の `publishAttachments` フィールド（vault 相対パスの完全一致の文字列配列）で指定する（ADR-0003 Mechanism 参照）。glob パターンは v0.1 では DEFERRED。
- config ファイルが存在しない、または当該パスが記載されていない添付ファイルは非公開のまま（private by default）。
- allowlist された添付ファイルは、元の vault 相対パスを保持したまま `dist/<同じ相対パス>` にコピーされる。
- 公開ノートが非 allowlist の添付ファイルを参照した場合、非公開ノートへの参照（§2）と同様に完全に除去される（表示テキストを含む）。

`enastro.config.json` にはこの他、ビルド時のサイト表示デフォルトを指定する以下のフィールドがある
（[ADR-0016](../decisions/ADR-0016-vault-config-driven-site-defaults.md)、REQ-UX-011/012/013）:

- `siteTitle: string`（既定値 `"Notes"`） — `index.html` の `<title>`/`<h1>` と `graph.html` の
  `<title>` に反映される。
- `defaultTheme: string`（既定値 `"moon"`） — 12種のテーマ id のいずれか。初回訪問時の初期テーマ。
- `defaultParticleDirection: "wikilink" | "backlink"`（既定値 `"wikilink"`） — graph ページの
  初回訪問時の初期粒子進行方向。

これら3フィールドはいずれも省略可能で、ユーザーが `localStorage` に保存した明示的な選択は
常にこれらのビルド時デフォルトより優先される。

## 4. 公開リポジトリに配置してよい内容 [DECIDED]

- 公開用リポジトリ / 出力先には、ビルド済みの静的 artifact（HTML/CSS/JS/JSON 等）のみを配置する（REQ-PUB-007）。
- Markdown ソース、vault の内部パス、build 設定、build ログは公開側に含めない。
- 将来的に「sanitize 済み Markdown ソースも公開する」オプションを追加する余地はあるが、v0.1 の既定・唯一の挙動は artifact のみとする。

## 5. v0.1 で扱わない公開フロー [DEFERRED]

- private repository への push を契機とした CI 実行。
- CI からの sanitize 済み公開物の自動反映。
- public repository から GitHub Pages への自動デプロイ。

v0.1 では、ローカル CLI が生成した静的 artifact を、ユーザーが手動でどこかにデプロイすることを前提とする。
