# decorapi

> Decorator-based isomorphic HTTP API wrapper for TypeScript.

Write your API once. The same class works as a **client** (issues `fetch` requests) or as a **server** (registers HTTP route handlers) depending on how you configure it.

Uses **TC39 Stage-3 decorators** (TypeScript 5+, no `experimentalDecorators`).

---

## Installation

```bash
npm install decorapi
```

---

## Quick start

### 1. Define shared types and type guards

```typescript
// types.ts
export interface FooRequest {
	name: string;
}
export interface FooResponse {
	greeting: string;
}

export const isFooRequest = (x: unknown): x is FooRequest =>
	typeof (x as FooRequest)?.name === 'string';

export const isFooResponse = (x: unknown): x is FooResponse =>
	typeof (x as FooResponse)?.greeting === 'string';
```

### 2. Define the API class (shared between client and server)

```typescript
// api.ts
import { endpoint, type HTTPRequest } from 'decorapi';
import { isFooRequest, isFooResponse, type FooRequest, type FooResponse } from './types.js';

export class MyAPI {
	@endpoint('POST', '/foo', isFooRequest, isFooResponse)
	async foo(req: HTTPRequest<FooRequest>): Promise<FooResponse> {
		// This body only runs on the server.
		return { greeting: `Hello, ${req.body.name}!` };
	}
}
```

For **GET and DELETE** endpoints (no request body), omit `guardReq` — the method takes an optional `RequestOptions` argument instead:

```typescript
import { endpoint, type RequestOptions } from 'decorapi';
import { isFooResponse, type FooResponse } from './types.js';

export class MyAPI {
	@endpoint('GET', '/foo', isFooResponse)
	async getFoo(opts?: RequestOptions): Promise<FooResponse> {
		// No body — opts carries optional headers only
		return { greeting: 'Hello!' };
	}
}
```

For **path parameters**, use `:param` syntax in the path. Parameters are passed as typed method arguments, in the same order they appear in the path, before the request argument:

```typescript
import { endpoint, type HTTPRequest, type RequestOptions } from 'decorapi';

export class MyAPI {
	// GET /users/:id → bodyless with one param
	@endpoint('GET', '/users/:id', isUser)
	async getUser(id: string, opts?: RequestOptions): Promise<User> {
		return findUser(id); // id extracted from URL on server
	}

	// POST /groups/:groupId/items → body-carrying with one param
	@endpoint('POST', '/groups/:groupId/items', isItemBody, isItem)
	async createItem(groupId: string, req: HTTPRequest<ItemBody>): Promise<Item> {
		return createItem(groupId, req.body);
	}

	// GET /groups/:groupId/items/:itemId → multiple params
	@endpoint('GET', '/groups/:groupId/items/:itemId', isItem)
	async getItem(groupId: string, itemId: string, opts?: RequestOptions): Promise<Item> {
		return findItem(groupId, itemId);
	}
}
```

Client calls — just pass the values positionally:

```typescript
const user = await api.getUser('123');
const item = await api.createItem('456', { body: { name: 'thing' }, headers: {} });
const specific = await api.getItem('456', '789');
```

The client interpolates the values into the URL; the server extracts them from the incoming request path using regex matching.

