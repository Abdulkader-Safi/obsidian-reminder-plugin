import { Notice, Platform, type App, type TFile } from 'obsidian';
import { MissedModal } from './missed-modal.ts';
import { openNote } from './open-note.ts';

export interface DueItem {
	file: TFile;
	dueAt: number;
}

// The part of Electron this plugin uses. Obsidian exposes it through `remote`, which
// is an internal with no API guarantee, so every use is typed here and checked at run time.
interface ElectronNotification {
	on(event: 'click' | 'close' | 'failed', listener: () => void): void;
	show(): void;
	close(): void;
}

interface ElectronRemote {
	Notification: {
		new (options: { title: string; body: string }): ElectronNotification;
		isSupported(): boolean;
	};
	getCurrentWindow(): {
		isMinimized(): boolean;
		restore(): void;
		show(): void;
		focus(): void;
	};
}

/** Null on mobile, where Obsidian runs without Electron, and if Obsidian ever drops `remote`. */
function getRemote(): ElectronRemote | null {
	if (!Platform.isDesktopApp) return null;
	try {
		const load = (window as { require?: (id: string) => unknown }).require;
		const electron = load?.('electron') as
			| { remote?: ElectronRemote }
			| undefined;
		return electron?.remote ?? null;
	} catch {
		return null;
	}
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

/** Shows reminders: a system notification on desktop, an in-app notice on mobile or as the fallback. */
export class Notifier {
	private app: App;
	private notices = new Set<Notice>();
	// Electron drops a notification's click handler once nothing references it.
	private system = new Set<ElectronNotification>();
	private explainedFallback = false;

	constructor(app: App) {
		this.app = app;
	}

	notify(item: DueItem, late: boolean): void {
		// The note name is passed through unchanged, whatever its script.
		this.show(item.file.basename, formatDue(item.dueAt, late), () => {
			void openNote(this.app, item.file);
		});
	}

	notifySummary(items: DueItem[]): void {
		this.show(
			`${items.length} missed reminders`,
			'Click to see the list',
			() => new MissedModal(this.app, items).open(),
		);
	}

	sendTest(): void {
		this.show(
			'Test notification',
			'Reminders from your notes will look like this.',
			() => {},
		);
	}

	/** Closes everything still on screen, so nothing can call into an unloaded plugin. */
	closeAll(): void {
		for (const notice of this.notices) notice.hide();
		this.notices.clear();
		for (const notification of this.system) notification.close();
		this.system.clear();
	}

	private show(title: string, body: string, onClick: () => void): void {
		const remote = getRemote();
		if (remote && this.showSystem(remote, title, body, onClick)) return;

		this.showNotice(title, body, onClick);
		// Mobile never has system notifications, so only desktop gets the explanation.
		if (Platform.isDesktopApp && !this.explainedFallback) {
			this.explainedFallback = true;
			new Notice(
				'System notifications are unavailable. Showing reminders inside Obsidian instead.',
			);
		}
	}

	/**
	 * Returns false when the notification could not be created. A notification
	 * blocked in the operating system's settings cannot be detected: it reports
	 * success and shows nothing.
	 */
	private showSystem(
		remote: ElectronRemote,
		title: string,
		body: string,
		onClick: () => void,
	): boolean {
		try {
			if (!remote.Notification.isSupported()) return false;
			const notification = new remote.Notification({ title, body });
			this.system.add(notification);
			notification.on('click', () => {
				this.system.delete(notification);
				const win = remote.getCurrentWindow();
				if (win.isMinimized()) win.restore();
				win.show();
				win.focus();
				onClick();
			});
			notification.on('close', () => this.system.delete(notification));
			notification.on('failed', () => {
				this.system.delete(notification);
				this.showNotice(title, body, onClick);
			});
			notification.show();
			return true;
		} catch (error) {
			console.error('[property-reminders] system notification failed', error);
			return false;
		}
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
