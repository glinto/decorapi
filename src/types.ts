export type TypeGuard<T> = (value: unknown) => value is T;

export type BodylessMethod = 'GET' | 'DELETE';
export type BodyMethod = 'POST' | 'PUT' | 'PATCH';
export type HttpMethod = BodylessMethod | BodyMethod;

/** Optional headers passed to a GET/DELETE decorated method. */
export interface RequestOptions {
	headers?: Record<string, string>;
}

/** Shape of the request object passed to a POST/PUT/PATCH decorated method on the server side. */
export interface HTTPRequest<T> {
	body: T;
	headers: Record<string, string>;
}

/** Metadata stored per decorated method. */
export interface EndpointMeta {
	httpMethod: HttpMethod;
	path: string;
	/** Absent for bodyless methods (GET, DELETE). */
	guardReq?: TypeGuard<unknown>;
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
