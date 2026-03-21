/**
 * Example server using decorapi.
 *
 * Usage:
 *   npm run example:server
 *
 * This starts an HTTP server on localhost:3000 with a POST /greet endpoint.
 * Routes are registered when the GreetingAPI instance is created.
 */

import http from 'node:http';
import { DecorAPI } from '../dist/index.mjs';
import { GreetingAPI } from './api.js';

// Configure decorapi in server mode (no http.Server; we'll attach it after creation)
DecorAPI.configure({ mode: 'server' });

// Create an instance of the API class.
// The @endpoint decorator uses context.addInitializer() to register this route.
const api = new GreetingAPI();

// Create the HTTP server and attach it to DecorAPI
const server = http.createServer(DecorAPI.createRequestHandler());

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
	console.log(`✓ Server running at http://127.0.0.1:${PORT}`);
	console.log(`  POST /greet – Accepts { name: string }`);
	console.log(`  GET  /heap  – Returns V8 heap statistics (server-only, uses dynamic import)`);
});

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
	console.log('\n✓ Shutting down...');
	server.close(() => {
		console.log('✓ Server closed');
		process.exit(0);
	});
});
