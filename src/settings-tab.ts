import {
	AbstractInputSuggest,
	PluginSettingTab,
	Setting,
	debounce,
	requireApiVersion,
	type App,
	type SettingDefinitionItem,
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

/** One settings row. `fill` adds its controls. It must not return the `Setting`, which has a `then` method. */
interface Row {
	name: string;
	desc?: string;
	fill?: (setting: Setting) => void;
}

interface Section {
	heading?: string;
	visible?: boolean;
	rows: Row[];
}

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
	private drafts: Source[];
	private messageEls: HTMLElement[] = [];
	private statusSetting: Setting | null = null;
	// Typing a property name should not rescan the vault on every key.
	private saveSourcesSoon = debounce(() => void this.saveSources(), 300, true);

	constructor(app: App, plugin: PropertyRemindersPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.drafts = plugin.settings.sources.map((source) => ({ ...source }));
	}

	/**
	 * Obsidian 1.13.0 and later render the tab from these definitions, which also
	 * puts the settings in its settings search.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.sections().flatMap((section): SettingDefinitionItem[] => {
			const items = section.rows.map((row) => ({
				name: row.name,
				desc: row.desc,
				render: (setting: Setting) => this.fillRow(setting, row),
			}));
			if (section.heading === undefined) return items;
			return [
				{
					type: 'group',
					heading: section.heading,
					visible: section.visible,
					items,
				},
			];
		});
	}

	/** Older versions never call `getSettingDefinitions`, so the same rows are drawn by hand. */
	display(): void {
		this.drawByHand();
	}

	private drawByHand(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const section of this.sections()) {
			if (section.visible === false) continue;
			if (section.heading !== undefined) {
				new Setting(containerEl).setName(section.heading).setHeading();
			}
			for (const row of section.rows) {
				this.fillRow(new Setting(containerEl), row);
			}
		}
	}

	/**
	 * Settings changed somewhere other than this tab (a sync tool, a renamed folder).
	 * Obsidian keeps the definitions it was last given, so they have to be handed over again.
	 */
	refresh(): void {
		this.drafts = this.plugin.settings.sources.map((source) => ({ ...source }));
		if (requireApiVersion('1.13.0')) this.update();
	}

	/** Redraws after rows were added or removed. */
	private redraw(): void {
		if (requireApiVersion('1.13.0')) {
			this.update();
		} else {
			this.drawByHand();
		}
	}

	private fillRow(setting: Setting, row: Row): void {
		setting.setName(row.name);
		if (row.desc !== undefined) setting.setDesc(row.desc);
		row.fill?.(setting);
	}

	private sections(): Section[] {
		this.messageEls = [];
		return [
			{ rows: [this.scopeRow()] },
			{
				heading: 'Folders',
				visible: this.plugin.settings.scope === 'folders',
				rows: this.folderRows(),
			},
			{ heading: 'Reminder properties', rows: this.sourceRows() },
			{ heading: 'Status', rows: [this.statusRow(), this.testRow()] },
		];
	}

	private scopeRow(): Row {
		const { settings } = this.plugin;
		return {
			name: 'Scope',
			desc: 'Which notes are watched for reminders.',
			fill: (setting) => {
				setting.addDropdown((dropdown) =>
					dropdown
						.addOption('vault', 'Whole vault')
						.addOption('folders', 'Specific folders')
						.setValue(settings.scope)
						.onChange(async (value) => {
							settings.scope = value === 'folders' ? 'folders' : 'vault';
							await this.plugin.saveSettings();
							this.redraw();
						}),
				);
			},
		};
	}

	private folderRows(): Row[] {
		const { settings } = this.plugin;
		let typed = '';

		const addRow: Row = {
			name: 'Add folder',
			desc: 'Notes in its subfolders are watched too.',
			fill: (setting) => {
				const add = async () => {
					if (typed.trim() === '') return;
					const path = typed.trim().replace(/^\/+|\/+$/g, '') || '/';
					if (!this.app.vault.getFolderByPath(path)) {
						setting.setDesc('Folder not found.');
						return;
					}
					if (settings.folders.includes(path)) {
						setting.setDesc('This folder is already in the list.');
						return;
					}
					settings.folders.push(path);
					await this.plugin.saveSettings();
					this.redraw();
				};
				setting
					.addSearch((search) => {
						new FolderSuggest(this.app, search.inputEl);
						search.setPlaceholder('Folder path').onChange((value) => {
							typed = value;
						});
					})
					.addButton((button) => button.setButtonText('Add').onClick(add));
			},
		};

		const rows = settings.folders.map((folder): Row => {
			const missing = !this.app.vault.getFolderByPath(folder);
			return {
				name: missing ? `${folder} (missing)` : folder,
				fill: (setting) => {
					setting.addButton((button) =>
						button
							.setIcon('x')
							// The tooltip is also the button's label for screen readers.
							.setTooltip(`Remove ${folder}`)
							.onClick(async () => {
								settings.folders = settings.folders.filter(
									(f) => f !== folder,
								);
								await this.plugin.saveSettings();
								this.redraw();
							}),
					);
				},
			};
		});

		if (rows.length === 0) {
			rows.push({ name: 'No folders chosen. No reminders will fire.' });
		}
		return [addRow, ...rows];
	}

	private sourceRows(): Row[] {
		const rows = this.drafts.map((draft, index) =>
			this.sourceRow(draft, index),
		);
		if (rows.length === 0) {
			rows.push({ name: 'No properties set. No reminders will fire.' });
		}
		rows.push({
			name: 'Add a property',
			desc: 'Watch one more property, or a pair of them, for reminders.',
			fill: (setting) => {
				setting.addButton((button) =>
					button.setButtonText('Add').onClick(() => {
						this.drafts.push({ kind: 'single', property: '' });
						this.redraw();
					}),
				);
			},
		});
		return rows;
	}

	private sourceRow(draft: Source, index: number): Row {
		return {
			name: `Property ${index + 1}`,
			fill: (setting) => {
				setting.addDropdown((dropdown) =>
					dropdown
						.addOption('single', KIND_LABELS.single)
						.addOption('pair', KIND_LABELS.pair)
						.setValue(draft.kind)
						.onChange((value) => {
							// Carry the name over, so switching kind does not throw away what was typed.
							const name =
								draft.kind === 'single'
									? draft.property
									: draft.dayProperty;
							this.drafts[index] =
								value === 'pair'
									? { kind: 'pair', dayProperty: name, timeProperty: '' }
									: { kind: 'single', property: name };
							void this.saveSources();
							this.redraw();
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
					field(
						'Day property',
						draft.dayProperty,
						(v) => (draft.dayProperty = v),
					);
					field(
						'Time property',
						draft.timeProperty,
						(v) => (draft.timeProperty = v),
					);
				}

				setting.addButton((button) =>
					button
						.setIcon('x')
						.setTooltip(`Remove property ${index + 1}`)
						.onClick(() => {
							this.drafts.splice(index, 1);
							void this.saveSources();
							this.redraw();
						}),
				);

				this.messageEls[index] = setting.descEl;
				this.showMessages();
			},
		};
	}

	private statusRow(): Row {
		return {
			name: 'Reminders scheduled',
			fill: (setting) => {
				this.statusSetting = setting;
				this.renderStatus();
			},
		};
	}

	private testRow(): Row {
		return {
			name: 'Send test notification',
			desc: 'If nothing appears, allow notifications for Obsidian in your system settings.',
			fill: (setting) => {
				setting.addButton((button) =>
					button
						.setButtonText('Send')
						.onClick(() => this.plugin.notifier.sendTest()),
				);
			},
		};
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
		const setting = this.statusSetting;
		if (!setting) return;

		const now = Date.now();
		const scheduled = this.plugin.index
			.all()
			.filter((reminder) => reminder.dueAt > now).length;
		setting.setName(
			scheduled === 1
				? '1 reminder scheduled'
				: `${scheduled} reminders scheduled`,
		);

		const unreadable = this.plugin.index.unreadable();
		setting.descEl.empty();
		if (unreadable.length === 0) return;
		setting.descEl.createDiv({
			text:
				unreadable.length === 1
					? '1 note has a value that cannot be read:'
					: `${unreadable.length} notes have a value that cannot be read:`,
		});
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
