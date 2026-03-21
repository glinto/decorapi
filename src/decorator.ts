import type {
	HttpMethod,
	BodylessMethod,
	BodyMethod,
	TypeGuard,
	HTTPRequest,
	RequestOptions,
} from './types.js';
import { registerEndpoint } from './registry.js';
import { getConfig } from './config.js';
import { clientHandler } from './client.js';
import { serverAdapter } from './server.js';

/**
 * @endpoint overload for bodyless methods (GET, DELETE).
 * The decorated method receives an optional `{ headers? }` argument.
 */
export function endpoint<TRes>(
	httpMethod: BodylessMethod,
	path: string,
	guardRes: TypeGuard<TRes>,
): <This>(
	originalFn: (this: This, opts?: RequestOptions) => Promise<TRes>,
	context: ClassMethodDecoratorContext<This, (this: This, opts?: RequestOptions) => Promise<TRes>>,
) => (this: This, opts?: RequestOptions) => Promise<TRes>;

/**
 * @endpoint overload for body-carrying methods (POST, PUT, PATCH).
 * The decorated method receives an `HTTPRequest<TReq>` argument.
 */
export function endpoint<TReq, TRes>(
	httpMethod: BodyMethod,
	path: string,
	guardReq: TypeGuard<TReq>,
	guardRes: TypeGuard<TRes>,
): <This>(
	originalFn: (this: This, req: HTTPRequest<TReq>) => Promise<TRes>,
	context: ClassMethodDecoratorContext<This, (this: This, req: HTTPRequest<TReq>) => Promise<TRes>>,
) => (this: This, req: HTTPRequest<TReq>) => Promise<TRes>;

// Implementation — signature must be a supertype of both overloads.
// Return type is `any` so TypeScript accepts both overload return shapes;
// the overload signatures above are what callers actually see.
export function endpoint<TReq = unknown, TRes = unknown>(
	httpMethod: HttpMethod,
	path: string,
	guardReqOrRes: TypeGuard<TReq> | TypeGuard<TRes>,
	guardResOpt?: TypeGuard<TRes>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
	const isBodyless = guardResOpt === undefined;
	const guardReq = isBodyless ? undefined : (guardReqOrRes as TypeGuard<TReq>);
	const guardRes = isBodyless ? (guardReqOrRes as TypeGuard<TRes>) : guardResOpt!;

	return function <This>(
		originalFn: (this: This, arg: HTTPRequest<TReq> | RequestOptions | undefined) => Promise<TRes>,
		context: ClassMethodDecoratorContext<
			This,
			(this: This, arg: HTTPRequest<TReq> | RequestOptions | undefined) => Promise<TRes>
		>,
	) {
		const methodName = String(context.name);

		context.addInitializer(function (this: This) {
			const proto = Object.getPrototypeOf(this as object) as object;
			registerEndpoint(proto, methodName, {
				httpMethod,
				path,
				guardReq: guardReq as TypeGuard<unknown> | undefined,
				guardRes: guardRes as TypeGuard<unknown>,
			});

			const config = getConfig();

			if (config.mode === 'server') {
				serverAdapter.register({
					httpMethod,
					path,
					guardReq: guardReq as TypeGuard<unknown> | undefined,
					guardRes: guardRes as TypeGuard<unknown>,
					handler: originalFn.bind(this) as (...args: unknown[]) => unknown,
				});
			}
		});

		return async function (
			this: This,
			arg: HTTPRequest<TReq> | RequestOptions | undefined,
		): Promise<TRes> {
			const config = getConfig();

			if (config.mode === 'client') {
				return clientHandler(
					{
						httpMethod,
						path,
						guardReq: guardReq as TypeGuard<unknown> | undefined,
						guardRes: guardRes as TypeGuard<unknown>,
					},
					config.baseUrl,
					arg,
				) as Promise<TRes>;
			}

			throw new Error(
				`[decorapi] Method "${methodName}" must not be called directly in server mode. ` +
					'It is handled automatically via the HTTP server adapter.',
			);
		};
	};
}
