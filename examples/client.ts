/**
 * Example client using decorapi.
 *
 * Usage:
 *   npm run example:client
 *
 * Run this after the server is running (npm run example:server in another terminal).
 * This calls the POST /greet endpoint and prints the result.
 */

import { DecorAPI } from '../dist/index.mjs';
import { GreetingAPI } from './api.js';

async function main() {
	// Configure decorapi in client mode with the server's base URL
	DecorAPI.configure({
		mode: 'client',
		baseUrl: 'http://127.0.0.1:3000',
	});

	// Create an instance of the API class.
	// In client mode, the decorated methods are replaced with fetch calls.
	const api = new GreetingAPI();

	try {
		console.log('→ Calling POST /greet with { name: "World" }...');
		const greeting = await api.greet({
			body: { name: 'World' },
			headers: {},
		});
		console.log('✓ Response:', greeting);

		console.log();

		// This call looks identical to the one above from the client's perspective,
		// but on the server the method body dynamically imports node:v8 — a
		// Node.js-only module that would crash any browser/client bundler if it
		// were statically imported at the top of the shared api.ts file.
		console.log(
			'→ Calling GET /heap (bodyless; server uses dynamic import of node:v8 inside the method)...',
		);
		const heap = await api.heap();
		console.log('✓ Heap stats:');
		console.log(`    Total heap : ${(heap.totalHeap / 1024 / 1024).toFixed(1)} MB`);
		console.log(`    Used heap  : ${(heap.usedHeap / 1024 / 1024).toFixed(1)} MB`);
		console.log(`    Heap limit : ${(heap.heapLimit / 1024 / 1024).toFixed(1)} MB`);

		console.log();

		console.log('→ Calling GET /groups/:groupId with groupId = "abc123" (parameterized route)...');
		const group = await api.getGroup('abc123');
		console.log('✓ Group:', group);
	} catch (error) {
		console.error('✗ Error:', error);
		process.exit(1);
	}
}

main();
