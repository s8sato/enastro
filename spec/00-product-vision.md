# 00. Product Vision

Status legend: `DECIDED` | `PROPOSED` | `OPEN` | `OPEN` は未決事項、`DEFERRED` は MVP (v0.1) 以降へ延期した事項を表す。

## 1. プロダクトカテゴリ [DECIDED]

> A graph-native digital garden generator for humans and AI.

外部から見れば Digital Garden Generator であり、内部アーキテクチャとしては Knowledge Graph Compiler である。

## 2. 変換モデル [DECIDED]

```
Knowledge Base
        ↓ parse and normalize
Knowledge Graph IR
        ├── local projection
        │       ↓
        │   Local Knowledge Constellation
        │   Local Search / Local AI
        │
        └── public projection
                ↓
            Public Digital Garden
            Public Knowledge Constellation
            Public Search / Web AI
```

- 「Digital Garden」は知識を公開・更新する形式を表す。
- 「Constellation」はノート間の関係を星空として表現する enastro 固有の視覚モデルを表す。
- Knowledge Graph は補助機能ではなく、enastro の主要な差別化要素である。

## 3. 設計上の原則 [DECIDED]

- private by default
- deterministic build
- reproducible output
- static and portable output
- parsing / graph IR / rendering / publishing の明確な分離
- humans and AI should consume the same underlying knowledge graph
- 要件は可能な限りテスト可能であること
- 視覚的品質・操作感は unit test だけに矮小化しない
- security / privacy invariant は機能要件より優先度を下げない
- MVP に不要な機能を先回りして実装しない
- 技術選定は既定路線とせず、制約とトレードオフに基づいて決定する

## 4. v0.1 のプロダクトゴール [DECIDED]

v0.1 のゴールは、「星空 UI」でも「AI 探索」でもなく、次の一本道を安全かつ決定的に実行できることである。

> ローカルの Obsidian 風 vault から、
> wikilink/backlink を解決し、
> `publish: true` のノートだけを選び、
> 非公開情報を一切漏らさずに、
> 検索可能な静的 Digital Garden を決定的に生成できる。

Graph UI・AI アクセス・CI 自動公開・大規模性能最適化は、この一本道が確立してから着手する（[01-scope-and-requirements.md](01-scope-and-requirements.md) 参照）。

## 5. Traceability の考え方 [DECIDED]

```
Product goal (このファイル)
  → Requirement (01-scope-and-requirements.md, REQ-*)
  → Architecture / Decision (04-architecture.md, decisions/ADR-*)
  → Acceptance criterion (09-acceptance-and-evaluation.md)
  → Fixture / Test / Benchmark (fixtures/*)
```

各 REQ には一意な ID を付与し、上記の追跡関係を [01-scope-and-requirements.md](01-scope-and-requirements.md) の traceability 表にまとめる。
