// Reads reminder values out of a note's properties. No Obsidian imports, so this file runs under `node --test`.

import { sourceKey, type Source } from './settings.ts';

export type UnreadableReason = 'no-time' | 'bad-format';

/** A due time, a reason the value cannot be read, or null when there is no value at all. */
export type Parsed = { dueAt: number } | { reason: UnreadableReason } | null;

export interface ParsedReminder {
	sourceKey: string;
	dueAt: number;
}

export interface ParsedUnreadable {
	sourceKey: string;
	reason: UnreadableReason;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
const TIME = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i;

const BAD_FORMAT: Parsed = { reason: 'bad-format' };
const NO_TIME: Parsed = { reason: 'no-time' };

function isEmpty(value: unknown): boolean {
	return (
		value === null ||
		value === undefined ||
		(typeof value === 'string' && value.trim() === '')
	);
}

/** Epoch ms for a local day and time, or null when the day or the time does not exist. */
function localMinute(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
): number | null {
	if (hour > 23 || minute > 59) return null;
	const date = new Date(year, month - 1, day, hour, minute);
	// `new Date` rolls 31 February over into March instead of failing.
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date.getTime();
}

/** One property holding a day and a time, such as `2026-10-14T09:30`. Seconds are dropped. */
export function parseSingle(value: unknown): Parsed {
	if (isEmpty(value)) return null;
	if (typeof value !== 'string') return BAD_FORMAT;
	const text = value.trim();
	if (DATE.test(text)) return NO_TIME;

	const match = DATE_TIME.exec(text);
	if (!match) return BAD_FORMAT;
	const [, year, month, day, hour, minute, offset] = match;

	const local = localMinute(
		Number(year),
		Number(month),
		Number(day),
		Number(hour),
		Number(minute),
	);
	if (local === null) return BAD_FORMAT;
	if (!offset) return { dueAt: local };

	// A value with an explicit offset names an instant, not a local time.
	const instant = Date.parse(
		`${year}-${month}-${day}T${hour}:${minute}:00${offset}`,
	);
	return Number.isNaN(instant) ? BAD_FORMAT : { dueAt: instant };
}

/** Two properties: a day (`2026-10-14`) and a time (`09:30`, `9:30` or `9:30 AM`). */
export function parsePair(day: unknown, time: unknown): Parsed {
	// A time with no day is not a mistake: calendar plugins write it on recurring events.
	if (isEmpty(day)) return null;
	if (typeof day !== 'string') return BAD_FORMAT;
	const dayMatch = DATE.exec(day.trim());
	if (!dayMatch) return BAD_FORMAT;

	if (isEmpty(time)) return NO_TIME;
	if (typeof time !== 'string') return BAD_FORMAT;
	const timeMatch = TIME.exec(time.trim());
	if (!timeMatch) return BAD_FORMAT;

	let hour = Number(timeMatch[1]);
	const meridiem = timeMatch[3]?.toUpperCase();
	if (meridiem) {
		if (hour < 1 || hour > 12) return BAD_FORMAT;
		hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
	}

	const local = localMinute(
		Number(dayMatch[1]),
		Number(dayMatch[2]),
		Number(dayMatch[3]),
		hour,
		Number(timeMatch[2]),
	);
	return local === null ? BAD_FORMAT : { dueAt: local };
}

/** Runs every source over one note's properties. Property names match without regard to case. */
export function extract(
	frontmatter: Record<string, unknown> | null | undefined,
	sources: Source[],
): { reminders: ParsedReminder[]; unreadable: ParsedUnreadable[] } {
	const reminders: ParsedReminder[] = [];
	const unreadable: ParsedUnreadable[] = [];
	if (!frontmatter) return { reminders, unreadable };

	const values = new Map<string, unknown>();
	for (const [name, value] of Object.entries(frontmatter)) {
		values.set(name.toLowerCase(), value);
	}
	const get = (name: string) => values.get(name.trim().toLowerCase());

	for (const source of sources) {
		const parsed =
			source.kind === 'single'
				? parseSingle(get(source.property))
				: parsePair(get(source.dayProperty), get(source.timeProperty));
		if (parsed === null) continue;
		const key = sourceKey(source);
		if ('dueAt' in parsed) {
			reminders.push({ sourceKey: key, dueAt: parsed.dueAt });
		} else {
			unreadable.push({ sourceKey: key, reason: parsed.reason });
		}
	}
	return { reminders, unreadable };
}
