export { endpoint } from './decorator.js';
export { serverAdapter } from './server.js';
export { setConfig, getConfig, isConfigured } from './config.js';
export type {
	TypeGuard,
	HttpMethod,
	HTTPRequest,
	EndpointMeta,
	DecorAPIConfig,
	ClientConfig,
	ServerConfig,
} from './types.js';
export { DecorAPIError } from './types.js';

import type { DecorAPIConfig } from './types.js';
import { setConfig } from './config.js';
import { serverAdapter } from './server.js';
import type { Server } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Top-level namespace for one-shot configuration.
 *
 * Client:
 *   DecorAPI.configure({ mode: 'client', baseUrl: 'https://api.example.com' });
 *
 * Server (raw http.Server):
 *   DecorAPI.configure({ mode: 'server', server: httpServer });
 *
 * Server (Express / framework handler):
 *   const handler = DecorAPI.createRequestHandler();
 *   app.use(handler);
 */
export const DecorAPI = {
	configure(config: DecorAPIConfig & { server?: Server }): void {
		setConfig(config);
		if (config.mode === 'server' && config.server) {
			serverAdapter.attach(config.server);
		}
	},

	createRequestHandler(): (req: IncomingMessage, res: ServerResponse) => void {
		return serverAdapter.createRequestHandler();
	},
} as const;
