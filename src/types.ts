export type TypeGuard<T> = (value: unknown) => value is T;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Shape of the request object passed to a decorated method on the server side. */
export interface HTTPRequest<T> {
	body: T;
	headers: Record<string, string>;
}

/** Metadata stored per decorated method. */
export interface EndpointMeta {
	httpMethod: HttpMethod;
	path: string;
	guardReq: TypeGuard<unknown>;
	guardRes: TypeGuard<unknown>;
}

export interface ClientConfig {
	mode: 'client';
	baseUrl: string;
}

export interface ServerConfig {
	mode: 'server';
}

export type DecorAPIConfig = ClientConfig | ServerConfig;

/** Thrown when a TypeGuard fails validation. */
export class DecorAPIError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = 'DecorAPIError';
	}
}
