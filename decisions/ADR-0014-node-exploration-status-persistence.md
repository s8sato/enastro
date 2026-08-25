# ADR-0014: Node Exploration Status Persistence (Rewindable, Client-Only)

## Status

DECIDED

## Context

ユーザーから、公開サイトの閲覧者が自分自身の閲覧進捗を記録できる「探索ステータス」機能の要望があった
（REQ-EXPLORE-001〜006）。要件は次の通り:

- ノートごとに「未読/既読」の2値ステータスを持つ。既読化はノートページの手動ボタンでのみ発火する
  （スクロール検知等の自動既読は行わない）。
- 保存したステータス変更は、任意の過去時点まで巻き戻し（rewind）て閲覧できる。
- ブラウザの `localStorage` 容量上限に達した場合、警告を表示する。
- グラフのトポロジー変化（ノード/エッジの増減）の影響を受けない。
- ステータスに応じて一覧ページのビュレット、グラフ UI の該当ノードとそこを起点とするエネルギー粒子が
  減光・無彩色化される。

この機能はサーバーサイドを持たない静的サイト（REQ-UX-004）というアーキテクチャ上、必然的に閲覧者の
ブラウザにのみ状態を持つクライアント完結の機能となる。既存の privacy invariant
（[08-security-and-privacy.md](../spec/08-security-and-privacy.md) §1）は「非公開ノートの情報が公開物に
漏洩しないこと」を対象としており、この機能が扱う「閲覧者自身の既読状態」はそれとは別種の情報だが、
公開 build artifact に一切混入させてはならないという制約は同様に適用される。

## Decision

### データモデル: 追記型イベントログ

`localStorage` キー `enastro:exploration:v1` に、JSON 配列としてイベントログ
`{id: string, status: "read" | "unread", ts: number}[]` を保存する。現在のステータスは、ログを
`ts` の昇順に fold し、同一 `id` については後勝ちで決定する（`computeStatusAsOf(log, cursorTs)`）。

イベントログを直接の「現在値マップ」ではなく追記型ログとして保持するのは、rewind
（任意時点への巻き戻し）を、ログを一切破棄せずに実現するため。`cursorTs` 以下の `ts` を持つイベントの
みを fold 対象とすることで、「過去のある時点での状態」を再構成できる。

### rewind: カーソル方式、非永続

rewind のための「現在どの時点を見ているか」を表すカーソルは、ページ内のメモリ上の変数としてのみ保持し、
`localStorage` には保存しない。ページ遷移・リロードのたびに「現在」（`cursorTs = Infinity`）へ自動的に
リセットされる。rewind はあくまで一時的な閲覧モードであり、恒久的な巻き戻し（ログの削除・書き換え）は
提供しない。rewind 中はステータス変更操作（Mark as read）を無効化し、閲覧専用とする。

検討した代替案:

- 状態をスナップショット（現在値マップのみ）として保持し、rewind 用に別途チェックポイントを都度保存する
  方式: チェックポイントの保存タイミング・粒度の設計が複雑になるため採用しなかった。イベントログ方式は
  「変更のたびに自動的にチェックポイントが生まれる」のと等価であり、ユーザー要望の
  「保存したチェックポイントは任意の時点まで巻き戻せる」をそのまま満たす。

### トポロジー変化耐性

ステータスはノート ID をキーとする Map として管理する。グラフ側でノード/エッジが増減しても、ログ自体は
変更されない。存在しなくなった ID のステータスは単に参照されなくなるだけであり、新規 ID は未読
（ログに一切イベントがない = デフォルト）として自然に扱われる。

### ストレージ上限警告

事前の `navigator.storage.estimate()` 等による容量チェックは行わず、`localStorage.setItem` が
`QuotaExceededError`（またはその他の例外）を送出した場合にその場で捕捉し、閲覧者に警告を表示する
reactive な方式を採る。書き込みに失敗した場合でも、その変更はページ内のメモリ上では直ちに反映される
（閲覧体験を損なわない）が、リロード後は失われる旨を警告文で明示する。

検討した代替案:

