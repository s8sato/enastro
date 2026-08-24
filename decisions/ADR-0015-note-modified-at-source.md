# ADR-0015: Note `modifiedAt` Source — Git Commit Date over Filesystem mtime

## Status

DECIDED

## Context

`VaultFile.modifiedAt`（[src/vault/discover.ts](../src/vault/discover.ts)）は、REQ-UX-007
（ノートページでの最終更新日時表示・検索対象化）と REQ-EXPLORE-007（既読ノートが更新後に
自動で未読へ戻る同期機能、[ADR-0014](ADR-0014-node-exploration-status-persistence.md)）の
両方が依拠する唯一の情報源だった。これまでの実装は `fs.Stat.mtime`（OS が管理する
「最後にファイルへ書き込みが行われた時刻」）をそのまま採用していた。

この実装には根本的な欠陥がある。git は blob の mtime を保持する仕組みを持たず、
`git clone` / `git checkout` は書き込むファイルすべてに「書き込んだ瞬間の時刻」を
mtime として付与する。enastro 自身の CI（`.github/workflows/ci.yml`,
`.github/workflows/deploy-demo.yml`）や、想定される公開パイプライン
（vault リポジトリへの push → CI が checkout → ビルド・公開）は、いずれも
`actions/checkout` によるフレッシュな checkout を経由するため、**ビルドのたびに
vault 内の全ノートの mtime が「その checkout を実行した時刻」に一律リセットされる**。

これにより、REQ-EXPLORE-007 の自動 unread 同期は、実際にはノートの内容が1文字も
変わっていなくても、CI 再ビルドのたびに「既読時刻 < 新しい modifiedAt」という関係になり
誤発火する（本来「更新されたノートだけ」を教える機能が、ほぼ無差別に発火してしまう）。
また、この誤発火は CI 環境依存のタイミング（checkout からテスト実行までの経過時間）に
左右されるため、`src/e2e/exploration.e2e.test.ts` の一部テスト
（"highlights the history entry currently being viewed via rewind"、
"supports Reset to here"、"supports Prune until here"）が CI でのみ間欠的に失敗する
原因にもなっていた（2026-08-25 のセッションで調査・特定）。

### 検討した代替案

- **B: frontmatter による著者の明示更新日時**（例: `updated: 2026-08-24`）。
  mtime の不正確さを回避できるが、以下の理由で不採用とした。
  - enastro はこれまで一貫して「著者に極力何も考えさせない」設計を選んできた
    （ID・タイトルの自動導出、frontmatter 最小主義、[ADR-0009](ADR-0009-note-id-title-separation.md)
    での `title:` 無効化）。B案は「著者が能動的に日時を touch する」という新しい
    運用上の作法を要求し、この一貫した方針から逸脱する。
  - B案は「無指定なら何も起きない」がデフォルトとなり、著者が書き忘れると
    実質的な内容変更があっても永久に自動 unread が発火しない。これは
    REQ-EXPLORE-007 の存在意義（著者が明示的に知らせなくても変化を自動検出する）を
    失わせる、回復不能な「サイレントな失敗」である。
  - 対して、後述の A案の「些細な修正でも発火しうる」という弱点は、既存の UI
    （dismissible な通知枠、[ADR-0014](ADR-0014-node-exploration-status-persistence.md)
    Amendment 参照）により実害が小さいように一見見える。しかし、誤って auto-unread
    された場合、閲覧者は通知を消すだけではなく、**当該ノートを手動で再度 "Mark as read"
    し直す**という実質的な手作業が発生する。この実害を踏まえ、読者に嘘をつかないことを、
    完璧な粒度で伝えることより優先するべきと判断した。

### mtime フォールバックを採用しない理由

git 情報が得られない場合の代替として、当初は `fs.Stat.mtime` へのフォールバックを
検討したが、精査の結果これも不採用とした。フォールバックが発動しうるケースは
実質的に2つあり、いずれも看過できない問題を抱える。

- **ケース1（vault 全体で git 情報が一切取得できない）**: `git` バイナリ不在、
  `not a git repository`、あるいは CI でよく発生する
  `detected dubious ownership in repository`（checkout 実行ユーザーとリポジトリ
  所有者の不一致、Docker ベースの CI/self-hosted runner で頻発）等。この場合、
  vault 内の**全ファイル**が mtime に落ちてしまい、本 ADR が解決しようとした
  「checkout のたびに mtime が『今』にリセットされ、REQ-EXPLORE-007 が誤発火する」
  という問題が、**サイレントに（ビルドを一切失敗させずに）**丸ごと再発する。
