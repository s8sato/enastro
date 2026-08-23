# ADR-0005: Implementation Language and Runtime

## Status

DECIDED

## Context

プロジェクト全体の骨格・依存管理・CI 設定・今後のすべてのコードの土台となる言語を決める必要がある。

## Decision

- v0.1 は TypeScript / Node.js で実装し、CLI として npm 経由で配布する。
- Knowledge Graph IR は言語非依存なデータ構造として定義し、将来的に性能が必要な
  コンポーネント（graph engine 等）を Rust/WASM に置き換え可能な境界を保つ。
- v0.1 時点では Rust/WASM は導入しない。

検討した代替案:

- Rust 中心 + WASM: 性能上限は高いが開発速度が落ち、Obsidian 周辺エコシステム（TS/JS 中心）との親和性が下がる。
- Python 中心: データ処理には強いが、フロントエンド（将来の Graph UI）との一貫性が下がる。

## Consequences

- 大規模 graph で将来性能不足になった場合、書き換えコストが発生し得る（IR を言語非依存フォーマットにすることで軽減を図る）。
- 開発速度・エコシステム親和性を優先した意思決定である。
