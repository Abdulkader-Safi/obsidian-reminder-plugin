import { SuggestModal, type App } from 'obsidian';
import { formatDue, type DueItem } from './notify.ts';
import { openNote } from './open-note.ts';

/** The list behind the "N missed reminders" summary, oldest first. */
export class MissedModal extends SuggestModal<DueItem> {
	private items: DueItem[];

	constructor(app: App, items: DueItem[]) {
		super(app);
		this.items = items;
		this.setPlaceholder('Missed reminders');
	}

	getSuggestions(query: string): DueItem[] {
		const needle = query.trim().toLowerCase();
		return this.items.filter((item) =>
			item.file.basename.toLowerCase().includes(needle),
		);
	}

	renderSuggestion(item: DueItem, el: HTMLElement): void {
		el.createDiv({ text: item.file.basename });
		el.createEl('small', { text: formatDue(item.dueAt, true) });
	}

	onChooseSuggestion(item: DueItem): void {
		void openNote(this.app, item.file);
	}
}
