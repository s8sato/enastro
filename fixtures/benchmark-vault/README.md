# fixtures/benchmark-vault

## 目的

将来の性能検証（10,000 nodes / 50,000 edges）のためのベンチマーク用大規模 vault。

対応 REQ: REQ-PERF-001（DEFERRED）。

## 現状 [DEFERRED]

- v0.1 では Graph UI・大規模性能最適化を実装しないため（[01-scope-and-requirements.md](../../spec/01-scope-and-requirements.md) 参照）、
  このディレクトリの本格的な内容（実データ・生成スクリプト）は v0.1 では作成しない。
- 将来、性能検証ループに着手する際に、次を設計する。
  - 10,000 nodes / 50,000 edges を決定的に生成する fixture generator
  - reference environment（hardware / browser / percentile）の定義（[07-performance.md](../../spec/07-performance.md) OPEN 事項）
  - performance benchmark の自動化手順

## このディレクトリを今のうちに作らない理由

- 「性能達成のために node/edge/機能を黙って省略しない」という安全策と、
  「MVP に不要な機能を先回りして実装しない」という設計原則を両立するため、
  実データ・ベンチマーク実行環境が未確定な段階では雛形すら作らず、
  性能検証ループの冒頭で reference environment を確定してから着手する。
