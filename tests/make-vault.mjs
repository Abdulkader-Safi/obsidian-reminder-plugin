// Writes a large test vault for the performance checks (NFR-01, NFR-04).
// Usage: node tests/make-vault.mjs <empty-target-folder> [notes=10000] [reminders=1000]
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [target, notesArg = '10000', remindersArg = '1000'] = process.argv.slice(2);
const notes = Number(notesArg);
const reminders = Number(remindersArg);

if (!target || !Number.isInteger(notes) || !Number.isInteger(reminders)) {
	console.error('Usage: node tests/make-vault.mjs <empty-target-folder> [notes] [reminders]');
	process.exit(1);
}
// Never write into a folder that already holds something, such as a real vault.
if (existsSync(target) && readdirSync(target).length > 0) {
	console.error(`${target} is not empty. Pick a new folder.`);
	process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const every = Math.max(1, Math.floor(notes / reminders));
const start = Date.now() + 10 * 60 * 1000;
let withReminder = 0;

for (let i = 0; i < notes; i++) {
	const folder = join(target, `Folder ${pad(Math.floor(i / 100))}`);
	mkdirSync(folder, { recursive: true });
	let properties = `title: Note ${i}\nstatus: open`;
	if (i % every === 0 && withReminder < reminders) {
		// Spread over the next 30 days, one every 43 minutes or so.
		const due = new Date(start + withReminder * 43 * 60 * 1000);
		properties += `\nreminder: ${stamp(due)}`;
		withReminder++;
	}
	writeFileSync(
		join(folder, `Note ${i}.md`),
		`---\n${properties}\n---\n\nBody of note ${i}.\n`,
	);
}

console.log(`Wrote ${notes} notes, ${withReminder} with a reminder, to ${target}`);
