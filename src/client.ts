import {
	DecorAPIError,
	type EndpointMeta,
	type HTTPRequest,
	type RequestOptions,
} from './types.js';

/**
 * Executes a decorated method call on the client side:
 * interpolates path parameters into URL, serialises request body, fires a fetch, validates response.
 */
export async function clientHandler(
	meta: EndpointMeta,
	baseUrl: string,
	requestWithParams: { params: unknown[]; request: unknown },
): Promise<unknown> {
	const { params, request: requestArg } = requestWithParams;

	// Bodyless methods (GET, DELETE) pass optional { headers? }; body methods pass { body, headers }.
	const isBodyless = meta.guardReq === undefined;
	const req = requestArg as HTTPRequest<unknown> | RequestOptions | undefined;
	const body = isBodyless ? undefined : (req as HTTPRequest<unknown>)?.body;
	const reqHeaders = (req as { headers?: Record<string, string> })?.headers ?? {};

	// Build URL by interpolating params into pathTemplate
	let url = meta.pathTemplate;
	for (let i = 0; i < meta.paramNames.length; i++) {
		const paramName = meta.paramNames[i];
		const paramValue = String(params[i] ?? '');
		url = url.replace(`:${paramName}`, encodeURIComponent(paramValue));
	}
	url = `${baseUrl.replace(/\/$/, '')}${url}`;

	const init: RequestInit = {
		method: meta.httpMethod,
		headers: {
			'Content-Type': 'application/json',
			...reqHeaders,
		},
	};

	if (!isBodyless) {
		init.body = JSON.stringify(body ?? null);
	}

	let response: Response;
	try {
		response = await fetch(url, init);
	} catch (cause) {
		throw new DecorAPIError(`Network error calling ${meta.httpMethod} ${url}: ${String(cause)}`);
	}

	if (!response.ok) {
		throw new DecorAPIError(
			`HTTP ${response.status} from ${meta.httpMethod} ${url}`,
			response.status,
		);
	}

	let json: unknown;
	try {
		json = await response.json();
	} catch {
		throw new DecorAPIError(`Failed to parse JSON response from ${meta.httpMethod} ${url}`);
	}

	if (!meta.guardRes(json)) {
		throw new DecorAPIError(`Response from ${meta.httpMethod} ${url} failed type validation`, 502);
	}

	return json;
}
