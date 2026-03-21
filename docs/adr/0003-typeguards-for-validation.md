# ADR 0003: TypeGuards for Runtime Validation

**Status:** Accepted

## Situation

HTTP boundaries require runtime validation of both request bodies and responses. Many TS validation libraries exist (Zod, Yup, io-ts), each with their own schema DSL and runtime weight.

## Options

- **Zod / Yup** — popular but add a runtime dependency and force a schema DSL
- **JSON Schema** — language-agnostic but verbose and requires a validator library
- **Plain TypeGuards** (`(x: unknown) => x is T`) — zero deps, native TypeScript, composable

## Decision

Use plain TypeGuard functions. Callers supply `guardReq` and `guardRes` as ordinary predicates. This keeps decorapi dependency-free and lets consumers use whatever validation approach they prefer (hand-written, Zod `.check`, etc.) without the library imposing a choice.
