import { describe, it, expect } from '@jest/globals';
import { registerEndpoint, getEndpoints } from '../src/registry.js';
import type { EndpointMeta } from '../src/types.js';

const makeMeta = (path: string): EndpointMeta => ({
	httpMethod: 'POST',
	path,
	guardReq: (x): x is unknown => true,
	guardRes: (x): x is unknown => true,
});

describe('registry', () => {
	it('registers and retrieves endpoints by prototype + method name', () => {
		const proto = {};
		const meta = makeMeta('/foo');
		registerEndpoint(proto, 'foo', meta);

		const endpoints = getEndpoints(proto);
		expect(endpoints.get('foo')).toBe(meta);
	});

	it('returns an empty map for an unknown prototype', () => {
		expect(getEndpoints({}).size).toBe(0);
	});

	it('allows multiple methods on the same prototype', () => {
		const proto = {};
		registerEndpoint(proto, 'a', makeMeta('/a'));
		registerEndpoint(proto, 'b', makeMeta('/b'));

		const endpoints = getEndpoints(proto);
		expect(endpoints.size).toBe(2);
		expect(endpoints.get('a')?.path).toBe('/a');
		expect(endpoints.get('b')?.path).toBe('/b');
	});

	it('overwrites an existing entry for the same method name', () => {
		const proto = {};
		registerEndpoint(proto, 'dup', makeMeta('/v1'));
		registerEndpoint(proto, 'dup', makeMeta('/v2'));

		expect(getEndpoints(proto).get('dup')?.path).toBe('/v2');
	});
});
