import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	DEFAULT_SETTINGS,
	readSettings,
	validateSource,
	type Source,
} from '../src/settings.ts';

const existing: Source[] = [{ kind: 'single', property: 'reminder' }];

test('validateSource accepts a new single or pair source', () => {
	assert.equal(validateSource({ kind: 'single', property: 'due' }, existing), null);
	assert.equal(
		validateSource(
			{ kind: 'pair', dayProperty: 'date', timeProperty: 'startTime' },
			existing,
		),
		null,
	);
});

test('validateSource rejects an empty name', () => {
	assert.equal(
		validateSource({ kind: 'single', property: '  ' }, existing),
		'Enter a property name.',
	);
	assert.equal(
		validateSource({ kind: 'pair', dayProperty: 'date', timeProperty: '' }, existing),
		'Enter a property name.',
	);
});

test('validateSource rejects a duplicate, whatever its case', () => {
	assert.equal(
		validateSource({ kind: 'single', property: 'Reminder' }, existing),
		'This property is already in the list.',
	);
});

test('validateSource rejects a pair that uses one name twice', () => {
	assert.equal(
		validateSource({ kind: 'pair', dayProperty: 'date', timeProperty: 'Date' }, existing),
		'The day and the time need different properties.',
	);
});

test('readSettings gives the defaults for nothing or rubbish', () => {
	assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings('nope'), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings([]), DEFAULT_SETTINGS);
});

test('readSettings does not hand out the default arrays', () => {
	readSettings(null).sources.push({ kind: 'single', property: 'x' });
	readSettings(null).folders.push('x');
	assert.equal(DEFAULT_SETTINGS.sources.length, 1);
	assert.equal(DEFAULT_SETTINGS.folders.length, 0);
});

test('readSettings repairs a damaged file', () => {
	const settings = readSettings({
		scope: 'everything',
		folders: ['Projects/', 'Projects', 7, '', 'Calendar'],
		sources: [
			{ kind: 'single', property: ' due ' },
			{ kind: 'single', property: 'DUE' },
			{ kind: 'single' },
			{ kind: 'pair', dayProperty: 'date', timeProperty: 'date' },
			{ kind: 'pair', dayProperty: 'date', timeProperty: 'startTime' },
			'reminder',
		],
	});
	assert.deepEqual(settings, {
		version: 1,
		scope: 'vault',
		folders: ['Projects', 'Calendar'],
		sources: [
			{ kind: 'single', property: 'due' },
			{ kind: 'pair', dayProperty: 'date', timeProperty: 'startTime' },
		],
	});
});

test('readSettings keeps an empty source list', () => {
	assert.deepEqual(readSettings({ scope: 'folders', sources: [] }).sources, []);
});