> ⚠️ **Important**: If your method body uses Node.js-only dependencies, use dynamic imports to prevent them from appearing in client bundles. See [Server-only code patterns](#server-only-code-patterns).

### 3. Client

```typescript
import { DecorAPI } from 'decorapi';
import { MyAPI } from './api.js';

DecorAPI.configure({ mode: 'client', baseUrl: 'https://api.example.com' });
const api = new MyAPI();

// Body-carrying call:
const result = await api.foo({ body: { name: 'world' }, headers: {} });
console.log(result.greeting); // "Hello, world!"

// Bodyless call (GET/DELETE) — no argument required:
const status = await api.getFoo();
// Or pass custom headers:
const authed = await api.getFoo({ headers: { Authorization: 'Bearer token' } });
```

The client:

- For POST/PUT/PATCH: serialises `body` to JSON and sends it.
- For GET/DELETE: sends no body; optional `headers` are forwarded.
- Validates the response against `guardRes`.
- Throws `DecorAPIError` on network failure, non-2xx status, or failed validation.

### 4. Server — raw `http.Server`

```typescript
import http from 'node:http';
import { DecorAPI } from 'decorapi';
import { MyAPI } from './api.js';

const server = http.createServer();
DecorAPI.configure({ mode: 'server', server });
const api = new MyAPI(); // ← route is registered here via addInitializer

server.listen(3000);
```

### 5. Server — Express (or any framework)

```typescript
import express from 'express';
import { DecorAPI } from 'decorapi';
import { MyAPI } from './api.js';

DecorAPI.configure({ mode: 'server' });
const api = new MyAPI();

const app = express();
app.use(DecorAPI.createRequestHandler());
app.listen(3000);
```

The server adapter:

- **POST/PUT/PATCH**: parses the JSON body, validates it against `guardReq` → `400` on failure.
- **GET/DELETE**: skips body reading entirely.
- Calls the original method.
- Validates the result against `guardRes` → `500` on failure.
- Serialises the result and responds `200 application/json`.

---

## Server-only code patterns

Decorated methods run in two modes:

- **Client**: The method is **replaced** with a fetch call; the original body never executes.
- **Server**: The original method body runs and is registered as a route handler.

This means **server-only code must be handled explicitly** to avoid bundling Node.js dependencies into the client.

### Pattern 1: Dynamic imports (recommended)

Dynamically import server-only modules inside the method:

```typescript
@endpoint('POST', '/query', isQueryReq, isQueryRes)
async query(req: HTTPRequest<QueryReq>): Promise<QueryRes> {
  // On client: method replaced with fetch, never reaches this code
  // On server: imports happen at runtime

  const { database } = await import('my-database-sdk');
  const result = await database.query(req.body.sql);
  return result;
}
```

Bundlers (esbuild, Webpack) recognize `await import(...)` as a dynamic import and **won't bundle** external npm packages. This is the cleanest approach.

### Pattern 2: Separate server module

Keep server logic in a separate file and only import it on the server:

```typescript
// api.ts (shared)
@endpoint('POST', '/data', isReq, isRes)
async getData(req: HTTPRequest<Req>): Promise<Res> {
  if (typeof window !== 'undefined') {
    throw new Error('Server-only endpoint');
  }
  // Import server implementation
  const impl = await import('./server-impl.js');
  return impl.getData(req);
}
```

```typescript
// server-impl.ts (server only, never in client bundle)
export async function getData(req: HTTPRequest<Req>): Promise<Res> {
  const db = require('pg'); // Safe: only imported on server
  return db.query(...);
}
```

### Pattern 3: Environment guards with bundler hints

Use `typeof window` checks to help bundlers tree-shake browser-incompatible code:

```typescript
@endpoint('POST', '/admin', isReq, isRes)
async admin(req: HTTPRequest<Req>): Promise<Res> {
  if (typeof window !== 'undefined') {
    // Client-side code (browser only) —  bundler may omit dead branch
    throw new Error('Server-only endpoint');
  }

  // Server-side code
  const fs = await import('fs');
  return fs.promises.readFile(req.body.path);
}
```

**Note**: The guard alone doesn't guarantee bundler tree-shaking. Always pair with dynamic imports for external dependencies.

### Bundler configuration

If you control the bundler, mark Node.js packages as external:

**esbuild:**

```javascript
esbuild.build({
	entry: 'src/index.ts',
	bundle: true,
	packages: 'external', // ← don't bundle npm packages
});
```

**Webpack:**

```javascript
externals: {
  'my-database-sdk': 'commonjs my-database-sdk',
}
```

---

## API reference

### `@endpoint` — body-carrying methods (POST, PUT, PATCH)

```typescript
@endpoint(httpMethod, path, guardReq, guardRes)
```

| Parameter    | Type              | Description                          |
| ------------ | ----------------- | ------------------------------------ |
| `httpMethod` | `BodyMethod`      | `'POST' \| 'PUT' \| 'PATCH'`         |
| `path`       | `string`          | Route path, e.g. `'/users'`          |
| `guardReq`   | `TypeGuard<TReq>` | Validates the incoming request body  |
| `guardRes`   | `TypeGuard<TRes>` | Validates the outgoing response body |

Decorated method signature: `(req: HTTPRequest<TReq>) => Promise<TRes>`

### `@endpoint` — bodyless methods (GET, DELETE)

```typescript
@endpoint(httpMethod, path, guardRes)
```

| Parameter    | Type              | Description                                   |
| ------------ | ----------------- | --------------------------------------------- |
| `httpMethod` | `BodylessMethod`  | `'GET' \| 'DELETE'`                           |
| `path`       | `string`          | Route path, e.g. `'/users'` or `'/users/:id'` |
| `guardRes`   | `TypeGuard<TRes>` | Validates the outgoing response body          |

Decorated method signature (no params): `(opts?: RequestOptions) => Promise<TRes>`  
Decorated method signature (with params): `(p1: string, p2: string, ..., opts?: RequestOptions) => Promise<TRes>`

No request body is read or validated on the server side.

### Path parameters

Use `:paramName` tokens in the `path` argument. The decorator extracts them at decoration time and:

- **Server**: matches incoming requests via regex, extracts values from the URL, and passes them as leading arguments to the handler.
- **Client**: interpolates the values you pass as leading arguments into the URL before `fetch` is called.

Param names in the path and positional method arguments must match in **count and order**. The types are whatever you declare on the method — TypeScript enforces them at the call site.

```typescript
// path params → leading string args, then body/opts last
async method(p1: string, p2: string, req: HTTPRequest<T>): Promise<R>
async method(p1: string, opts?: RequestOptions): Promise<R>
```

If two routes could match the same URL (e.g. `/items/admin` and `/items/:id`), register the static path before the dynamic one — routes are matched in registration order.

### `DecorAPI.configure(config)`

Must be called **before** instantiating decorated classes.

```typescript
// Client
DecorAPI.configure({ mode: 'client', baseUrl: 'https://api.example.com' });

// Server with raw http.Server
DecorAPI.configure({ mode: 'server', server: httpServer });

// Server without http.Server (use createRequestHandler instead)
DecorAPI.configure({ mode: 'server' });
```

### `DecorAPI.createRequestHandler()`

Returns a `(req: IncomingMessage, res: ServerResponse) => void` handler for use with Express or any compatible framework.

### `HTTPRequest<T>`

Argument type for body-carrying (POST/PUT/PATCH) decorated methods on the server side:

```typescript
interface HTTPRequest<T> {
	body: T;
	headers: Record<string, string>;
}
```

### `RequestOptions`

Argument type for bodyless (GET/DELETE) decorated methods:

```typescript
interface RequestOptions {
	headers?: Record<string, string>;
}
```

### `TypeGuard<T>`

```typescript
type TypeGuard<T> = (value: unknown) => value is T;
```

### `DecorAPIError`

Thrown by the client on network errors, non-2xx responses, or failed typeguards.

```typescript
class DecorAPIError extends Error {
	statusCode?: number;
}
```

---

## Development

```bash
npm run build          # compile to dist/
npm run dev            # watch mode
npm run typecheck      # type-check only
npm test               # run Jest tests
npm run test:coverage  # with coverage report
npm run lint           # ESLint
npm run lint:fix       # ESLint --fix
npm run format         # Prettier
npm run format:check   # Prettier check
```

---

## Requirements

- TypeScript ≥ 5.0 (TC39 Stage-3 decorators, no `experimentalDecorators`)
- Node.js ≥ 18 (native `fetch`, ES2022)

---

## License

MIT
