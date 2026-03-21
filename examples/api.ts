/**
 * Shared API class used by both client and server.
 *
 * In client mode, the decorated method is replaced with a fetch call.
 * In server mode, the method body runs as a route handler.
 */

import { endpoint, type HTTPRequest, type RequestOptions } from '../dist/index.mjs';
import {
	isGreetRequest,
	isGreetResponse,
	type GreetRequest,
	type GreetResponse,
	isHeapStats,
	type HeapStats,
} from './types.js';

export class GreetingAPI {
	@endpoint('POST', '/greet', isGreetRequest, isGreetResponse)
	async greet(req: HTTPRequest<GreetRequest>): Promise<GreetResponse> {
		// This body runs on the server.
		// On the client, this method is replaced with a fetch call.
		return { greeting: `Hello, ${req.body.name}!` };
	}

	@endpoint('GET', '/heap', isHeapStats)
	async heap(_opts?: RequestOptions): Promise<HeapStats> {
		// GET endpoint — no request body.
		// node:v8 is a Node.js-only module — dynamically imported so bundlers
		// won't include it in client builds (the method body never runs client-side).
		const { getHeapStatistics } = await import('node:v8');
		const stats = getHeapStatistics();
		return {
			totalHeap: stats.total_heap_size,
			usedHeap: stats.used_heap_size,
			heapLimit: stats.heap_size_limit,
		};
	}
}
