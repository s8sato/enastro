# ADR-0006: Graph Layout Precomputation Strategy (Future)

## Status

DECIDED（方針のみ、実装は DEFERRED）

## Context

Graph UI の layout 座標を build 時に事前計算するか、実行時に計算するかは、
deterministic build 原則と初期表示性能目標（first interactive frame ≤ 1,000ms）の両方に関わる。

## Decision

- layout 座標は build 時に決定的に事前計算し、artifact として配布する。
- 実行時には、ユーザー操作（pan/zoom/ドラッグ等）に応じた物理演算・再配置のみを行うハイブリッド方式を将来方針とする。
- v0.1 では Graph UI 自体を実装しないため、本 ADR は方針の記録のみであり、実装は行わない。

検討した代替案:

- 完全事前計算のみ: 初期表示は速いが、操作後の自然さが失われやすい。
- 完全実行時計算のみ: 対話性は高いが、deterministic build 原則に反し、大規模 graph で初期表示目標を外しやすい。

## Consequences

- Graph UI 着手時に、artifact contract（graph.json への座標フィールド追加）に影響する。
- 実装時期・詳細設計は Graph UI 着手ループで確定する。
