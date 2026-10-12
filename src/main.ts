import { Plugin, TFile, TFolder, type TAbstractFile } from 'obsidian';
import { Notifier } from './notify.ts';
import { ReminderIndex } from './reminder-index.ts';
import { Scheduler } from './scheduler.ts';
import { PropertyRemindersSettingTab } from './settings-tab.ts';
import { readSettings, type Settings } from './settings.ts';

export default class PropertyRemindersPlugin extends Plugin {
	settings!: Settings;
	index!: ReminderIndex;
	notifier!: Notifier;

	async onload() {
		this.settings = readSettings(await this.loadData());
		this.index = new ReminderIndex(this.app, () => this.settings);
		this.notifier = new Notifier(this.app);
		const scheduler = new Scheduler(this, this.index, this.notifier);
		this.addSettingTab(new PropertyRemindersSettingTab(this.app, this));

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => this.index.update(file)),
		);
		this.registerEvent(
			this.app.metadataCache.on('deleted', (file) =>
				this.index.remove(file.path),
			),
		);
		// `changed` does not fire on rename, so a moved note is re-read here.
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.onRename(file, oldPath);
			}),
		);

		// The scan waits for the workspace, so it adds nothing to Obsidian's startup.
		this.app.workspace.onLayoutReady(() => {
			this.index.rebuild();
			scheduler.start();
		});
	}

	onunload() {
		this.notifier.closeAll();
	}

	/** A sync tool rewrote `data.json` while Obsidian was running. */
	async onExternalSettingsChange() {
		this.settings = readSettings(await this.loadData());
		this.index.rebuild();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.index.rebuild();
	}

	private async onRename(file: TAbstractFile, oldPath: string) {
		if (file instanceof TFile) {
			this.index.remove(oldPath);
			this.index.update(file);
			return;
		}
		if (!(file instanceof TFolder)) return;

		// Keep the folder list pointing at a chosen folder that was renamed or moved.
		const folders = this.settings.folders.map((folder) => {
			if (folder === oldPath) return file.path;
			if (folder.startsWith(`${oldPath}/`)) {
				return file.path + folder.slice(oldPath.length);
			}
			return folder;
		});
		if (folders.join('\n') === this.settings.folders.join('\n')) return;
		this.settings.folders = folders;
		await this.saveSettings();
	}
}
