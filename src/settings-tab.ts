import {
	AbstractInputSuggest,
	PluginSettingTab,
	Setting,
	debounce,
	type App,
	type TFolder,
} from 'obsidian';
import type PropertyRemindersPlugin from './main.ts';
import { openNote } from './open-note.ts';
import { validateSource, type Source } from './settings.ts';

const KIND_LABELS = {
	single: 'One property (day and time)',
	pair: 'Two properties',
};

const REASON_LABELS = {
	'no-time': 'no time set',
	'bad-format': 'unrecognised format',
};

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private input: HTMLInputElement;

	constructor(app: App, input: HTMLInputElement) {
		super(app, input);
		this.input = input;
	}

	getSuggestions(query: string): TFolder[] {
		const needle = query.toLowerCase();
		return this.app.vault
			.getAllFolders()
			.filter((folder) => folder.path.toLowerCase().includes(needle));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.input.dispatchEvent(new Event('input'));
		this.close();
	}
}

export class PropertyRemindersSettingTab extends PluginSettingTab {
	private plugin: PropertyRemindersPlugin;
	/** What the rows show. Only the valid ones are saved, so a half-typed row costs nothing. */
	private drafts: Source[] = [];
	private messageEls: HTMLElement[] = [];
	private statusEl: HTMLElement | null = null;
	// Typing a property name should not rescan the vault on every key.
	private saveSourcesSoon = debounce(() => void this.saveSources(), 300, true);