- 事前見積もり方式（`navigator.storage.estimate()` を都度呼び出し、閾値に近づいたら警告）: ブラウザの
  サポート状況にばらつきがあり、また実際の書き込み失敗を防げるわけではないため、reactive な方式のみで
  十分と判断した。

### 疎結合な UI 反映: CustomEvent 経由

状態のコアロジック（ログ I/O、ステータス計算）を持つ `src/render/client/exploration.mjs` が、状態変更の
たびに `window` へ `CustomEvent("enastro:exploration-changed", { detail: { statusById, cursorTs } })` を
dispatch する。一覧ページのビュレット表示、グラフ UI のノード/粒子の減光処理は、それぞれ独立に
このイベントを購読して自身の表示を更新する。これにより、状態管理コードと各ページの描画コードを
疎結合に保つ（既存の `filter.mjs` / `graph-view.mjs` 間の連携パターンを踏襲）。

### 公開 artifact への非漏洩

この機能は `graph.json` / `search-index.json` / 生成 HTML のいずれも変更しない。状態はすべて
クライアントサイドの `localStorage` に閉じており、build 時点では存在しない（REQ-EXPLORE-006）。

## Consequences

- 新規クライアントモジュール `src/render/client/exploration.mjs` が追加され、`src/build/site.ts` の
  クライアント資産コピー対象リストに登録される。
- `src/render/page.ts` の3つの `render*Page()` 関数すべてに、共通の rewind コントロール用マークアップと
  スクリプトタグが追加される。
- `graph-view.mjs` は `exploration.mjs` を import し、この機能に依存する形になる
  （`exploration.mjs` が正しくデプロイされないと `graph-view.mjs` の初期化全体が失敗しうる点に注意——
  実装時に一度この形で不具合が発生し、`src/build/site.ts` の資産コピーリストへの追加漏れが原因と
  判明した）。
- rewind カーソルを非永続にしたことで、複数タブ/デバイス間での「今どこを見ているか」の同期は行わない
  （そもそも同期対象外、スコープ外）。
- 将来、既読以外のステータス（例: 「後で読む」等の3値化）や自動既読判定を追加する場合は、本 ADR の
  イベントログ方式を拡張する形で対応可能だが、v0.1/v0.2 のスコープには含めない。

## Amendment (2026-08-24): Reset to here / Prune until here、および search-index.json との同期

ユーザーからの追加要望に基づき、本 ADR を以下のとおり改訂する（REQ-EXPLORE-007, REQ-EXPLORE-008）。

### 恒久的なログ書き換え: rewind とは明確に別区分の操作として追加

上記「rewind: カーソル方式、非永続」節で述べた「rewind は恒久的な巻き戻し（ログの削除・書き換え）を
提供しない」という決定そのものは変更しない。rewind（閲覧用カーソル移動）は引き続き読み取り専用のまま
とする。その上で、rewind とは別の、閲覧者が明示的に選択・確認する**破壊的操作**として、次の2つを
新設する。

- **Reset to here**: rewind でカーソルを過去のある時点 `T` に合わせた状態から実行する。
  `T` 以前（`ts <= T`）の全イベントはそのまま保持し、`T` より後（`ts > T`）の全イベントを
  永続的に破棄する（`git reset --hard` と同じ考え方: カーソル位置へ実際に「戻る」操作であり、
  それ以降に記録された変更履歴を巻き戻す）。ログの集約・書き換えは一切行わない——単純な切り捨て
  （truncate）である。
- **Prune（Squash ではなく Prune を採用）until here**: 同じくカーソル位置 `T` を対象に、
  範囲 `(-∞, T]` の中で「未読」（ログ不在という暗黙のデフォルト）から見て正味の変化がない
  read/unread の往復（相殺ペア）を完全に削除し、正味の変化があった id については範囲内の最後の
  1件のみを残す。`T` より後のイベントは変更しない。

