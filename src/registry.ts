import type { EndpointMeta } from './types.js';

/**
 * Module-level registry: class-prototype → method-name → EndpointMeta.
 * Populated at class-body evaluation time by the @endpoint decorator.
 */
const registry = new WeakMap<object, Map<string, EndpointMeta>>();

export function registerEndpoint(proto: object, methodName: string, meta: EndpointMeta): void {
	let methods = registry.get(proto);
	if (!methods) {
		methods = new Map();
		registry.set(proto, methods);
	}
	methods.set(methodName, meta);
}

export function getEndpoints(proto: object): Map<string, EndpointMeta> {
	return registry.get(proto) ?? new Map();
}
