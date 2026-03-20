import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { DecorAPIError, type EndpointMeta, type HttpMethod } from './types.js';

interface RouteEntry extends EndpointMeta {
	handler: (...args: unknown[]) => unknown;
}

/**
 * Singleton adapter that collects registered route entries and dispatches
 * incoming Node.js HTTP requests to the correct handler.
 *
 * Works with a raw `http.Server` or as a standalone `(req, res) => void`
 * handler for use with Express / any compatible framework.
 */
class ServerAdapter {
	private readonly routes = new Map<string, RouteEntry>();
	private attachedServer: Server | null = null;

	/** Called by the @endpoint addInitializer when mode === 'server'. */
	register(entry: RouteEntry): void {
		const key = routeKey(entry.httpMethod, entry.path);
		this.routes.set(key, entry);
	}

	/**
	 * Attach to a raw Node.js `http.Server`.
	 * All registered routes will be dispatched via the server's 'request' event.
	 */
	attach(server: Server): void {
		if (this.attachedServer === server) return;
		this.attachedServer = server;
		server.on(
			'request',
			(req: IncomingMessage, res: ServerResponse) => void this.dispatch(req, res),
		);
	}

	/**
	 * Returns a framework-agnostic `(req, res) => void` handler.
	 * Use this with Express: `app.use(DecorAPI.createRequestHandler())`.
	 */
	createRequestHandler(): (req: IncomingMessage, res: ServerResponse) => void {
		return (req, res) => void this.dispatch(req, res);
	}

	private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
		const url = req.url ?? '/';
		// Strip query string for route matching.
		const path = url.split('?')[0] ?? url;

		const entry = this.routes.get(routeKey(method, path));
		if (!entry) {
			// Not a route we own — let the server handle it (or 404).
			return;
		}

		let body: unknown;
		try {
			body = await readJson(req);
		} catch {
			sendJson(res, 400, { error: 'Invalid JSON body' });
			return;
		}

		if (!entry.guardReq(body)) {
			sendJson(res, 400, { error: 'Request body failed type validation' });
			return;
		}

		try {
			const result = await entry.handler({ body, headers: headersToRecord(req) });

			if (!entry.guardRes(result)) {
				sendJson(res, 500, { error: 'Response failed type validation' });
				return;
			}

			sendJson(res, 200, result);
		} catch (err) {
			if (err instanceof DecorAPIError && err.statusCode) {
				sendJson(res, err.statusCode, { error: err.message });
			} else {
				sendJson(res, 500, { error: 'Internal server error' });
			}
		}
	}
}

// ── helpers ────────────────────────────────────────────────────────────────

function routeKey(method: string, path: string): string {
	return `${method.toUpperCase()}:${path}`;
}

function readJson(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			try {
				const raw = Buffer.concat(chunks).toString('utf8');
				resolve(raw.length > 0 ? JSON.parse(raw) : undefined);
			} catch (e) {
				reject(e);
			}
		});
		req.on('error', reject);
	});
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(payload),
	});
	res.end(payload);
}

function headersToRecord(req: IncomingMessage): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(req.headers)) {
		if (v !== undefined) {
			out[k] = Array.isArray(v) ? v.join(', ') : (v as string);
		}
	}
	return out;
}

export const serverAdapter = new ServerAdapter();
