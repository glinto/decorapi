# decorapi Examples

A minimal greeting API demonstrating the isomorphic pattern.

## Quick Start

The same API class works as both a client (via `fetch`) and server (via `http.Server`) depending on configuration.

### 1. Build the library

```bash
npm run build
```

### 2. Start the server

```bash
npm run example:server
```

You should see:

```
✓ Server running at http://127.0.0.1:3000
  POST /greet – Accepts { name: string }
  GET  /heap  – Returns V8 heap statistics (server-only, uses dynamic import)
```

### 3. Run the client (in another terminal)

```bash
npm run example:client
```

You should see something like:

```
→ Calling POST /greet with { name: "World" }...
✓ Response: { greeting: 'Hello, World!' }

→ Calling GET /heap (bodyless; server uses dynamic import of node:v8 inside the method)...
✓ Heap stats:
    Total heap : 8.3 MB
    Used heap  : 5.1 MB
    Heap limit : 4096.0 MB
```

## Files

- **types.ts** – Shared type definitions and type guards for both endpoints
- **api.ts** – Shared `GreetingAPI` class with two `@endpoint` decorators
- **server.ts** – HTTP server setup using `node:http` and DecorAPI in server mode
- **client.ts** – Fetch-based client using DecorAPI in client mode

## What's Happening

### Endpoint 1: POST /greet

```typescript
@endpoint('POST', '/greet', isGreetRequest, isGreetResponse)
async greet(req: HTTPRequest<GreetRequest>): Promise<GreetResponse>
```

Plain server logic with no external dependencies.

### Endpoint 2: GET /heap — dynamic import pattern

```typescript
@endpoint('GET', '/heap', isHeapStats)
async heap(_opts?: RequestOptions): Promise<HeapStats> {
  const { getHeapStatistics } = await import('node:v8');
  const stats = getHeapStatistics();
  return { totalHeap: stats.total_heap_size, ... };
}
```

GET (and DELETE) endpoints are **bodyless** — they take an optional `RequestOptions` (`{ headers? }`) argument instead of `HTTPRequest<T>`. No request body is read or validated on the server side.

### Configuration drives the behaviour

`server.ts` calls `DecorAPI.configure({ mode: 'server' })`, while `client.ts` calls `DecorAPI.configure({ mode: 'client', baseUrl: '...' })`. Both then create the **same** `GreetingAPI` instance — the mode determines what happens when a decorated method is called.

## Next Steps

- Modify **api.ts** to add more endpoints
- Update **types.ts** with new request/response shapes
- type guards must match your interfaces exactly for validation to work
- See the main [README.md](../README.md) for production patterns (dynamic imports, error handling, framework integration)
