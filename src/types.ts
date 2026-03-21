export type TypeGuard<T> = (value: unknown) => value is T;

export type BodylessMethod = 'GET' | 'DELETE';
export type BodyMethod = 'POST' | 'PUT' | 'PATCH';
export type HttpMethod = BodylessMethod | BodyMethod;

/** Extract parameter names from a path template: `/users/:id/posts/:postId` → `['id', 'postId']`. */
export function extractPathParams(path: string): string[] {
	const matches = path.match(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
	return matches ? matches.map((m) => m.slice(1)) : [];
}

/** Convert a path template to a RegExp for matching: `/users/:id` → `/^\/users\/([^/]+)$/`. */
export function pathTemplateToRegex(path: string): RegExp {
	// Escape special regex chars except for :param placeholders
	const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
	// Replace escaped :param with capture group
	const pattern = escaped.replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '([^/]+)');
	return new RegExp(`^${pattern}$`);
}

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
	/** Path template if path contains parameters (same as `path` if no params). */
	pathTemplate: string;
	/** Extracted parameter names in order: `['id', 'postId']`. */
	paramNames: string[];
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