いずれも、実行前に確認ダイアログ（`confirm()`）を必須とする。これは「rewind は読み取り専用」という
既存の設計原則との対比を利用者に明確に意識させ、誤操作によるログ消失を防ぐため。特に Reset to here は
「`T` より前と後のどちらに影響するか」が誤解されやすい（実装時に一度、`T` 以前を集約するという逆の
意味で実装してしまった）ため、確認ダイアログの文言で「`T` 以前は保持され、`T` より後が削除される」旨を
明示する。

検討した代替案:

- rewind 自体に書き換え機能を統合する: 既存の「rewind は読み取り専用」という単純なメンタルモデルを
  壊すため不採用。別ボタン・別確認フローとして明確に分離する。

### search-index.json との同期（ID不一致通知・自動unread）

`exploration.mjs` は、既に存在する公開 artifact `search-index.json`（`{id, modifiedAt, ...}[]`、
[05-artifact-contracts.md](../spec/05-artifact-contracts.md) 相当）を、ページ読み込み時に
（note/index/graph の）全ページから fetch する。これにより、追加のスキーマ変更（`graph.json` の拡張）や
新規 manifest artifact を追加することなく、次の2つを実現する。

- **ノートID不一致の通知**: ログに登場する id のうち、fetch した search-index.json に存在しない id が
  あれば通知する（該当ノートが削除された等が原因）。
- **自動 unread + 通知**: あるノートが "read" 状態であり、かつそのノートの `modifiedAt`
  （search-index.json 由来、公開 build 時点の最終更新時刻）が、既読イベントの `ts` より新しい場合、
  自動的に "unread" イベントを追記し、その旨を通知する。この自動追記も通常のイベントログの一部として
  扱われ、rewind 可能である。

上記2つの通知は、原因が異なる別種の事象であるため、**独立した別々の枠（それぞれ個別にクリックで
消せる）** として表示する（1つの枠にまとめない）。また、各枠はクリックすれば即座に消せるため、
「N件」という件数だけを示すのではなく、対象のノート ID を具体的に列挙する（例:
「No longer exist, can no longer be tracked: note-x, note-y」）。件数だけでは、通知を読んだ後に
具体的にどのノートかを確認する追加の手間が発生するため、ID を直接示すほうが実用的と判断した。

fetch に失敗した場合（オフライン、ファイル不在等）は、上記2つの同期機能のみを黙ってスキップし、
既存のmark-as-read・rewind等の機能には一切影響しない設計とする（フォールバック方針）。

検討した代替案:

- `graph.json` に `modifiedAt` を追加する: `graph.json` は REQ-BUILD-002 のクローズドな
  whitelist スキーマであり、`modifiedAt` は意図的に含まれていない
  （`src/graph/types.ts` の `GraphNode.modifiedAt` doc comment 参照）。スキーマ変更・
  `validate-graph-schema.ts` の更新・バージョニングの検討が必要になるため不採用。
- id + modifiedAt 専用の新規 manifest artifact を追加する: 実現可能だが、既存の
  `search-index.json` が既にほぼ同一の情報（id, modifiedAt）を公開物として持っているため、
  重複した artifact を増やさずに済む前者を優先した。

## Amendment (2026-08-24): 初期状態エントリの選択可能化、History のタイムゾーン表示廃止（DECIDED）

ユーザーからの追加要望に基づき、本 ADR を以下のとおり改訂する。

### 初期状態を History リストの選択可能な末尾エントリとして表示

これまで History リストは実際に記録されたイベントのみを列挙しており、「一切イベントが
記録されていない初期状態」（＝全ノート未読）へ戻る手段がなかった。これを解消するため、
History リストの末尾（最古の位置、常にリストの最後）に "Initial state" という synthetic な
エントリを追加する。クリックすると、カーソルを sentinel 値
`INITIAL_CURSOR_TS = Number.NEGATIVE_INFINITY` に設定する。

`computeStatusAsOf` / `getLastEventTimestamp` / `resetLogAt` / `pruneLogUntil`
はいずれも `cursorTs` 以下の `ts` を持つイベントのみを対象とする設計のため、実イベントの
`ts`（常に `Date.now()` 由来の正の数）は `-Infinity` を超えない = このカーソルでは
1件も fold されず、自然に「全て未読」という初期状態を再現できる。既存の pure 関数は
無変更のまま、この sentinel をそのまま渡すだけで意図通り動作する。

