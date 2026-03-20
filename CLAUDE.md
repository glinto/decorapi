# CLAUDE.md

Project context for AI assistants.

## Project

**decorapi** — a TypeScript library that turns class methods into isomorphic HTTP API endpoints via TC39 Stage-3 decorators. The same class works as a fetch-based client _or_ as an HTTP route handler depending on runtime configuration.

- GitHub: https://github.com/glinto/decorapi
- npm: `decorapi`
- License: MIT

## Tech stack

| Tool | Version | Role |
|---|---|---|
| TypeScript | ^5.8 | Language — TC39 Stage-3 decorators (no `experimentalDecorators`) |
| esbuild | ^0.25 | Bundler — produces CJS (`dist/index.js`) and ESM (`dist/index.mjs`) |
| tsc | via typescript | Type declarations only (`--emitDeclarationOnly`) |
| Jest + ts-jest | ^30 / ^29 | Testing — ESM mode via `--experimental-vm-modules` |
| ESLint | ^10 | Linting — flat config (`eslint.config.js`), no `tseslint.config()` wrapper |
| Prettier | ^3 | Formatting — `.prettierrc.json` |
| Node.js | ≥18 | Runtime — native `fetch`, ES2022 |

## Commands

```bash
npm run build          # esbuild + tsc --emitDeclarationOnly → dist/
npm run dev            # esbuild --watch
npm run typecheck      # tsc --noEmit (type-check only, no emit)
npm test               # jest with --experimental-vm-modules
npm run test:coverage  # jest with coverage
npm run lint           # eslint src/
npm run lint:fix       # eslint src/ --fix
npm run format         # prettier --write .
npm run format:check   # prettier --check .
```

## Source layout

```
src/
  types.ts        — TypeGuard<T>, HTTPRequest<T>, EndpointMeta, DecorAPIConfig, DecorAPIError
  registry.ts     — WeakMap<prototype → Map<methodName → EndpointMeta>>
  config.ts       — global config store (setConfig / getConfig / isConfigured)
  decorator.ts    — @endpoint TC39 decorator factory
  client.ts       — clientHandler: fetch + typeguard validation
  server.ts       — ServerAdapter singleton: route registry + (req,res) dispatcher
  index.ts        — public re-exports + DecorAPI namespace

tests/
  types.test.ts
  registry.test.ts
  config.test.ts
  client.test.ts
  server.test.ts
```

## Key design decisions

- **TC39 Stage-3 decorators only** — no `experimentalDecorators`, no `emitDecoratorMetadata`
- **`context.addInitializer`** is used to grab the instance at construction time so server routes are registered per-instance with correct `this` binding
- **Method replacement**: the decorator returns a wrapper; on `client` mode it calls `clientHandler` (fetch); on `server` mode the server adapter dispatches to the original bound method — the wrapper itself throws if called directly in server mode
- **`node:http` imports in `server.ts` and `index.ts` are all `import type`** — erased at compile time, safe for client bundling
- **`packages: 'external'` in esbuild** — no npm dependencies are inlined into the bundle

## Testing conventions

- All test files import Jest globals explicitly from `@jest/globals` (no implicit globals — `injectGlobals: false` in jest config)
- `fetch` is mocked via `global.fetch = ... as typeof global.fetch`
- Server adapter tests use a real `http.createServer` spun up on a random port

## ESLint config

Flat config (`eslint.config.js`) — plain `export default [...]` array. Do **not** use `tseslint.config(...)` wrapper (it is deprecated in all overloads).

## Release lifecycle

1. Develop on feature branches → PR → CI must pass (typecheck, lint, format, test)
2. Merge to `main`
3. `npm version patch|minor|major` — bumps version, commits, creates git tag
4. `git push && git push --tags` — triggers `release.yml`
5. Release workflow: build → `npm publish --provenance` via OIDC Trusted Publishing → GitHub Release with auto-generated notes

No `NPM_TOKEN` secret needed — npm OIDC Trusted Publishing is configured on the npm package side.

## package.json exports

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  }
}
```

## Common pitfalls

- Always run `npm run build` before checking `dist/` — esbuild output and `.d.ts` files are separate steps
- Jest requires `node --experimental-vm-modules` for ESM; this is baked into the `test` script
- Import paths in `src/` use `.js` extensions (ESM convention) — TypeScript resolves them to `.ts` at build time
- `tsconfig.test.json` extends the main tsconfig and adds `esModuleInterop: true` (needed for `import http from 'node:http'` in tests)
