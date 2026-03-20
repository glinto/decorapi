import type { HttpMethod, TypeGuard } from './types.js';
import { registerEndpoint } from './registry.js';
import { getConfig } from './config.js';
import { clientHandler } from './client.js';
import { serverAdapter } from './server.js';

/**
 * TC39 Stage-3 method decorator.
 *
 * @param httpMethod  HTTP verb used for the route.
 * @param path        Route path, e.g. '/foo'.
 * @param guardReq    TypeGuard that validates the incoming request body.
 * @param guardRes    TypeGuard that validates the outgoing response body.
 */
export function endpoint<TReq, TRes>(
	httpMethod: HttpMethod,
	path: string,
	guardReq: TypeGuard<TReq>,
	guardRes: TypeGuard<TRes>,
) {
	return function (
		originalFn: (...args: unknown[]) => unknown,
		context: ClassMethodDecoratorContext,
	): ((...args: unknown[]) => Promise<unknown>) {
		const methodName = String(context.name);

		// 1. Store metadata in the registry (keyed on the prototype at apply-time).
		//    We use addInitializer to grab the correct prototype via `this`.
		context.addInitializer(function (this: unknown) {
			const proto = Object.getPrototypeOf(this as object) as object;
			registerEndpoint(proto, methodName, {
				httpMethod,
				path,
				guardReq: guardReq as TypeGuard<unknown>,
				guardRes: guardRes as TypeGuard<unknown>,
			});

			const config = getConfig();

			if (config.mode === 'server') {
				serverAdapter.register({
					httpMethod,
					path,
					guardReq: guardReq as TypeGuard<unknown>,
					guardRes: guardRes as TypeGuard<unknown>,
					// Bind to this instance so `this` works inside the method.
					handler: (originalFn as (...args: unknown[]) => unknown).bind(this),
				});
			}
		});

		// 2. Return the wrapper that is placed on the prototype.
		return async function (this: object, ...args: unknown[]): Promise<unknown> {
			const config = getConfig();

			if (config.mode === 'client') {
				return clientHandler(
					{
						httpMethod,
						path,
						guardReq: guardReq as TypeGuard<unknown>,
						guardRes: guardRes as TypeGuard<unknown>,
					},
					config.baseUrl,
					args[0],
				);
			}

			// Server mode: the method should be invoked by the server adapter,
			// not called directly by user code in a server context.
			throw new Error(
				`[decorapi] Method "${methodName}" must not be called directly in server mode. ` +
					'It is handled automatically via the HTTP server adapter.',
			);
		};
	};
}
