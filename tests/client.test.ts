import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { clientHandler } from '../src/client.js';
import { DecorAPIError } from '../src/types.js';
import type { EndpointMeta } from '../src/types.js';

const isString = (x: unknown): x is string => typeof x === 'string';
const isNumber = (x: unknown): x is number => typeof x === 'number';

const meta: EndpointMeta = {
	httpMethod: 'POST',
	path: '/test',
	guardReq: (x): x is unknown => true,
	guardRes: isString,
};

const mockFetch = (response: Partial<Response>) => {
	const fn = jest.fn() as jest.MockedFunction<() => Promise<Response>>;
	fn.mockResolvedValue(response as Response);
	global.fetch = fn as unknown as typeof global.fetch;
};

afterEach(() => {
	jest.restoreAllMocks();
});

describe('clientHandler', () => {
	it('sends a POST with the serialised body and returns the validated result', async () => {
		mockFetch({ ok: true, json: async () => 'hello' });
		const result = await clientHandler(meta, 'https://api.example.com', {
			body: { name: 'world' },
			headers: {},
		});
		expect(result).toBe('hello');
		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.example.com/test',
			expect.objectContaining({ method: 'POST' }),
		);
	});

	it('strips trailing slash from baseUrl', async () => {
		mockFetch({ ok: true, json: async () => 'ok' });
		await clientHandler(meta, 'https://api.example.com/', { body: null, headers: {} });
		expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://api.example.com/test');
	});

	it('does not send a body for GET requests', async () => {
		const getMeta: EndpointMeta = {
			...meta,
			httpMethod: 'GET',
			guardReq: undefined,
			guardRes: (x): x is unknown => true,
		};
		mockFetch({ ok: true, json: async () => 42 });
		await clientHandler(getMeta, 'https://api.example.com', undefined);
		const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
		expect(init.body).toBeUndefined();
	});

	it('forwards custom headers for GET requests', async () => {
		const getMeta: EndpointMeta = {
			...meta,
			httpMethod: 'GET',
			guardReq: undefined,
			guardRes: (x): x is unknown => true,
		};
		mockFetch({ ok: true, json: async () => 42 });
		await clientHandler(getMeta, 'https://api.example.com', {
			headers: { Authorization: 'Bearer tok' },
		});
		const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
		expect(init.body).toBeUndefined();
	});

	it('throws DecorAPIError on network failure', async () => {
		const fn = jest.fn() as jest.MockedFunction<() => Promise<Response>>;
		fn.mockRejectedValue(new Error('network down'));
		global.fetch = fn as unknown as typeof global.fetch;
		await expect(clientHandler(meta, 'https://api.example.com', undefined)).rejects.toThrow(
			DecorAPIError,
		);
	});

	it('throws DecorAPIError with statusCode on non-2xx response', async () => {
		mockFetch({ ok: false, status: 404 });
		const err = await clientHandler(meta, 'https://api.example.com', undefined).catch((e) => e);
		expect(err).toBeInstanceOf(DecorAPIError);
		expect((err as DecorAPIError).statusCode).toBe(404);
	});

	it('throws DecorAPIError when response fails the typeguard', async () => {
		const numberMeta: EndpointMeta = { ...meta, guardRes: isNumber };
		mockFetch({ ok: true, json: async () => 'not a number' });
		await expect(clientHandler(numberMeta, 'https://api.example.com', undefined)).rejects.toThrow(
			DecorAPIError,
		);
	});

	it('throws DecorAPIError when JSON parsing fails', async () => {
		mockFetch({
			ok: true,
			json: async () => {
				throw new SyntaxError('bad json');
			},
		});
		await expect(clientHandler(meta, 'https://api.example.com', undefined)).rejects.toThrow(
			DecorAPIError,
		);
	});
});
