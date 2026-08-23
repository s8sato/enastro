# fixtures/benchmark-vault

## 目的

性能検証（10,000 nodes / 50,000 edges）のためのベンチマーク用大規模 vault。

対応 REQ: REQ-PERF-001（v0.2 で DECIDED、[ADR-0012](../../decisions/ADR-0012-v0.2-performance-reference-environment.md) 参照）。

## 現状 [DECIDED（v0.2）]

- v0.1 では作成を見送っていたが（下記「v0.1 での経緯」参照）、v0.2 で Graph UI・性能検証に着手したため、
  このディレクトリの本格的な内容を実装する。
- 実データはコミットしない。決定的（固定シード）な手続き的生成スクリプトで都度生成する方針
  （生成物は `.gitignore` 対象、生成コマンドは `npm run generate:benchmark-vault` を予定）。
- 生成内容: 10,000 件の Markdown ノート（`publish: true`、Lorem-Ipsum 風のダミー本文、実素材は使用しない）、
  約 50,000 件の wikilink/tag（次数分布に偏りを持たせ、意図的な broken link・非公開ノートも一部含める）。
- perf harness（Playwright ベース、[ADR-0012](../../decisions/ADR-0012-v0.2-performance-reference-environment.md)
  の reference environment・計測方法に準拠）でこの vault に対する build 時間・first interactive frame・
  tag filter 応答・pan/zoom FPS を計測する。

## v0.1 での経緯（参考）

- v0.1 では Graph UI・大規模性能最適化を実装しなかったため（[01-scope-and-requirements.md](../../spec/01-scope-and-requirements.md) 参照）、
  「性能達成のために node/edge/機能を黙って省略しない」という安全策と「MVP に不要な機能を先回りして実装しない」
  という設計原則を両立するため、実データ・ベンチマーク実行環境が未確定な段階では雛形すら作らなかった。