このエントリは、ログが空であっても常に表示される（初期状態は「イベントの有無」に関わらず
恒常的に選択可能な rewind 先であるため）。

検討した代替案:

- ログが空の状態を「初期状態」の唯一の表現とし、専用エントリを設けない: ログにイベントが
  1件でも記録された後は、初期状態を rewind 先として選ぶ手段が失われるため不採用。

### History リストのタイムゾーン表示廃止

History エントリのタイムスタンプ表示を、`formatLocalTimestamp`（`(UTC±HH:MM)` 付き）から
`formatLocalDateOnly`（日時のみ、タイムゾーン表記なし）に変更する。ローカルタイムゾーンでの
表示という前提はそのままに、History リスト内で同一の（閲覧者の）タイムゾーンを反復表示する
ことが冗長と判断したため。ノートページの読了日時表示は元々 `formatLocalDateOnly` を使用して
おり、本改訂によって表示形式が統一される。

## Amendment (2026-08-25): Snapshot 概念の導入、Prune の Squash 化（DECIDED）

ユーザーからの追加要望に基づき、本 ADR を以下のとおり改訂する。上記
「Amendment (2026-08-24): 初期状態エントリの選択可能化」で導入した "Initial state" エントリと、
「Amendment (2026-08-24): Reset to here / Prune until here」で導入した "Prune until here" は、
本改訂によりそれぞれ次のとおり置き換えられる。

### データモデル: 永続化された「Snapshot」の追加

`localStorage` に保存するデータを、追記型イベントログの配列単体から、
`{ snapshot: Record<id, "read" | "unread">, log: {id, status, ts}[] }` という形へ変更する。
`snapshot` は、それ以前に Squash された（後述）イベント群の正味の効果を保持する、恒久的な
「基点」の状態マップである。現在のステータスは、`snapshot` を初期値としてログを `ts` の昇順に
fold することで決定する（`computeStatusAsOf(state, cursorTs)`）——`snapshot` に一切変更がなければ
既存の「空マップから fold する」動作と完全に一致するため、この変更は既存の rewind ロジックに
一切の特殊分岐を必要としない。

ストレージキーを `enastro:exploration:v1` から `enastro:exploration:v2` へ変更し、`v2` の
データが存在しない場合にのみ `v1` の（配列単体の）データを `{ snapshot: {}, log: legacyLog }`
として一度だけ読み替える（`loadState()`）。`v1` のキー自体は能動的に削除せず、そのまま
残す（無害な残留データとして扱う）。

### "Initial state" を "Snapshot" に改名

History リスト末尾の synthetic エントリを "Initial state" から "Snapshot" に改名する。これは
単なる表示上の改名ではなく、意味も変化する: 従来「イベントが一切記録されていない、全ノート
未読の初期状態」という固定された意味だったのに対し、Squash 操作（後述）により内容が更新され
うる、永続化された実体を指すようになる。カーソルの sentinel 値
`INITIAL_CURSOR_TS`（`Number.NEGATIVE_INFINITY`）は `SNAPSHOT_CURSOR_TS` に改名するが、値・
役割（実イベントの `ts` は常にこれより大きいため、このカーソルでは log が一切 fold されず
`snapshot` の内容がそのまま返る）は変わらない。

### "Prune until here" を "Squash until here" に改名し、意味を変更

従来の Prune は「正味の変化がない read/unread の往復（相殺ペア）のみ」を削除する操作だった。
Squash はこれを置き換え、範囲 `(-∞, cursorTs]` の**すべて**のイベント（正味の変化があった
ものも含む）を対象に、その範囲での折り畳み結果（`computeStatusAsOf(state, cursorTs)`）を
新しい `snapshot` として採用し、対象イベントをログから完全に削除する
（`squashStateUntil(state, cursorTs)`）。正味の効果は保持されたまま、個々のイベント履歴が
`snapshot` に圧縮される。`cursorTs` より後のイベントは変更しない。

