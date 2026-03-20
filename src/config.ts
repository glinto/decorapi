import type { DecorAPIConfig } from './types.js';

let _config: DecorAPIConfig | null = null;

export function setConfig(config: DecorAPIConfig): void {
	_config = config;
}

export function getConfig(): DecorAPIConfig {
	if (!_config) {
		throw new Error('DecorAPI has not been configured. Call DecorAPI.configure() first.');
	}
	return _config;
}

export function isConfigured(): boolean {
	return _config !== null;
}
