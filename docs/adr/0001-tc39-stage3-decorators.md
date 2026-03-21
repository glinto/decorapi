# ADR 0001: Use TC39 Stage-3 Decorators

**Status:** Accepted

## Situation

TypeScript has supported two decorator proposals: the legacy `experimentalDecorators` flag (TS 4.x era) and the TC39 Stage-3 standard (TS 5.0+). Choosing the wrong one makes the library incompatible with modern toolchains.

## Options

- **`experimentalDecorators`** — widely used but non-standard, deprecated path
- **TC39 Stage-3** — W3C standards track, supported natively in TS 5+, no legacy flags needed

## Decision

Use TC39 Stage-3 decorators exclusively. No `experimentalDecorators`, no `emitDecoratorMetadata`. This future-proofs the library and avoids a dependency on a deprecated compiler option. The trade-off is that `context.addInitializer` must be used instead of reflect metadata to capture instances at construction time.