確認ダイアログの文言も、この意味変化を反映して更新する（「no-op の履歴のみ削除する」から
「範囲内の履歴全体を Snapshot に畳み込み、個々のイベントを削除する」旨に変更）。

Squash 実行後のカーソルの扱い（`cursorTs = null` で "now" に戻す）は、Reset/Prune の既存の
挙動を踏襲し変更しない。Squash 後のカーソルを新しい Snapshot の位置に置く案は、別途検討中の
「History 上のカーソル位置のブラウザ永続化・ボタン活性条件の再定義」というユーザーの別要望
（本改訂の対象外）で扱う。

### "Reset to here" は変更なし

Reset to here は `snapshot` を一切参照・変更しない（`state.log` の末尾切り捨てのみ）。Snapshot
概念とは独立した操作のままとする。

検討した代替案:

- ストレージキーを `v1` のまま据え置き、配列単体のデータ形状をそのまま `{snapshot, log}` に
  変更する: 既存ユーザーの `localStorage` に残る配列単体のデータを、新しい読み込みロジックが
  誤ってオブジェクトとして解釈しようとして壊れる（配列に `.log` プロパティは存在しない）ため、
  安全な移行のためにキーをバージョンアップし、旧キーからの一度きりの移行パスを設けることとした。
- Squash 後のカーソルを新しい Snapshot の位置に固定する: カーソルの永続化・ボタン活性条件の
  再設計と合わせて別途検討する方が一貫性があると判断し、本改訂ではカーソルの扱いは変更しない。

## Amendment (2026-08-25): Snapshot の更新時刻表示（DECIDED）

ユーザーからの追加要望に基づき、本 ADR を以下のとおり改訂する。

### データモデル: `snapshotUpdatedAt` の追加

永続化する状態を `{ snapshot, log }` から `{ snapshot, log, snapshotUpdatedAt: number }` へ拡張する
（`snapshotUpdatedAt` は epoch ミリ秒）。この値は History リストの Snapshot 行に、他の Read/Unread
行と同じ書式（`formatLocalDateOnly`）で右揃え表示される。

### 初期値: ローカルストレージ初期化時に即時確定・永続化

`snapshotUpdatedAt` の初期値は「ローカルストレージ初期化時」とする。具体的には、`loadState()` が
有効な `v2` 状態を見つけられなかった場合（キー未設定、`v2` データが壊れている、legacy `v1` のみ
存在、のいずれか）、その場で `snapshotUpdatedAt: Date.now()` を含む新規状態を組み立て、
`saveState()` で即座に永続化してから返す。これにより、閲覧者が一度も既読/未読操作をしていない
初回ロードの時点で、既にタイムスタンプが確定・永続化される（従来のように最初の `appendEvent`/
Reset/Squash まで書き込みを遅延させない）。既に有効な `v2` 状態が存在する場合は、その
`snapshotUpdatedAt` を含めてそのまま返す（再生成・再永続化しない）。

検討した代替案:

- 最初の実際の書き込み（`appendEvent`/Reset/Squash）まで `snapshotUpdatedAt` の確定を遅延させる方式:
  閲覧のみで一切のステータス変更をしない閲覧者には永久にタイムスタンプが表示されないままになり、
  「Snapshot の更新時刻」という表示の意図（＝この閲覧者のローカルな探索記録がいつから存在するか）と
  ずれるため不採用。

### Squash 実行時: 実行時刻へ更新

`squashStateUntil(state, cursorTs)` は、畳み込み後の `snapshot`/`log` に加えて、`snapshotUpdatedAt`
を Squash を実際に実行した時刻（`Date.now()`）へ更新する。畳み込み対象の範囲の終端である
`cursorTs`（rewind 先の過去時点）ではなく、実行時の「今」を採用する——Snapshot の内容がまさに今
書き換わったことを表す値として、`cursorTs` より実行時刻のほうが意味的に正確なため。

### Reset to here: 影響なし

Reset to here は `snapshot` を一切変更しないため（上記アメンドメント参照）、`snapshotUpdatedAt` も
当然変更しない。

### 表示箇所: History ドロワーの Snapshot 行のみ

