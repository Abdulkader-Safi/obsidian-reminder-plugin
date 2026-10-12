// Picks what fires on one tick. No Obsidian imports, so this file runs under `node --test`.

/** A reminder fired this long after its time is labelled as missed. */
export const LATE_AFTER_MS = 5 * 60 * 1000;

/** More late reminders than this in one tick become a single summary. */
export const SUMMARY_ABOVE = 5;

export interface Dueable {
	file: { path: string };
	dueAt: number;
}

export interface DueResult<T> {
	onTime: T[];
	late: T[];
	summary: T[];
}

/**
 * The whole firing rule: a reminder fires when it is due after the last check
 * and at or before now. Anything at or before the last check has been handled,
 * so nothing else needs to remember what fired.
 */
export function selectDue<T extends Dueable>(
	reminders: T[],
	lastCheck: number,
	now: number,
): DueResult<T> {
	const seen = new Set<string>();
	const due: T[] = [];
	for (const reminder of reminders) {
		if (reminder.dueAt <= lastCheck || reminder.dueAt > now) continue;
		// Two sources on one note giving the same minute fire once.
		const key = `${reminder.file.path}\n${reminder.dueAt}`;
		if (seen.has(key)) continue;
		seen.add(key);
		due.push(reminder);
	}
	due.sort((a, b) => a.dueAt - b.dueAt);

	const onTime = due.filter((r) => now - r.dueAt <= LATE_AFTER_MS);
	const late = due.filter((r) => now - r.dueAt > LATE_AFTER_MS);
	return late.length > SUMMARY_ABOVE
		? { onTime, late: [], summary: late }
		: { onTime, late, summary: [] };
}
