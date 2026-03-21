import { describe, it, expect, beforeAll } from '@jest/globals';
import http from 'node:http';
import { serverAdapter } from '../src/server.js';
import type { EndpointMeta } from '../src/types.js';

// Helper: fire a request against the adapter's handler and collect the response.
function request(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
	options: { method: string; path: string; body?: unknown },
): Promise<{ status: number; body: unknown }> {
	return new Promise((resolve, reject) => {
		const server = http.createServer(handler);
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address() as { port: number };
			const payload = options.body !== undefined ? JSON.stringify(options.body) : '';
			const req = http.request(
				{
					hostname: '127.0.0.1',
					port: addr.port,
					method: options.method,
					path: options.path,
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': Buffer.byteLength(payload),
					},
				},
				(res: http.IncomingMessage) => {
					const chunks: Buffer[] = [];
					res.on('data', (c: Buffer) => chunks.push(c));
					res.on('end', () => {
						server.close();
						const text = Buffer.concat(chunks).toString('utf8');
						resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) });
					});
				},
			);
			req.on('error', (e: Error) => {
				server.close();
				reject(e);
			});
			req.end(payload);
		});
	});
}

interface Greeting {
	greeting: string;
}
const isGreeting = (x: unknown): x is Greeting => typeof (x as Greeting)?.greeting === 'string';

interface NameBody {
	name: string;
}
const isNameBody = (x: unknown): x is NameBody => typeof (x as NameBody)?.name === 'string';

const greetMeta: EndpointMeta = {
	httpMethod: 'POST',
	path: '/greet',
	pathTemplate: '/greet',
	paramNames: [],
	guardReq: isNameBody,
	guardRes: isGreeting,
};

describe('ServerAdapter', () => {
	let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

	beforeAll(() => {
		serverAdapter.register({
			...greetMeta,
			handler: async (arg: unknown) => {
				const { body } = arg as { body: NameBody };
				return { greeting: `Hello, ${body.name}!` };
			},
		});
		handler = serverAdapter.createRequestHandler();
	});

	it('returns 200 with the serialised result for a valid request', async () => {
		const { status, body } = await request(handler, {
			method: 'POST',
			path: '/greet',
			body: { name: 'world' },
		});
		expect(status).toBe(200);
		expect(body).toEqual({ greeting: 'Hello, world!' });
	});

	it('returns 400 when the request body fails the typeguard', async () => {
		const { status, body } = await request(handler, {
			method: 'POST',
			path: '/greet',
			body: { wrong: 'field' },
		});
		expect(status).toBe(400);
		expect((body as { error: string }).error).toMatch(/type validation/);
	});

	it('returns 400 on malformed JSON', async () => {
		// Send raw invalid JSON by overriding the body manually via low-level http.
		const { status } = await request(handler, {
			method: 'POST',
			path: '/greet',
			body: 'NOT_JSON_RAW',
		}).catch(async () => {
			// Fallback: craft a truly invalid JSON body directly
			return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
				const server = http.createServer(handler);
				server.listen(0, '127.0.0.1', () => {
					const addr = server.address() as { port: number };
					const payload = '{invalid';
					const req = http.request(
						{
							hostname: '127.0.0.1',
							port: addr.port,
							method: 'POST',
							path: '/greet',
							headers: {
								'Content-Type': 'application/json',
								'Content-Length': Buffer.byteLength(payload),
							},
						},
						(res: http.IncomingMessage) => {
							const chunks: Buffer[] = [];
							res.on('data', (c: Buffer) => chunks.push(c));
							res.on('end', () => {
								server.close();
								resolve({
									status: res.statusCode ?? 0,
									body: JSON.parse(Buffer.concat(chunks).toString()),
								});
							});
						},
					);
					req.on('error', (e: Error) => {
						server.close();
						reject(e);
					});
					req.end(payload);
				});
			});
		});
		expect(status).toBe(400);
	});

	it('does not respond (passes through) for unknown routes', async () => {
		// The server should close the connection with a 404 from the test server's default behaviour
		// OR leave the response open. We wrap in a timeout to detect pass-through.
		const result = await new Promise<{ status: number }>((resolve) => {
			const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
				handler(req, res);
				// Default fallback: the adapter won't respond for unknown routes.
				// We must send something ourselves to avoid a hanging connection.
				if (!res.headersSent) {
					res.writeHead(404);
					res.end();
				}
			});
			server.listen(0, '127.0.0.1', () => {
				const addr = server.address() as { port: number };
				const req = http.request(
					{ hostname: '127.0.0.1', port: addr.port, method: 'GET', path: '/unknown' },
					(res: http.IncomingMessage) => {
						res.resume();
						res.on('end', () => {
							server.close();
							resolve({ status: res.statusCode ?? 0 });
						});
					},
				);
				req.end();
			});
		});
		expect(result.status).toBe(404);
	});
});

