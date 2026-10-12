import type { App, TFile } from 'obsidian';
import { extract, type UnreadableReason } from './parse.ts';
import { inScope } from './scope.ts';
import type { Settings } from './settings.ts';

export interface Reminder {
	/** Obsidian updates this object on rename, so the name and path stay current. */
	file: TFile;
	sourceKey: string;
	dueAt: number;
}

export interface Unreadable {
	file: TFile;
	sourceKey: string;
	reason: UnreadableReason;
}

interface Entry {
	reminders: Reminder[];
	unreadable: Unreadable[];
}

/** Every reminder in the vault, derived from the metadata cache. Safe to throw away and rebuild. */
export class ReminderIndex {
	private app: App;
	private getSettings: () => Settings;
	private entries = new Map<string, Entry>();
	/** In-scope notes Obsidian had not indexed yet when we looked. */
	private pending = new Set<string>();

	constructor(app: App, getSettings: () => Settings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	rebuild(): void {
		this.entries.clear();
		this.pending.clear();
		for (const file of this.app.vault.getMarkdownFiles()) {
			this.update(file);
		}
	}

	update(file: TFile): void {
		this.remove(file.path);
		const settings = this.getSettings();
		if (!inScope(file.path, settings)) return;

		const cache = this.app.metadataCache.getFileCache(file);
		if (cache === null) {
			// The `changed` event will bring us back here once the note is indexed.
			this.pending.add(file.path);
			return;
		}

		const { reminders, unreadable } = extract(
			cache.frontmatter,
			settings.sources,
		);
		if (reminders.length === 0 && unreadable.length === 0) return;
		this.entries.set(file.path, {
			reminders: reminders.map((r) => ({ file, ...r })),
			unreadable: unreadable.map((u) => ({ file, ...u })),
		});
	}

	remove(path: string): void {
		this.entries.delete(path);
		this.pending.delete(path);
	}

	all(): Reminder[] {
		return [...this.entries.values()].flatMap((entry) => entry.reminders);
	}

	unreadable(): Unreadable[] {
		return [...this.entries.values()].flatMap((entry) => entry.unreadable);
	}

	pendingCount(): number {
		return this.pending.size;
	}
}
