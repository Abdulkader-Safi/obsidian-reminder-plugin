import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extract, parsePair, parseSingle } from '../src/parse.ts';
import type { Source } from '../src/settings.ts';

const local = (y: number, mo: number, d: number, h: number, mi: number) =>
	new Date(y, mo - 1, d, h, mi).getTime();
const oct14 = local(2026, 10, 14, 9, 30);

test('parseSingle reads the formats Obsidian writes', () => {
	assert.deepEqual(parseSingle('2026-10-14T09:30'), { dueAt: oct14 });
	assert.deepEqual(parseSingle('2026-10-14T09:30:00'), { dueAt: oct14 });
	assert.deepEqual(parseSingle('  2026-10-14T09:30  '), { dueAt: oct14 });
});

test('parseSingle accepts a space for the T', () => {
	assert.deepEqual(parseSingle('2026-10-14 09:30'), { dueAt: oct14 });
});

test('parseSingle drops seconds', () => {
	assert.deepEqual(parseSingle('2026-10-14T09:30:45'), { dueAt: oct14 });
});

test('parseSingle reads an offset as an instant', () => {
	assert.deepEqual(parseSingle('2026-10-14T09:30:00Z'), {
		dueAt: Date.UTC(2026, 9, 14, 9, 30),
	});
	assert.deepEqual(parseSingle('2026-10-14T09:30+03:00'), {
		dueAt: Date.UTC(2026, 9, 14, 6, 30),
	});
});

test('parseSingle: a day with no time never becomes a reminder', () => {
	assert.deepEqual(parseSingle('2026-10-14'), { reason: 'no-time' });
});

test('parseSingle: no value is not an error', () => {
	assert.equal(parseSingle(null), null);
	assert.equal(parseSingle(undefined), null);
	assert.equal(parseSingle('   '), null);
});

test('parseSingle rejects what it cannot read', () => {
	for (const value of [
		'tomorrow 9am',
		'2026-13-14T09:30',
		'2026-02-31T09:30',
		'2026-10-14T25:00',
		'2026-10-14T09:60',
		'14/10/2026 09:30',
		20261014,
		true,
		['2026-10-14T09:30'],
	]) {
		assert.deepEqual(parseSingle(value), { reason: 'bad-format' }, String(value));
	}
});

test('parsePair reads a day and a 24-hour time', () => {
	assert.deepEqual(parsePair('2026-10-14', '09:30'), { dueAt: oct14 });
	assert.deepEqual(parsePair('2026-10-14', '9:30'), { dueAt: oct14 });
	assert.deepEqual(parsePair('2026-10-14', '09:30:15'), { dueAt: oct14 });
	assert.deepEqual(parsePair('2026-10-14', '14:30'), {
		dueAt: local(2026, 10, 14, 14, 30),
	});
});

test('parsePair reads a 12-hour time', () => {
	assert.deepEqual(parsePair('2026-10-14', '9:30 AM'), { dueAt: oct14 });
	assert.deepEqual(parsePair('2026-10-14', '9:30pm'), {
		dueAt: local(2026, 10, 14, 21, 30),
	});
	assert.deepEqual(parsePair('2026-10-14', '12:00 AM'), {
		dueAt: local(2026, 10, 14, 0, 0),
	});
	assert.deepEqual(parsePair('2026-10-14', '12:00 PM'), {
		dueAt: local(2026, 10, 14, 12, 0),
	});
});

test('parsePair: a day with no time is unreadable, a time with no day is ignored', () => {
	assert.deepEqual(parsePair('2026-10-14', null), { reason: 'no-time' });
	assert.deepEqual(parsePair('2026-10-14', ''), { reason: 'no-time' });
	assert.equal(parsePair(null, '09:30'), null);
	assert.equal(parsePair(undefined, undefined), null);
});

test('parsePair rejects what it cannot read', () => {
	assert.deepEqual(parsePair('2026-10-14', '25:00'), { reason: 'bad-format' });
	assert.deepEqual(parsePair('2026-10-14', '13:00 PM'), { reason: 'bad-format' });
	assert.deepEqual(parsePair('2026-10-14', 'noon'), { reason: 'bad-format' });
	assert.deepEqual(parsePair('2026-10-14', 570), { reason: 'bad-format' });
	assert.deepEqual(parsePair('14 Oct', '09:30'), { reason: 'bad-format' });
	assert.deepEqual(parsePair('2026-10-14T00:00', '09:30'), { reason: 'bad-format' });
});

const sources: Source[] = [
	{ kind: 'single', property: 'reminder' },
	{ kind: 'single', property: 'due' },
	{ kind: 'pair', dayProperty: 'date', timeProperty: 'startTime' },
];

test('extract matches property names without regard to case', () => {
	const { reminders } = extract({ Reminder: '2026-10-14T09:30' }, sources);
	assert.deepEqual(reminders, [{ sourceKey: 'single:reminder', dueAt: oct14 }]);
});

test('extract treats each source on its own', () => {
	const { reminders, unreadable } = extract(
		{
			reminder: '2026-10-14T09:30',
			due: '2026-10-15',
			date: '2026-10-14',
			starttime: '14:30',
		},
		sources,
	);
	assert.deepEqual(reminders, [
		{ sourceKey: 'single:reminder', dueAt: oct14 },
		{ sourceKey: 'pair:date+starttime', dueAt: local(2026, 10, 14, 14, 30) },
	]);
	assert.deepEqual(unreadable, [{ sourceKey: 'single:due', reason: 'no-time' }]);
});

test('extract copes with a note that has no properties', () => {
	assert.deepEqual(extract(undefined, sources), { reminders: [], unreadable: [] });
	assert.deepEqual(extract({ title: 'x' }, sources), { reminders: [], unreadable: [] });
});
