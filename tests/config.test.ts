import { describe, it, expect } from '@jest/globals';
import { setConfig, getConfig, isConfigured } from '../src/config.js';

// Reset config between tests by re-importing a fresh module state isn't possible
// with ESM caching — so we use the public API and accept that tests share state.
// Tests are ordered to avoid cross-contamination.

describe('config', () => {
	it('isConfigured returns false before configure is called', () => {
		// This test must run first.
		expect(isConfigured()).toBe(false);
	});

	it('getConfig throws when not yet configured', () => {
		expect(() => getConfig()).toThrow('DecorAPI has not been configured');
	});

	it('setConfig + getConfig round-trips a client config', () => {
		setConfig({ mode: 'client', baseUrl: 'https://api.example.com' });
		const cfg = getConfig();
		expect(cfg.mode).toBe('client');
		if (cfg.mode === 'client') {
			expect(cfg.baseUrl).toBe('https://api.example.com');
		}
	});

	it('isConfigured returns true after configure is called', () => {
		expect(isConfigured()).toBe(true);
	});

	it('setConfig + getConfig round-trips a server config', () => {
		setConfig({ mode: 'server' });
		expect(getConfig().mode).toBe('server');
	});
});