`snapshotUpdatedAt` の表示は、History ドロワー内の Snapshot 行に限定する。ノートページの既読日時
表示（`data-read-at`）等、他の箇所には影響しない。

検討した代替案:

- Squash 実行後のカーソルを新しい Snapshot の位置に移動させ、かつその更新時刻をどこか別の場所
  （例: ヘッダ）にも常時表示する: カーソル位置の扱い自体は別途検討中の「History 上のカーソル位置の
  ブラウザ永続化・ボタン活性条件の再定義」の対象であり、本改訂のスコープではない。History 行内の
  表示のみで、既存のイベント行の視覚言語（アイコン + ラベル + 右揃えタイムスタンプ）と一貫させる
  ほうがシンプルと判断した。

## Amendment (2026-08-25): カーソル位置のブラウザ永続化、ボタン活性条件の再定義（DECIDED）

ユーザーからの追加要望（REQ-EXPLORE-009）に基づき、本 ADR を以下のとおり改訂する。上記
「rewind: カーソル方式、非永続」節が述べる「rewind カーソルはページ内のメモリ上の変数としての
み保持し、`localStorage` には保存しない」という決定、および Consequences 節の
「rewind カーソルを非永続にしたことで、複数タブ/デバイス間での『今どこを見ているか』の同期は
行わない」という前提は、カーソルの永続化に関する部分に限り本改訂で置き換える（トポロジー変化
耐性やマルチタブ間の同期を行わないという方針そのものは変更しない）。

### カーソル位置は常に3値のいずれかとして定義される

rewind カーソル (`cursorTs`) は、常に次のいずれかの状態を取る（未定義状態を許さない）:

- **now**（ライブ、`cursorTs === null`）: 初期状態、"Return to now" 実行直後、"Reset to here"
  実行直後の値。
- **Snapshot**（`cursorTs === SNAPSHOT_CURSOR_TS`）: History リスト末尾の Snapshot エントリを
  選択した直後、および "Squash until here" 実行直後の値（**変更点**——従来は Squash 後も
  `cursorTs = null`（now）に戻していたが、Squash は「範囲内の履歴を Snapshot に畳み込む」操作
  である以上、畳み込んだ結果である Snapshot 自体をカーソルが指す方が自然と判断し、これに変更
  する）。
- **過去の実イベント時点**（`cursorTs` が具体的な `ts` 値）: History リストの実イベント行を
  選択した直後の値。

### 「now」の定義: イベントログのうち最新のもの

「now」とは、イベントログのうち最新のもの（それより後に記録されたイベントが存在しない時点）
を指す（**修正**）。ログが空でない限り、"now" は概念上つねに何らかの実イベントと同一の状態を
指しており、両者は区別する意味を持たない。

この定義に従い、History リストで**ログの最新イベント行**（最初に述べた3値のうち「過去の実
イベント時点」に該当する行のうち、最新のもの）を選択した場合も、"now" と同一に扱う——
ハイライト表示なし、"Return to now"/"Reset to here" は非活性のまま、ノートページの
Mark as read/unread ボタンも read-only（rewind 中）にならない。当初の実装では、History 行
クリック時に無条件で `cursorTs` をその行の `ts` に設定していたため、最新イベント行を選択した
場合でも見た目上は "now" と全く同じ状態であるにもかかわらず、"過去のイベント時点にいる" 扱い
になってしまっていた（rewind の read-only 化、ハイライト表示、Return/Reset の活性化が誤って
発生する）。History 行クリック時、選択した `ts` がログの最新イベントの `ts` と一致する場合は
`cursorTs` を `null`（now）に正規化することでこれを解消する
（`isNowTs(log, ts)` ヘルパー、`src/render/client/exploration.mjs`）。この正規化を1箇所
（カーソル代入時）に閉じ込めることで、ハイライト判定・ボタン活性判定・read-only 判定など
下流のロジックは `cursorTs === null` を "now" とする既存の分岐のまま変更せずに済む。



