import { Plugin } from 'obsidian';
import { readSettings, type Settings } from './settings.ts';

export default class PropertyRemindersPlugin extends Plugin {
	settings!: Settings;

	async onload() {
		this.settings = readSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
