import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inScope } from '../src/scope.ts';

const vault = { scope: 'vault' as const, folders: [] };
const folders = { scope: 'folders' as const, folders: ['Projects', 'Calendar'] };

test('whole vault takes every Markdown note', () => {
	assert.equal(inScope('note.md', vault), true);
	assert.equal(inScope('Archive/deep/old.md', vault), true);
	assert.equal(inScope('Upper.MD', vault), true);
});

test('only Markdown notes are read', () => {
	assert.equal(inScope('board.canvas', vault), false);
	assert.equal(inScope('Projects/list.base', folders), false);
	assert.equal(inScope('Projects/image.png', folders), false);
});

test('a chosen folder includes its subfolders', () => {
	assert.equal(inScope('Projects/Client A/invoice.md', folders), true);
	assert.equal(inScope('Calendar/2026-10-14 call.md', folders), true);
	assert.equal(inScope('Archive/old.md', folders), false);
	assert.equal(inScope('root.md', folders), false);
});

test('a folder name is not a prefix match', () => {
	assert.equal(inScope('Projects-old/a.md', folders), false);
	assert.equal(inScope('Projects.md', folders), false);
});

test('no folders chosen means nothing is watched', () => {
	assert.equal(inScope('note.md', { scope: 'folders', folders: [] }), false);
});

test('the vault root as a chosen folder takes everything', () => {
	assert.equal(inScope('a/b.md', { scope: 'folders', folders: ['/'] }), true);
});
