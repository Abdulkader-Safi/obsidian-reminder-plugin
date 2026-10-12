// Decides whether a note is watched. No Obsidian imports, so this file runs under `node --test`.

import type { Settings } from './settings.ts';

/** True for a Markdown note in the whole vault, or inside a chosen folder or any of its subfolders. */
export function inScope(
	path: string,
	settings: Pick<Settings, 'scope' | 'folders'>,
): boolean {
	if (!path.toLowerCase().endsWith('.md')) return false;
	if (settings.scope === 'vault') return true;
	// The trailing slash keeps `Projects` from matching `Projects-old/a.md`. The vault root is `/`.
	return settings.folders.some(
		(folder) => folder === '/' || path.startsWith(`${folder}/`),
	);
}
