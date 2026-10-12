import { Notice, type App, type TFile } from 'obsidian';
import { MissedModal } from './missed-modal.ts';
import { openNote } from './open-note.ts';

export interface DueItem {
	file: TFile;
	dueAt: number;
}

const TIME = new Intl.DateTimeFormat(undefined, {
	hour: 'numeric',
	minute: '2-digit',
});
const DAY_AND_TIME = new Intl.DateTimeFormat(undefined, {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	hour: 'numeric',
	minute: '2-digit',
});

export function formatDue(dueAt: number, late: boolean): string {
	return late
		? `Missed · ${DAY_AND_TIME.format(dueAt)}`
		: `Reminder · ${TIME.format(dueAt)}`;
}

/** Shows reminders to the user. For now always as an in-app notice. */
export class Notifier {
	private app: App;
	private notices = new Set<Notice>();

	constructor(app: App) {
		this.app = app;
	}

	notify(item: DueItem, late: boolean): void {
		this.showNotice(item.file.basename, formatDue(item.dueAt, late), () => {
			void openNote(this.app, item.file);
		});
	}

	notifySummary(items: DueItem[]): void {
		this.showNotice(
			`${items.length} missed reminders`,
			'Click to see the list',
			() => new MissedModal(this.app, items).open(),
		);
	}

	/** Closes everything still on screen, so nothing can call into an unloaded plugin. */
	closeAll(): void {
		for (const notice of this.notices) notice.hide();
		this.notices.clear();
	}

	private showNotice(title: string, body: string, onClick: () => void): void {
		const message = createFragment((fragment) => {
			// The note name goes in as text and is never parsed as HTML.
			fragment.createEl('strong', { text: title });
			fragment.createDiv({ text: body });
		});
		// Duration 0 keeps the notice on screen until it is clicked.
		const notice = new Notice(message, 0);
		this.notices.add(notice);
		notice.containerEl.addEventListener('click', () => {
			this.notices.delete(notice);
			onClick();
		});
	}
}
