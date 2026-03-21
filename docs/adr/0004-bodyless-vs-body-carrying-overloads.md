# ADR 0004: Separate Overloads for Bodyless vs Body-Carrying Methods

**Status:** Accepted

## Situation

GET and DELETE requests carry no body. Forcing callers to wrap every GET call in `{ body: undefined, headers: {} }` is awkward. But the `@endpoint` decorator must statically differentiate the two cases to generate correct fetch calls and skip body parsing on the server.

## Options

- **Single overload with optional body** — simpler API surface but ambiguous types at call sites
- **Union type on HTTPRequest** — `HTTPRequest<T | void>` proved too ambiguous in practice
- **Two distinct overloads** — `BodylessMethod` (3 args, no `guardReq`) and `BodyMethod` (4 args)

## Decision

Two named overloads sharing one implementation. `BodylessMethod = 'GET' | 'DELETE'` takes 3 decorator args and produces methods with `(opts?: RequestOptions)` signatures. `BodyMethod = 'POST' | 'PUT' | 'PATCH'` takes 4 decorator args. The implementation uses `: any` return to satisfy TypeScript's overload compatibility rule; the named overloads are what callers see. The absence of `guardReq` in `EndpointMeta` is the runtime signal to skip body reading on the server.
