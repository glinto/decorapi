import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { DecorAPIError, type EndpointMeta, type HttpMethod, pathTemplateToRegex } from './types.js';

interface RouteEntry extends EndpointMeta {
	handler: (...args: unknown[]) => unknown;
	/** Compiled regex for matching this route's path template. */
	pathRegex?: RegExp;
}

/**
 * Singleton adapter that collects registered route entries and dispatches
 * incoming Node.js HTTP requests to the correct handler.
 *
 * Works with a raw `http.Server` or as a standalone `(req, res) => void`
 * handler for use with Express / any compatible framework.
 */
class ServerAdapter {
	private readonly routes: RouteEntry[] = [];
	private attachedServer: Server | null = null;

	/** Called by the @endpoint addInitializer when mode === 'server'. */
	register(entry: RouteEntry): void {
		// Ensure pathTemplate is synced with path (for tests that override path)
		const pathTemplate = entry.path;
		// Compile regex for route matching
		const pathRegex = pathTemplateToRegex(pathTemplate);
		this.routes.push({ ...entry, pathTemplate, pathRegex });
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

		// Find matching route by iterating through entries and matching regex
		let matchedEntry: RouteEntry | undefined;
		let pathParams: string[] = [];
		for (const entry of this.routes) {
			if (entry.httpMethod !== method) continue;
			const match = entry.pathRegex?.exec(path);
			if (match) {
				matchedEntry = entry;
				pathParams = match.slice(1); // Capture groups are the params
				break;
			}
		}

		if (!matchedEntry) {
			// Not a route we own — let the server handle it (or 404).
			return;
		}

		let body: unknown;
		if (matchedEntry.guardReq !== undefined) {
			// Body-carrying method: read, parse and validate the JSON body.
			try {
				body = await readJson(req);
			} catch {
				sendJson(res, 400, { error: 'Invalid JSON body' });
				return;
			}

			if (!matchedEntry.guardReq(body)) {
				sendJson(res, 400, { error: 'Request body failed type validation' });
				return;
			}
		}

		try {
			// Build handler arguments: path params first (if any), then body/options
			const handlerArgs: unknown[] = [];

			// Only include params if this endpoint has any
			if (matchedEntry.paramNames.length > 0) {
				handlerArgs.push(...pathParams);
			}

			if (matchedEntry.guardReq !== undefined) {
				// Body-carrying: add HTTPRequest object
				handlerArgs.push({ body, headers: headersToRecord(req) });
			} else {
				// Bodyless: add optional RequestOptions
				handlerArgs.push({ headers: headersToRecord(req) });
			}

			const result = await matchedEntry.handler(...handlerArgs);

			if (!matchedEntry.guardRes(result)) {
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