カーソル位置と History ドロワーの開閉状態を、ページ遷移・リロードをまたいで保持する（擬似
SPA 化）。これまでの「rewind は一時的な閲覧モードであり、ページ遷移のたびに now へリセットする」
という設計は、ノート間を頻繁に行き来しながら特定の過去時点の見え方を確認したいという実際の
利用形態に合わなかったため撤回する。

具体的には、既存の `enastro:exploration:v2`（Snapshot + イベントログ本体）とは別の
`localStorage` キーに、カーソル位置とドロワー開閉状態を保存する。カーソルは本体の探索履歴
データそのものではなく閲覧上の UI 状態であるため、独立したキーに分離する——書き込みに失敗
した場合（ストレージ上限超過等）も、REQ-EXPLORE-002 の警告バナーは表示しない（実害が
「次回リロード時にカーソルが now に戻る」程度に留まり、探索履歴データの喪失とは性質が異なる
ため）。

カーソル値は `{mode: "now"} | {mode: "snapshot"} | {mode: "past", ts: number}` という判別
可能な形にタグ付けして JSON 化する。`SNAPSHOT_CURSOR_TS`（`Number.NEGATIVE_INFINITY`）は
`JSON.stringify` でそのまま往復できない（`null` になってしまう）ため、この形が必要となる。

ドロワーが開いた状態で永続化されていた場合、ページロード時にスライドイン・アニメーションを
伴わずに即座に開いた状態を復元する。トグルボタン等ユーザーの明示操作による開閉のみアニメー
ションを伴う——毎ページ遷移でアニメーションが再生されると煩わしいための配慮。

複数タブ/デバイス間でのカーソル位置の同期は引き続き行わない（本 ADR の既存のスコープ外方針を
維持）。他のタブで Reset/Squash が実行され、永続化されていたカーソルの参照先イベントが消失
した場合も、追加のバリデーションは行わない——`computeStatusAsOf`/`getLastEventTimestamp` は
いずれも `ts <=` の単純なフィルタであるため、存在しない `ts` を指すカーソルでも単に「それ以下
の全イベントを fold した状態」として矛盾なく振る舞う。

### ボタン活性条件の再定義

"Return to now" / "Reset to here" / "Squash until here" の非活性条件を、カーソル位置の3値と
対応させて次のとおり再定義する（**変更点**）:

| ボタン | 非活性条件（旧） | 非活性条件（新） |
|---|---|---|
| Return to now | 常に活性 | カーソル位置が now のとき非活性 |
| Reset to here | カーソル位置が now のとき非活性 | （変更なし）カーソル位置が now のとき非活性 |
| Squash until here | カーソル位置が now のとき非活性 | カーソル位置が Snapshot のとき非活性 |

Squash の非活性条件の変更に伴い、カーソルが now（ライブ）のまま "Squash until here" を実行する
ことが新たに可能になる——この場合、ログ全体（`cursorTs = Infinity` 相当）が Snapshot に畳み
込まれる。これは意図した挙動であり、「Squash はカーソルが Snapshot 自体を指しているとき
（＝畳み込む対象が何も残っていないとき）にのみ意味を持たない」という基準に一致する。

検討した代替案:

- カーソルの永続化と非活性条件の再定義を別々の ADR 改訂に分ける: 両者は「カーソル位置は常に
  3値のいずれかである」という同一の前提の上に成り立つ密接に関連した変更であり、まとめて1つの
  改訂として記述する方が理解しやすいと判断した。
- Squash 後のカーソルを引き続き now に戻す（本改訂前の挙動を維持）: 上記「カーソル位置は常に
  3値のいずれかとして定義される」節の理由により不採用。

### Graph view の History ドロワー位置を All Notes/note ページに統一

`syncDrawerPosition()`（`src/render/client/exploration.mjs`）は、ドロワー/scrim を「ヘッダの
すぐ下」に配置するため、対象ヘッダ要素の高さを実行時に計測している。当初の実装では、graph
ページ (`graph.html`) のみ `#tag-filters` を含む `.graph-header` 全体を計測対象とし、他の2
ページ種（note/index）は `<nav>` のみを対象としていたため、graph ページのドロワーだけ
`#tag-filters` の高さ分だけ下にずれていた（**修正**）。