	constructor(app: App, plugin: PropertyRemindersPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.drafts = this.plugin.settings.sources.map((source) => ({ ...source }));
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Scope')
			.setDesc('Which notes are watched for reminders.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('vault', 'Whole vault')
					.addOption('folders', 'Specific folders')
					.setValue(settings.scope)
					.onChange(async (value) => {
						settings.scope = value === 'folders' ? 'folders' : 'vault';
						await this.plugin.saveSettings();
						this.render();
					}),
			);

		if (settings.scope === 'folders') this.renderFolders(containerEl);

		new Setting(containerEl).setName('Reminder properties').setHeading();
		this.messageEls = [];
		this.drafts.forEach((_, index) => this.renderSource(containerEl, index));
		if (this.drafts.length === 0) {
			containerEl.createEl('p', {
				text: 'No properties set. No reminders will fire.',
				cls: 'setting-item-description',
			});
		}
		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Add property').onClick(() => {
				this.drafts.push({ kind: 'single', property: '' });
				this.render();
			}),
		);
		this.showMessages();

		new Setting(containerEl).setName('Status').setHeading();
		this.statusEl = containerEl.createDiv();
		this.renderStatus();

		new Setting(containerEl)
			.setName('Send test notification')
			.setDesc(
				'If nothing appears, allow notifications for Obsidian in your system settings.',
			)
			.addButton((button) =>
				button
					.setButtonText('Send')
					.onClick(() => this.plugin.notifier.sendTest()),
			);
	}

	private renderFolders(containerEl: HTMLElement): void {
		const { settings } = this.plugin;
		let typed = '';

		const addSetting = new Setting(containerEl)
			.setName('Add folder')
			.setDesc('Notes in its subfolders are watched too.');
		const add = async () => {
			const path = typed.trim().replace(/^\/+|\/+$/g, '') || '/';
			if (typed.trim() === '') return;
			if (!this.app.vault.getFolderByPath(path)) {
				addSetting.setDesc('Folder not found.');
				return;
			}
			if (settings.folders.includes(path)) {
				addSetting.setDesc('This folder is already in the list.');
				return;
			}
			settings.folders.push(path);
			await this.plugin.saveSettings();
			this.render();
		};
		addSetting
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl);
				search.setPlaceholder('Folder path').onChange((value) => {
					typed = value;
				});
			})
			.addButton((button) => button.setButtonText('Add').onClick(add));

		for (const folder of settings.folders) {
			const missing = !this.app.vault.getFolderByPath(folder);
			new Setting(containerEl)
				.setName(missing ? `${folder} (missing)` : folder)
				.addButton((button) =>
					button
						.setIcon('x')
						// The tooltip is also the button's label for screen readers.
						.setTooltip(`Remove ${folder}`)
						.onClick(async () => {
							settings.folders = settings.folders.filter(
								(f) => f !== folder,
							);
							await this.plugin.saveSettings();
							this.render();
						}),
				);
		}
		if (settings.folders.length === 0) {
			containerEl.createEl('p', {
				text: 'No folders chosen. No reminders will fire.',
				cls: 'setting-item-description',
			});
		}
	}

	private renderSource(containerEl: HTMLElement, index: number): void {
		const draft = this.drafts[index];
		if (!draft) return;
		const setting = new Setting(containerEl);

		setting.addDropdown((dropdown) =>
			dropdown
				.addOption('single', KIND_LABELS.single)
				.addOption('pair', KIND_LABELS.pair)
				.setValue(draft.kind)
				.onChange((value) => {
					// Carry the name over, so switching kind does not throw away what was typed.
					const name =
						draft.kind === 'single' ? draft.property : draft.dayProperty;
					this.drafts[index] =
						value === 'pair'
							? { kind: 'pair', dayProperty: name, timeProperty: '' }
							: { kind: 'single', property: name };
					void this.saveSources();
					this.render();
				}),
		);

		const field = (
			placeholder: string,
			value: string,
			set: (value: string) => void,
		) =>
			setting.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(value)
					.onChange((typed) => {
						set(typed);
						this.showMessages();
						this.saveSourcesSoon();
					}),
			);
		if (draft.kind === 'single') {
			field('Property name', draft.property, (v) => (draft.property = v));
		} else {
			field('Day property', draft.dayProperty, (v) => (draft.dayProperty = v));
			field('Time property', draft.timeProperty, (v) => (draft.timeProperty = v));
		}

		setting.addButton((button) =>
			button
				.setIcon('x')
				.setTooltip('Remove property')
				.onClick(() => {
					this.drafts.splice(index, 1);
					void this.saveSources();
					this.render();
				}),
		);

		this.messageEls[index] = setting.descEl;
	}

	/** Splits the rows into the sources that can be saved and the message for each row that cannot. */
	private checkDrafts(): { valid: Source[]; messages: (string | null)[] } {
		const valid: Source[] = [];
		const messages = this.drafts.map((draft) => {
			const message = validateSource(draft, valid);
			if (message === null) valid.push({ ...draft });
			return message;
		});
		return { valid, messages };
	}

	private showMessages(): void {
		this.checkDrafts().messages.forEach((message, index) => {
			const el = this.messageEls[index];
			if (!el) return;
			el.setText(message ?? '');
			el.toggleClass('mod-warning', message !== null);
		});
	}

	private async saveSources(): Promise<void> {
		this.plugin.settings.sources = this.checkDrafts().valid;
		await this.plugin.saveSettings();
		this.renderStatus();
	}

	private renderStatus(): void {
		const el = this.statusEl;
		if (!el) return;
		el.empty();

		const now = Date.now();
		const scheduled = this.plugin.index
			.all()
			.filter((reminder) => reminder.dueAt > now).length;
		new Setting(el).setName(
			scheduled === 1
				? '1 reminder scheduled'
				: `${scheduled} reminders scheduled`,
		);

		const unreadable = this.plugin.index.unreadable();
		if (unreadable.length === 0) return;
		const setting = new Setting(el).setName(
			unreadable.length === 1
				? '1 note has a value that cannot be read'
				: `${unreadable.length} notes have a value that cannot be read`,
		);
		const list = setting.descEl.createEl('ul');
		for (const item of unreadable) {
			const link = list.createEl('li').createEl('a', {
				text: `${item.file.basename} (${REASON_LABELS[item.reason]})`,
				href: '#',
			});
			link.addEventListener('click', (event) => {
				event.preventDefault();
				void openNote(this.app, item.file);
			});
		}
	}
}
