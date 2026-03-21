# ADR 0002: Isomorphic Class Pattern

**Status:** Accepted

## Situation

API clients and servers are typically written separately, causing drift between request/response shapes. We wanted a single source of truth for an API contract that works in both environments.

## Options

- **Separate client/server classes** — explicit but duplicated type definitions
- **Code generation** — from OpenAPI or similar; heavyweight tooling dependency
- **Single isomorphic class** — same class, behaviour switches on runtime config

## Decision

Use a single decorated class. When `mode: 'client'`, decorated methods are replaced with `fetch` wrappers. When `mode: 'server'`, the original method bodies are registered as route handlers. The switch happens at construction time via `context.addInitializer`. This keeps API shape, types, and guards co-located with zero duplication.
