# 07. Performance

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. v0.1 のスコープ [DECIDED]

- v0.1 では Graph UI を実装しないため、Graph UI 向けの性能目標（first interactive frame、pan/zoom FPS、tag filter 応答時間等）は対象外（DEFERRED, REQ-PERF-001）。
- v0.1 の性能要件は「決定的 build が現実的な時間で完了すること」程度に限定し、具体的な数値目標は設けない。

## 2. 将来の性能目標（参考・未確定）[OPEN]

構想段階で挙がっている暫定目標を記録のみ行う。確定は Graph UI 着手ループで行う。

- 代表データセット: 10,000 nodes / 50,000 edges
- first interactive frame: 1,000ms 以下
- tag filter: 100ms 以下
- pan/zoom 等の graph 操作: 60 FPS
- 大規模 graph でも node/edge を黙って省略して目標を達成してはならない（安全策、[LOOP.md](../LOOP.md) 参照）

## 3. 未決事項 [OPEN]

- 測定開始点（何をもって「interactive」とするか）
- reference hardware
- 対象 browser
- percentile（p50/p95/p99 等）

これらは Graph UI 着手ループの冒頭で改めてユーザーに確認する。