`#tag-filters` は graph ページでは `<nav>` と一体で常時固定表示される一方、All Notes ページ
では固定されず（`position: sticky` は `<nav>` のみ）スクロールで流れていく——両ページで
「ヘッダとして視覚的に固定されている範囲」が異なるにもかかわらず、ドロワーの位置基準だけを
一致させようとしたことがズレの原因だった。位置基準を全ページ種で `<nav>` の下端のみに統一
することで解消する。graph ページの `#tag-filters` は、ドロワーの位置基準からは意図的に除外
されたままとなる（見た目上ドロワーが `#tag-filters` の直下ではなく `<nav>` の直下から始まる
形になるが、All Notes ページとの一貫性を優先する）。

## Amendment (2026-08-25): `getStatusSnapshot()` の既定カーソルを永続化された値に修正（DECIDED）

上記「カーソル位置のブラウザ永続化」改訂により、rewind カーソルがページ遷移をまたいで
`localStorage` に永続化されるようになった一方、`getStatusSnapshot()`
（`src/render/client/exploration.mjs`、`graph-view.mjs` が探索ステータスの初期描画に使用）
の既定カーソルは引き続き無条件に "now"（`Infinity`）のままだったため、次のリグレッションが
発生していた（**修正**）。

### 不具合: All Notes/note ページで rewind した状態のまま Graph view へ遷移すると、初期描画だけ誤って "now" を表示する

`renderExplorationBar()` が挿入する `<script type="module" src="assets/exploration.mjs">`
は、各ページ内で `graph-view.mjs` の `<script>` タグより前に配置されている。ES module
script はドキュメント順に（`defer` 相当で）実行されるため、`exploration.mjs` の `main()` は
`graph-view.mjs` が `window.addEventListener("enastro:exploration-changed", ...)` を登録
するより前に、同期的に一度だけ補正イベントを発火してしまう。`graph-view.mjs` はこの1回きりの
イベントを取りこぼし、その後は自前の初期値
（`getStatusSnapshot()` を引数なしで呼び出し、常に `cursorTs = Infinity` で fold していた）
に依存し続けるため、rewind 中（cursorTs が now 以外）に Graph view へ遷移すると、ノードの
既読/未読表示がライブの状態を示してしまい、実際に閲覧しているはずの過去時点/Snapshot の状態
とは食い違う。ユーザーが「法則性が不明」と報告した現象はこれに一致する——rewind していない
限り発現しないため、再現条件が一見ランダムに見えていた。

### 修正: `getStatusSnapshot()` の既定カーソルを永続化されたカーソルに変更

```js
export function getStatusSnapshot(cursorTs) {
  const resolvedCursorTs = cursorTs ?? loadCursor() ?? Infinity;
  return computeStatusAsOf(loadState(), resolvedCursorTs);
}
```

明示的に `cursorTs` を渡した場合はそれを優先し、渡さなかった場合は `loadCursor()`（"now" な
ら `null`、それ以外は具体的な `ts` または `SNAPSHOT_CURSOR_TS`）で解決する。`null ?? Infinity`
により "now" は引き続き `Infinity` に解決されるため、後方互換性は保たれる。これにより
`graph-view.mjs` 側のコード変更は一切不要——初期描画時点から `exploration.mjs` の `main()`
と同じ状態を見るようになり、スクリプト実行順や取りこぼしたイベントに依存しなくなる。

検討した代替案:

- `graph-view.mjs` 側で明示的に `loadCursor()` を呼んで `getStatusSnapshot(...)` に渡す:
  `getStatusSnapshot()` を呼び出すあらゆる将来のクライアントコードが同じ罠にはまりうるため、
  呼び出し側ではなく `getStatusSnapshot()` 自体の既定動作を直す方が根本的かつ再発防止に
  なると判断した。
- `exploration.mjs` の `<script>` タグを `graph-view.mjs` より後に配置する: スクリプト実行
  順への依存を別の順序に付け替えるだけで、根本原因（`getStatusSnapshot()` が "now" 固定）は
  解消しないため不採用。
