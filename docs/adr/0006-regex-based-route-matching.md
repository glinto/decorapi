# ADR 0006: Regex-Based Route Matching

**Status:** Accepted

## Situation

The original server adapter used an exact-match `Map<string, RouteEntry>` keyed on `"METHOD:/path"`. This is O(1) and simple but cannot match parameterized paths like `/users/:id`.

## Options

- **Exact-match Map only** — fast but rules out path parameters entirely
- **Third-party router** (e.g. `find-my-way`, `radix3`) — battle-tested but adds a runtime dependency, contradicting the zero-dependency goal
- **Regex array** — routes compiled to regex at registration time, matched in order at request time

## Decision

Routes are compiled to `RegExp` once at registration and stored in an ordered array. Incoming requests iterate the array and use the first match; capture groups yield the param values. Static paths (no `:param`) produce regexes that only match their exact string, so they have no performance disadvantage. Registration order determines precedence — callers should register static paths before dynamic ones to avoid shadowing.
