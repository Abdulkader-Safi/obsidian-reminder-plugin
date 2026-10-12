// Settings types, defaults and checks. No Obsidian imports, so this file runs under `node --test`.

export type Source =
	| { kind: 'single'; property: string }
	| { kind: 'pair'; dayProperty: string; timeProperty: string };

export interface Settings {
	version: 1;
	scope: 'vault' | 'folders';
	folders: string[];
	sources: Source[];
}

export const DEFAULT_SETTINGS: Settings = {
	version: 1,
	scope: 'vault',
	folders: [],
	sources: [{ kind: 'single', property: 'reminder' }],
};

/** Identifies a source. Two sources with the same key are duplicates. */
export function sourceKey(source: Source): string {
	return source.kind === 'single'
		? `single:${source.property.trim().toLowerCase()}`
		: `pair:${source.dayProperty.trim().toLowerCase()}+${source.timeProperty.trim().toLowerCase()}`;
}

/** Returns the message to show under an invalid source, or null when it is fine. */
export function validateSource(
	candidate: Source,
	existing: Source[],
): string | null {
	const names =
		candidate.kind === 'single'
			? [candidate.property]
			: [candidate.dayProperty, candidate.timeProperty];
	if (names.some((name) => name.trim() === '')) {
		return 'Enter a property name.';
	}
	if (
		candidate.kind === 'pair' &&
		candidate.dayProperty.trim().toLowerCase() ===
			candidate.timeProperty.trim().toLowerCase()
	) {
		return 'The day and the time need different properties.';
	}
	const key = sourceKey(candidate);
	if (existing.some((source) => sourceKey(source) === key)) {
		return 'This property is already in the list.';
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSource(value: unknown): Source | null {
	if (!isRecord(value)) return null;
	if (value.kind === 'single' && typeof value.property === 'string') {
		return { kind: 'single', property: value.property.trim() };
	}
	if (
		value.kind === 'pair' &&
		typeof value.dayProperty === 'string' &&
		typeof value.timeProperty === 'string'
	) {
		return {
			kind: 'pair',
			dayProperty: value.dayProperty.trim(),
			timeProperty: value.timeProperty.trim(),
		};
	}
	return null;
}

/**
 * Turns whatever `loadData()` returned into valid settings. `data.json` can be
 * synced or edited by hand, so nothing in it is trusted: a bad scope falls back
 * to the whole vault and an invalid source is dropped.
 */
export function readSettings(data: unknown): Settings {
	const settings: Settings = {
		...DEFAULT_SETTINGS,
		folders: [],
		sources: [...DEFAULT_SETTINGS.sources],
	};
	if (!isRecord(data)) return settings;

	if (data.scope === 'vault' || data.scope === 'folders') {
		settings.scope = data.scope;
	}

	if (Array.isArray(data.folders)) {
		for (const folder of data.folders) {
			if (typeof folder !== 'string') continue;
			const path = folder === '/' ? '/' : folder.replace(/\/+$/, '');
			if (path !== '' && !settings.folders.includes(path)) {
				settings.folders.push(path);
			}
		}
	}

	// An empty list is a valid choice (nothing fires), so only a missing list gets the default.
	if (Array.isArray(data.sources)) {
		settings.sources = [];
		for (const value of data.sources) {
			const source = readSource(value);
			if (source && validateSource(source, settings.sources) === null) {
				settings.sources.push(source);
			}
		}
	}

	return settings;
}