- **ケース2（この1ファイルだけ未コミット）**: 新規追加直後で当該ファイルにまだ
  コミットが無い場合。この場合の mtime は「著者が実際に保存した時刻」そのものであり
  正確ではあるが、ケース1と実装上同じフォールバック機構を共有しており、
  区別なく mtime に依存させるとケース1の危険な経路を残したままになる。

これらを踏まえ、git 履歴から日時を取得できないケース（vault 全体・個別ファイルの
いずれであれ）は、一律に `modifiedAt` を「不明」として扱い、mtime には一切依存しない。
代償として、git 履歴が使えない状況（非 git vault、新規未コミットノート等）では
単純に日時が表示されなくなるが、これは「間違った日時を見せる」よりも安全な
劣化モードである。

## Decision

`modifiedAt` の算出を、**「そのファイルを最後に変更した git コミットの日時」のみを情報源とし、
git 情報が得られない場合は `modifiedAt` を「不明」として扱う**方式とする
（B案のフロントマター opt-in は導入しない。mtime へのフォールバックは一切行わない）。

- vault ディレクトリに対して `git log --relative --name-only --format=%x00%cI` を
  **ビルドごとに1回だけ**実行し、パスごとの最終コミット日時のマップを構築する
  （ファイルごとにプロセスを立てず、大規模 vault でも性能劣化しない）。
- `git` コマンドが失敗する場合（vault が git 管理下にない、`git` が未インストール等）や、
  個々のファイルが上記マップに存在しない場合（新規追加直後で未コミット等）は、
  `modifiedAt` を「不明」として扱う。**mtime へのフォールバックは行わない**（下記「mtime
  フォールバックを採用しない理由」参照）。
- **不明の内部表現には UNIX epoch (`0`) を sentinel 値として用いる**（`number | undefined`
  等の型変更を各層に伝播させず、消費側の境界（レンダリング・JSON 出力・クライアント
  同期ロジック）でのみ `epochMs > 0` を「既知」の判定に使う）。
- **未コミットの変更は無視してよい**：working tree 上の未コミット編集は、コミットされる
  までは「不明」のまま扱われる（意図的な簡略化）。

シャロークローン（`fetch-depth` 未指定、既定は 1）でも、この方式は mtime 方式より
既に改善されている点に注意する。git は shallow の境界コミットを「そのコミットが
全パスに触れた」ものとして扱うため、`git log -- <path>` は常にその境界コミットの
**実際のコミット日時**（過去の固定値）を返す。これは checkout のたびに「今」へ
リセットされる mtime とは異なり、"境界コミットまでの精度に丸められるだけ"であり、
「常に今にリセットされ続ける」という致命的な問題は解消される。ただし、
ファイルごとの正確な最終更新コミットを得るには `fetch-depth: 0`（全履歴取得）が必要であり、
README のユーザー向け公開パイプライン例、および enastro 自身の
`deploy-demo.yml` にこれを追記する。

## Consequences

- `src/vault/discover.ts` の `discoverVault()` が変更され、新規ヘルパー
  `src/vault/git-modified-at.ts`（`getGitModifiedAtMap`）に依存する。`VaultFile.modifiedAt`
  は `number` のまま、不明時は `0`（sentinel）になる。
- 新規の実行時依存は追加しない（`git` CLI を `child_process` 経由で呼び出すのみ。
  `scripts/bench.mjs` に既存の前例あり）。
- REQ-UX-007 の文言（[spec/01-scope-and-requirements.md](../spec/01-scope-and-requirements.md)）
  から「ファイルの mtime 由来」という記述を変更し、本 ADR を参照する。`modifiedAt` が
  不明（`0`）なノートは、ページ上の "Updated" 表示・検索対象・REQ-EXPLORE-007 の
  自動 unread 判定のいずれからも単に除外される（エラーにはしない）。
- README.md のユーザー向け GitHub Actions サンプル（パターン A・B）と
  `.github/workflows/deploy-demo.yml` の `actions/checkout` に `fetch-depth: 0` を追加する。
- 副次効果として、`src/e2e/exploration.e2e.test.ts` の CI 限定 flaky 失敗3件が
  構造的に解消される見込み（fixtures/basic-vault の各ノートの `modifiedAt` が、
  checkout 時刻ではなく実際の（安定した過去の）最終コミット日時になるため）。
- 将来、「些細な修正でも auto-unread が過検知される」ことが運用上の実害として
  顕在化した場合は、frontmatter による明示上書き（B案の要素）を、
  本 ADR とは別の ADR で改めて追記することを妨げない（今回は DEFERRED）。
