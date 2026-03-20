import { DecorAPIError, type EndpointMeta, type HTTPRequest } from './types.js';

/**
 * Executes a decorated method call on the client side:
 * serialises the request body, fires a fetch, validates the response.
 */
export async function clientHandler(
	meta: EndpointMeta,
	baseUrl: string,
	requestArg: unknown,
): Promise<unknown> {
	const req = requestArg as HTTPRequest<unknown> | undefined;
	const body = req?.body;

	const url = `${baseUrl.replace(/\/$/, '')}${meta.path}`;

	const init: RequestInit = {
		method: meta.httpMethod,
		headers: {
			'Content-Type': 'application/json',
			...(req?.headers ?? {}),
		},
	};

	if (meta.httpMethod !== 'GET' && meta.httpMethod !== 'DELETE') {
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
