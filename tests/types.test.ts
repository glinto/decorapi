import { describe, it, expect } from '@jest/globals';
import { DecorAPIError } from '../src/types.js';

describe('DecorAPIError', () => {
	it('creates an error with a message', () => {
		const err = new DecorAPIError('something went wrong');
		expect(err.message).toBe('something went wrong');
		expect(err.name).toBe('DecorAPIError');
		expect(err.statusCode).toBeUndefined();
		expect(err).toBeInstanceOf(Error);
	});

	it('stores an optional statusCode', () => {
		const err = new DecorAPIError('not found', 404);
		expect(err.statusCode).toBe(404);
	});
});
