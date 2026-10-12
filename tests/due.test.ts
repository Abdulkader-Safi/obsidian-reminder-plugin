import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectDue } from '../src/due.ts';

const MIN = 60_000;
const now = new Date(2026, 9, 14, 10, 0).getTime();
const at = (path: string, minutesAgo: number) => ({
	file: { path },
	dueAt: now - minutesAgo * MIN,
});
const paths = (items: { file: { path: string } }[]) => items.map((i) => i.file.path);

test('fires what came due since the last check', () => {
	const result = selectDue([at('a.md', 0), at('b.md', 1)], now - 2 * MIN, now);
	assert.deepEqual(paths(result.onTime), ['b.md', 'a.md']);
	assert.deepEqual(result.late, []);
	assert.deepEqual(result.summary, []);
});

test('skips the future and what was already handled', () => {
	const result = selectDue(
		[at('future.md', -1), at('handled.md', 10)],
		now - 5 * MIN,
		now,
	);
	assert.deepEqual(result, { onTime: [], late: [], summary: [] });
});

test('a reminder exactly at the last check has been handled', () => {
	const lastCheck = now - MIN;
	const result = selectDue([at('edge.md', 1)], lastCheck, now);
	assert.deepEqual(result.onTime, []);
});

test('a reminder exactly at now fires', () => {
	assert.deepEqual(paths(selectDue([at('a.md', 0)], now - MIN, now).onTime), ['a.md']);
});

test('more than five minutes old is late', () => {
	const result = selectDue([at('five.md', 5), at('six.md', 6)], now - 60 * MIN, now);
	assert.deepEqual(paths(result.onTime), ['five.md']);
	assert.deepEqual(paths(result.late), ['six.md']);
});

test('five late reminders fire one by one, six become a summary', () => {
	const five = [10, 20, 30, 40, 50].map((m) => at(`${m}.md`, m));
	assert.equal(selectDue(five, now - 600 * MIN, now).late.length, 5);

	const six = [...five, at('60.md', 60), at('fresh.md', 1)];
	const result = selectDue(six, now - 600 * MIN, now);
	assert.deepEqual(result.late, []);
	assert.deepEqual(paths(result.summary), [
		'60.md',
		'50.md',
		'40.md',
		'30.md',
		'20.md',
		'10.md',
	]);
	assert.deepEqual(paths(result.onTime), ['fresh.md']);
});

test('two sources on one note in the same minute fire once', () => {
	const result = selectDue(
		[at('a.md', 1), at('a.md', 1), at('b.md', 1), at('a.md', 2)],
		now - 10 * MIN,
		now,
	);
	assert.deepEqual(paths(result.onTime), ['a.md', 'a.md', 'b.md']);
});

test('an empty list gives nothing', () => {
	assert.deepEqual(selectDue([], 0, now), { onTime: [], late: [], summary: [] });
});
