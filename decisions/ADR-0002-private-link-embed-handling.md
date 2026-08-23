# ADR-0002: Handling of Public Notes Linking/Embedding Private Notes

## Status

DECIDED

## Context

公開ノートが非公開ノートを wikilink または embed した場合の挙動を決める必要がある。
これは privacy invariant（REQ-SEC-001）に直結し、後戻りが難しい。

## Decision

- public projection の生成時に、公開ノート → 非公開ノートの edge を完全に除去する。
- 除去した事実は、公開物には一切含めず、非公開のビルドログにのみ warning として出力する（著者が気づけるように）。
- embed も wikilink と同様に扱う。

検討した代替案:

- 汎用プレースホルダーへの置換（例: `[非公開]`）: 著者が指定した表示テキストも含め常に匿名化する必要があり実装が複雑。
- plain text 化のみ（alias 表示は残す）: alias 自体が非公開ノートの内容を示唆する可能性があり、privacy invariant を満たせない。
- build 失敗: 公開のたびに build が壊れやすくなり、執筆体験を著しく阻害する。

## Consequences

- 「意図せぬ漏洩をしない」という要件を最も厳格に満たす。
- 著者体験として「リンクが静かに消える」ため、build warning による可視化が別途必須。
