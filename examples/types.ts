/**
 * Shared types and type guards for the greeting API.
 */

export interface GreetRequest {
	name: string;
}

export interface GreetResponse {
	greeting: string;
}

export const isGreetRequest = (x: unknown): x is GreetRequest =>
	typeof (x as GreetRequest)?.name === 'string';

export const isGreetResponse = (x: unknown): x is GreetResponse =>
	typeof (x as GreetResponse)?.greeting === 'string';

// ---- Heap stats (GET /heap, server-only via dynamic import) ----

export interface HeapStats {
	totalHeap: number;
	usedHeap: number;
	heapLimit: number;
}

export const isHeapStats = (x: unknown): x is HeapStats => {
	const s = x as HeapStats;
	return (
		typeof s?.totalHeap === 'number' &&
		typeof s?.usedHeap === 'number' &&
		typeof s?.heapLimit === 'number'
	);
};
