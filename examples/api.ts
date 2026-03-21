/**
 * Shared API class used by both client and server.
 *
 * In client mode, the decorated method is replaced with a fetch call.
 * In server mode, the method body runs as a route handler.
 */

import { endpoint, type HTTPRequest } from '../dist/index.mjs';
import {
	isGreetRequest,
	isGreetResponse,
	type GreetRequest,
	type GreetResponse,
	isHeapRequest,
	isHeapStats,
	type HeapRequest,
	type HeapStats,
} from './types.js';

export class GreetingAPI {
	@endpoint('POST', '/greet', isGreetRequest, isGreetResponse)
	async greet(req: HTTPRequest<GreetRequest>): Promise<GreetResponse> {
		// This body runs on the server.
		// On the client, this method is replaced with a fetch call.
		return { greeting: `Hello, ${req.body.name}!` };
	}

	@endpoint('POST', '/heap', isHeapRequest, isHeapStats)
	async heap(_req: HTTPRequest<HeapRequest>): Promise<HeapStats> {
		// node:v8 is a Node.js-only module — it only exists on the server.
		//
		// Importing it dynamically here is the recommended pattern:
		//   - Server mode: the import runs at call-time, works fine.
		//   - Client mode: this method body is never executed (the decorator
		//     replaces it with a fetch call), so the import never runs and
		//     bundlers (esbuild, webpack, etc.) won't pull node:v8 into the
		//     client bundle.
		//
		// A static `import v8 from 'node:v8'` at the top of the file would
		// break any client-side bundler that processes this shared file.
		const { getHeapStatistics } = await import('node:v8');
		const stats = getHeapStatistics();
		return {
			totalHeap: stats.total_heap_size,
			usedHeap: stats.used_heap_size,
			heapLimit: stats.heap_size_limit,
		};
	}
}
