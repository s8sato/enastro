# 07. Performance

Status legend は [00-product-vision.md](00-product-vision.md) 参照。

## 1. v0.1 のスコープ [DECIDED]

- v0.1 では Graph UI を実装しないため、Graph UI 向けの性能目標（first interactive frame、pan/zoom FPS、tag filter 応答時間等）は対象外（DEFERRED, REQ-PERF-001）。
- v0.1 の性能要件は「決定的 build が現実的な時間で完了すること」程度に限定し、具体的な数値目標は設けない。

## 2. v0.2 の性能目標 [DECIDED]

[ADR-0012](../decisions/ADR-0012-v0.2-performance-reference-environment.md) により、以下を v0.2 の正式な目標として確定する。

- 代表データセット: fixtures/benchmark-vault、10,000 nodes / 50,000 edges（決定的な手続き的生成）。
- first interactive frame: 1,000ms 以下（p50、定義は ADR-0012 参照）。
- tag filter: 100ms 以下。
- pan/zoom 等の graph 操作: 60 FPS（sampled。headless CI の計測限界により build を失敗させる gate にはしない）。
- 大規模 graph でも node/edge を黙って省略して目標を達成してはならない（安全策、[LOOP.md](../LOOP.md) 参照）。

## 3. reference environment [DECIDED]

[ADR-0012](../decisions/ADR-0012-v0.2-performance-reference-environment.md) により確定。

- 測定環境: Playwright 駆動の headless Chromium（最新安定版）、GitHub Actions `ubuntu-latest` runner 上。
- 統計量: 連続 10 回計測の中央値（p50）を代表値とし、最大値も併記。p95/p99 は v0.2 では採用しない。
- 測定開始点（interactive の定義）: build 時事前計算済みのレイアウトが最初に描画された直後の最初の `requestAnimationFrame`。
