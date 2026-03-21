# ADR 0005: Path Parameters as Positional Method Arguments

**Status:** Accepted

## Situation

REST routes commonly include URL segments like `/groups/:groupId/items/:itemId`. We needed a way for the server to extract these values and for the client to supply them when constructing the URL.

## Options

- **Embed params in HTTPRequest** — `{ body, headers, params }` — unified object but awkward for bodyless methods and requires interface changes
- **Named params object as first arg** — `method({ groupId }, req)` — explicit but requires a new type per endpoint
- **Positional args from method signature** — params declared as leading typed arguments, order matching the path template

## Decision

Positional arguments inferred from the path template. The decorator parses `:param` tokens from the path at decoration time, storing them as `paramNames`. On the server, regex capture groups are mapped to leading handler arguments. On the client, leading argument values are interpolated into the URL. The method signature is the contract — TypeScript enforces argument types and count at the call site with no extra types or wrappers required.
