import type { Plugin } from 'obsidian';
import { selectDue } from './due.ts';
import type { Notifier } from './notify.ts';
import type { ReminderIndex } from './reminder-index.ts';

const TICK_MS = 5000;
/** How long the first tick waits for Obsidian to index every in-scope note. */
const GATE_LIMIT_MS = 60 * 1000;
const LAST_CHECK_KEY = 'property-reminders:last-check';

/**
 * Compares the index with the wall clock every few seconds. The last-check
 * timestamp is the plugin's only memory of what has fired, and it lives in
 * local storage so that each device tracks its own missed reminders.
 */
export class Scheduler {
	private plugin: Plugin;
	private index: ReminderIndex;
	private notifier: Notifier;
	private lastCheck = 0;
	private startedAt = 0;
	private gateOpen = false;
	private zoneOffset = new Date().getTimezoneOffset();

	constructor(plugin: Plugin, index: ReminderIndex, notifier: Notifier) {
		this.plugin = plugin;
		this.index = index;
		this.notifier = notifier;
	}

	start(): void {
		const now = Date.now();
		this.startedAt = now;
		const stored: unknown = this.plugin.app.loadLocalStorage(LAST_CHECK_KEY);
		if (typeof stored === 'number' && Number.isFinite(stored)) {
			this.lastCheck = stored;
		} else {
			// First run on this device: nothing dated before now may fire.
			this.setLastCheck(now);
		}
		this.plugin.registerInterval(
			window.setInterval(() => this.tick(), TICK_MS),
		);
		this.tick();
	}

	tick(now = Date.now()): void {
		try {
			this.run(now);
		} catch (error) {
			console.error('[property-reminders] tick failed', error);
		}
	}

	private run(now: number): void {
		// Until every note is indexed, a missed reminder could still be hiding in one of
		// them. Moving last-check now would skip it for good.
		if (!this.gateOpen) {
			const waiting =
				this.index.pendingCount() > 0 &&
				now - this.startedAt < GATE_LIMIT_MS;
			if (waiting) return;
			this.gateOpen = true;
		}

		// Due times are worked out in local time, so a new time zone makes them stale.
		const zoneOffset = new Date(now).getTimezoneOffset();
		if (zoneOffset !== this.zoneOffset) {
			this.zoneOffset = zoneOffset;
			this.index.rebuild();
		}

		// The clock was set backwards. Start again from here and fire nothing.
		if (now < this.lastCheck) {
			this.setLastCheck(now);
			return;
		}

		const due = selectDue(this.index.all(), this.lastCheck, now);
		// Saved before notifying, so a failure below cannot fire the same reminder every tick.
		this.setLastCheck(now);

		for (const reminder of due.onTime) this.notifier.notify(reminder, false);
		for (const reminder of due.late) this.notifier.notify(reminder, true);
		if (due.summary.length > 0) this.notifier.notifySummary(due.summary);
	}

	private setLastCheck(value: number): void {
		this.lastCheck = value;
		this.plugin.app.saveLocalStorage(LAST_CHECK_KEY, value);
	}
}