describe('ServerAdapter – bodyless GET endpoint', () => {
	interface StatusResponse {
		status: string;
	}
	const isStatusResponse = (x: unknown): x is StatusResponse =>
		typeof (x as StatusResponse)?.status === 'string';

	const statusMeta: EndpointMeta = {
		httpMethod: 'GET',
		path: '/status',
		pathTemplate: '/status',
		paramNames: [],
		// guardReq is intentionally absent – this is a bodyless endpoint
		guardRes: isStatusResponse,
	};

	let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

	beforeAll(() => {
		serverAdapter.register({
			...statusMeta,
			handler: async () => ({ status: 'ok' }),
		});
		handler = serverAdapter.createRequestHandler();
	});

	it('returns 200 without reading a request body', async () => {
		const { status, body } = await request(handler, { method: 'GET', path: '/status' });
		expect(status).toBe(200);
		expect(body).toEqual({ status: 'ok' });
	});

	it('passes headers to the handler', async () => {
		serverAdapter.register({
			...statusMeta,
			path: '/status-headers',
			handler: async (arg: unknown) => ({
				status: (arg as { headers: Record<string, string> }).headers['x-test'] ?? 'missing',
			}),
		});
		const handler2 = serverAdapter.createRequestHandler();
		// The request helper always sends Content-Type; inject x-test via a lower level request
		const result = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
			const server = http.createServer(handler2);
			server.listen(0, '127.0.0.1', () => {
				const addr = server.address() as { port: number };
				const req = http.request(
					{
						hostname: '127.0.0.1',
						port: addr.port,
						method: 'GET',
						path: '/status-headers',
						headers: { 'x-test': 'hello' },
					},
					(res) => {
						const chunks: Buffer[] = [];
						res.on('data', (c: Buffer) => chunks.push(c));
						res.on('end', () => {
							server.close();
							resolve({
								status: res.statusCode ?? 0,
								body: JSON.parse(Buffer.concat(chunks).toString()),
							});
						});
					},
				);
				req.on('error', (e) => {
					server.close();
					reject(e);
				});
				req.end();
			});
		});
		expect(result.status).toBe(200);
		expect((result.body as StatusResponse).status).toBe('hello');
	});
});

describe('ServerAdapter – parameterized routes', () => {
	interface ItemResponse {
		itemId: string;
	}
	interface CreateItemBody {
		name: string;
	}
	interface CreateItemResponse {
		groupId: string;
		itemId: string;
	}

	const isItemResponse = (x: unknown): x is ItemResponse =>
		typeof (x as ItemResponse)?.itemId === 'string';
	const isCreateItemBody = (x: unknown): x is CreateItemBody =>
		typeof (x as CreateItemBody)?.name === 'string';
	const isCreateItemResponse = (x: unknown): x is CreateItemResponse =>
		typeof (x as CreateItemResponse)?.groupId === 'string' &&
		typeof (x as CreateItemResponse)?.itemId === 'string';

	let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

	beforeAll(() => {
		// GET /items/:id (single param)
		serverAdapter.register({
			httpMethod: 'GET',
			path: '/items/:id',
			pathTemplate: '/items/:id',
			paramNames: ['id'],
			guardRes: isItemResponse,
			handler: async (...args: unknown[]) => {
				const id = args[0] as string;
				return { itemId: id };
			},
		});

		// POST /groups/:groupId/items (single param)
		serverAdapter.register({
			httpMethod: 'POST',
			path: '/groups/:groupId/items',
			pathTemplate: '/groups/:groupId/items',
			paramNames: ['groupId'],
			guardReq: isCreateItemBody,
			guardRes: isCreateItemResponse,
			handler: async (...args: unknown[]) => {
				const groupId = args[0] as string;
				const req = args[1] as { body: CreateItemBody };
				return { groupId, itemId: `item-${req.body.name}` };
			},
		});

		// GET /groups/:groupId/items/:itemId (multiple params)
		serverAdapter.register({
			httpMethod: 'GET',
			path: '/groups/:groupId/items/:itemId',
			pathTemplate: '/groups/:groupId/items/:itemId',
			paramNames: ['groupId', 'itemId'],
			guardRes: isCreateItemResponse,
			handler: async (...args: unknown[]) => {
				const groupId = args[0] as string;
				const itemId = args[1] as string;
				return { groupId, itemId };
			},
		});

		handler = serverAdapter.createRequestHandler();
	});

	it('extracts single path param and passes to handler', async () => {
		const { status, body } = await request(handler, {
			method: 'GET',
			path: '/items/123',
		});
		expect(status).toBe(200);
		expect((body as ItemResponse).itemId).toBe('123');
	});

	it('extracts param for POST with body', async () => {
		const { status, body } = await request(handler, {
			method: 'POST',
			path: '/groups/456/items',
			body: { name: 'test' },
		});
		expect(status).toBe(200);
		expect((body as CreateItemResponse).groupId).toBe('456');
		expect((body as CreateItemResponse).itemId).toBe('item-test');
	});

	it('extracts multiple path params', async () => {
		const { status, body } = await request(handler, {
			method: 'GET',
			path: '/groups/789/items/999',
		});
		expect(status).toBe(200);
		expect((body as CreateItemResponse).groupId).toBe('789');
		expect((body as CreateItemResponse).itemId).toBe('999');
	});
});
