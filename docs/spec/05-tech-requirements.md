# Technical requirements

Status: signed off 2026-10-12

The engineering blueprint. Tech context: a TypeScript Obsidian plugin bundled by esbuild into one `main.js`, with no dependencies at run time, no server and no network calls. Minimum Obsidian version 1.8.7.

## Architecture

```
            notes (.md)                    data.json            localStorage
        properties, read only              settings             last-check
                 |                             |                     |
     Obsidian metadata cache                   |                     |
                 |                             |                     |
                 v                             v                     |
   +---------------------------+     +------------------+            |
   | reminder-index.ts         |<----| settings.ts      |            |
   | Map: note path -> entries |     | scope, sources   |            |
   +---------------------------+     +------------------+            |
        |  uses parse.ts, scope.ts (pure)                            |
        v                                                            v
   +-------------------------------------------------------------------+
   | scheduler.ts   tick every 5 s, uses due.ts (pure)                 |
   +-------------------------------------------------------------------+
        |
        v
   +----------------+      click       +----------------+
   | notify.ts      |----------------->| open-note.ts   |
   | system / notice|                  | tab or new tab |
   +----------------+                  +----------------+
        |  more than five late
        v
   +----------------+
   | missed-modal.ts|
   +----------------+
```

The keystone is the last-check timestamp. On every tick the scheduler fires each indexed reminder whose due time is after last-check and at or before now, then sets last-check to now. Nothing else records what has fired. A reminder at or before last-check is treated as handled, whether it fired, was missed on another day or was typed in already past. Every module either feeds that comparison (the index) or acts on its result (notify, open).

## Data models

Conventions: times are epoch milliseconds (`number`) worked out in the device's local time zone. Paths are vault-relative with forward slashes, as Obsidian gives them. Property names are stored as typed and compared in lower case. There are no IDs, no soft delete and no tenancy: the notes are the database.

### Settings

Stored in `data.json` through `loadData` and `saveData`.

| Field | Type | Notes |
|-------|------|-------|
| version | number | `1`. Raised when the shape changes. |
| scope | `'vault'` or `'folders'` | Default `'vault'` (FR-SCOPE-01). |
| folders | string[] | Folder paths with no trailing slash. Used only when scope is `'folders'`. No duplicates. Default `[]`. |
| sources | Source[] | Default `[{ kind: 'single', property: 'reminder' }]`. |

### Source

| Field | Type | Notes |
|-------|------|-------|
| kind | `'single'` or `'pair'` | |
| property | string | Single only. Holds day and time. |
| dayProperty | string | Pair only. |
| timeProperty | string | Pair only. Must differ from `dayProperty`. |

A source's key is `single:<property>` or `pair:<dayProperty>+<timeProperty>`, in lower case. Two sources with the same key are duplicates (FR-SET-05).

### Reminder

Held in memory only, rebuilt from the notes.

| Field | Type | Notes |
|-------|------|-------|
| file | TFile | Obsidian updates this object on rename, so the name and path stay current (FR-SCHED-02, FR-OPEN-04). |
| sourceKey | string | Which source produced it. |
| dueAt | number | Epoch ms, truncated to the minute. |

### Unreadable value

Held in memory only, shown in the settings tab (FR-SET-07).

| Field | Type | Notes |
|-------|------|-------|
| file | TFile | |
| sourceKey | string | |
| reason | `'no-time'` or `'bad-format'` | A day with no time, or a value the parser rejects. |

### Device state

One entry in Obsidian's per-vault local storage, key `property-reminders:last-check`, value epoch ms. Set to now the first time the plugin loads on a device (FR-MISSED-04).

Relationships: the index is a `Map<string, { reminders: Reminder[]; unreadable: Unreadable[] }>` keyed by note path. There are no other indexes. A due check walks every entry, which is fine at 1,000 reminders (NFR-04).

## API / command surface

The plugin registers no commands, no views and no URL handlers (Stage 3, standard states). The surface below is internal: the functions each module exports. Errors are thrown only for programmer mistakes. Bad user data becomes an `Unreadable` entry, never an exception.

### Pure logic (no Obsidian imports, unit tested)

- **`parseSingle(value: unknown) -> { dueAt: number } | { reason } | null`** in `parse.ts`. Reads `YYYY-MM-DDTHH:mm`, the same with `:ss`, and the same with a space for the `T` (FR-SRC-05, FR-SRC-06). An offset (`Z` or `+03:00`) is honoured. A bare `YYYY-MM-DD` returns `no-time` (FR-SRC-04). An empty or missing value returns null. Anything else returns `bad-format`. Seconds are dropped.
- **`parsePair(day: unknown, time: unknown) -> same`** in `parse.ts`. Day is `YYYY-MM-DD`. Time is `HH:mm`, `H:mm`, `h:mm AM`, or a minute count as a number if M0 shows Obsidian produces one (FR-SRC-02, FR-SRC-06). Day present and time empty returns `no-time`. Both empty returns null. Day empty and time present also returns null, so recurring calendar events are ignored without being listed.
- **`extract(frontmatter, sources) -> { reminders, unreadable }`** in `parse.ts`. Looks up each source's properties without regard to case (FR-SRC-07) and calls the two parsers. Returns plain objects with `sourceKey` and `dueAt`.
- **`inScope(path, settings) -> boolean`** in `scope.ts`. True when the path ends in `.md` and either scope is `'vault'` or the path starts with a chosen folder plus `/` (FR-SCOPE-01, FR-SCOPE-02, FR-SCOPE-05). `Projects` must not match `Projects-old/a.md`.
- **`selectDue(reminders, lastCheck, now) -> { onTime, late, summary }`** in `due.ts`. Keeps entries with `lastCheck < dueAt <= now`. Drops a second entry for the same note and minute (FR-SRC-08). An entry more than 5 minutes old is late. If more than five are late they all go to `summary`, oldest first, and `late` is empty (FR-MISSED-02).
- **`validateSource(candidate, existing) -> string | null`** in `settings.ts`. Returns the inline message for an empty name, a duplicate key or a pair using one name twice (FR-SET-05).

### Obsidian-facing modules

- **`ReminderIndex`** in `reminder-index.ts`. `rebuild()` scans `getMarkdownFiles()`. `update(file)` re-reads one note. `remove(path)` drops one. `all()` returns every reminder. `unreadable()` returns the list for the settings tab. `pendingCount()` returns how many in-scope files had no cache entry at the last scan.
- **`Scheduler`** in `scheduler.ts`. `start()` registers the 5 second interval. `tick()` runs one check. It owns last-check: read once at start, kept in memory, written back after each tick.
- **`notify(item)`, `notifySummary(items)`, `sendTest()`, `closeAll()`** in `notify.ts`. Picks the system notification or the in-app notice (FR-NOTIFY-01 to FR-NOTIFY-03).
- **`openNote(file)`** in `open-note.ts` (FR-OPEN-01 to FR-OPEN-04).

## Permissions

Single user, no roles. The plugin reads properties and paths, writes its own `data.json` and one local storage key, and never writes to a note (NFR-02).

## Screens and key components

### System notification (desktop)

Purpose: tell the user a reminder is due and open its note on click (FR-NOTIFY-01, FR-OPEN-01).

- Title: the note's name without `.md`, unchanged (FR-NOTIFY-05).
- Body when on time: `Reminder · 09:30`, the time in the device locale.
- Body when late: `Missed · Wed 14 Oct, 09:30`.
- Summary: title `12 missed reminders`, body `Click to see the list`.
- Click: bring the Obsidian window forward, then `openNote`, or open the missed list for a summary.

States: shown, or replaced by the in-app notice when Electron's `Notification` is missing, reports not supported or emits `failed`. The first fallback in a session adds a notice: "System notifications are unavailable. Showing reminders inside Obsidian instead."

### In-app notice (mobile and fallback)

Purpose: the same two lines inside Obsidian (FR-NOTIFY-02, FR-OPEN-03).

A `Notice` with duration 0, built with `createEl` (title in one element, second line in another). Clicking it opens the note. It stays until clicked.

### Missed reminders list

Purpose: show every late reminder when more than five were missed (FR-MISSED-02).

A `SuggestModal`. Each row shows the note name and its due day and time, oldest first. Choosing a row opens that note. The placeholder reads "Missed reminders". If a listed note has since been deleted, choosing it shows "Note not found: <name>".

### Settings tab

Purpose: every setting, plus a status readout and the test button (FR-SET-01 to FR-SET-09). Built from `Setting` rows, in this order:

1. Scope. A dropdown with "Whole vault" and "Specific folders".
2. Folders, shown only for "Specific folders". A text field with folder suggestions (`AbstractInputSuggest`) and an "Add" button. Below it, one row per chosen folder with a remove button whose `aria-label` is "Remove <folder>". A folder that no longer exists shows "(missing)" after its path.
3. A heading, "Reminder properties". One row per source: a dropdown ("One property (day and time)" or "Two properties"), one or two text fields, a remove button. Under the rows, an "Add property" button.
4. A heading, "Status". A line "N reminders scheduled". Then, if any, "N notes have a value that cannot be read", followed by one link per note with its reason ("no time set" or "unrecognised format"). Clicking a link opens the note.
5. A "Send test notification" button. Description: "If nothing appears, allow notifications for Obsidian in your system settings."

States:

- Empty folders: "No folders chosen. No reminders will fire." (FR-SET-03)
- Empty sources: "No properties set. No reminders will fire."
- Invalid source: an inline message under the row. The row keeps what the user typed and the saved setting keeps its last valid value (FR-SET-05).
- No loading state. The numbers are read when the tab opens and again after each change.

On a 375 pt screen each row stacks its controls under its label, which `Setting` does by default. The pair row puts its two text fields on separate lines (FR-SET-09).

## State management

The notes are the source of truth for reminders, `data.json` for settings and local storage for last-check. The index is derived and can be thrown away at any time.

How the index hears about changes:

- `workspace.onLayoutReady`: `rebuild()`, then start the scheduler.
- `metadataCache.on('changed')`: `update(file)`.
- `metadataCache.on('deleted')`: `remove(path)` (FR-SCHED-03).
- `vault.on('rename')`: for a file, `remove(oldPath)` then `update(file)`. For a folder, rewrite matching entries in `settings.folders`, save, then `rebuild()` (FR-SCHED-02, FR-SCOPE-04).
- Any settings change, from the tab or from `onExternalSettingsChange`: `rebuild()`, debounced by 300 ms so typing a property name does not rescan on every key (FR-SCOPE-03, FR-SET-06).

The startup gate: the scheduler does not run its first tick until `pendingCount()` is zero, or 60 seconds have passed since layout ready. Until then last-check does not move, so a note indexed late still has its missed reminder found (Stage 4, risk 2).

Time zone: each tick compares `new Date().getTimezoneOffset()` with the value from the previous tick and calls `rebuild()` when it differs, because due times are worked out in local time.

Clock set backwards: if now is earlier than last-check, the tick sets last-check to now and fires nothing.

Undo and redo: none. The plugin changes no notes.

## Background and long-running tasks

- The tick. Every 5 seconds through `registerInterval`. It reads the index, calls `selectDue`, sends notifications and writes last-check. No retries: a notification that fails to show falls back to the notice in the same tick.
- The first scan. Once, after layout ready. One pass over the cached properties of every Markdown file, no disk access, no progress display (NFR-01).
- Rebuild after a settings change. The same scan, debounced.

Nothing runs during `onload` except loading settings and registering handlers, so load time stays under 50 ms (NFR-01).

## Security

- No network access of any kind: no `fetch`, no `requestUrl`, no remote scripts (NFR-02).
- Note names and folder paths reach the page only through `setText` and `createEl({ text })`. No `innerHTML`.
- Electron is reached in one place, `notify.ts`, behind `Platform.isDesktopApp` and a check that `window.require` exists. Only `remote.Notification` and `remote.getCurrentWindow` are used.
- Settings loaded from `data.json` are checked on load: an unknown scope becomes `'vault'`, and a source that fails `validateSource` is dropped. A synced or hand-edited file cannot crash the plugin.
- No files outside the vault are read or written.

## Logging and observability

`console.error` with the prefix `[property-reminders]` for unexpected exceptions in event handlers and in the tick, which are caught so one bad note cannot stop the scheduler. Nothing is logged in normal use. Note contents are never logged.

## Testing strategy

Unit tests with `node --test` on the pure modules. They live in `tests/` and import the `.ts` source directly. `npm test` runs them, and the lint workflow runs `npm test` too.

- `parse.test.ts`: each accepted format, date-only, garbage, out-of-range values such as month 13 and 25:00, an offset value, both 12-hour forms, case-insensitive property lookup, a pair with one half missing.
- `scope.test.ts`: whole vault, a nested folder, the `Projects` versus `Projects-old` case, non-Markdown files, an empty folder list.
- `due.test.ts`: on time, already handled, exactly at last-check, late by 6 minutes, six late giving a summary, two sources in the same minute, an empty list.
- `settings.test.ts`: the three rejected source shapes and loading a damaged settings object.

Manual tests in a test vault, one per acceptance line in Stage 3, recorded as ticks in `PROGRESS.md`. The vault holds a Kanban board with note cards, a Full Calendar style event note, a Bases view, a Templater template and a note with an Arabic name. A script in `tests/` writes 10,000 notes with 1,000 reminders for the performance lines (NFR-01, NFR-04).

Before each release: `npm run lint`, `npm test`, `npm run build`, then the manual list on macOS. The other four platforms in NFR-05 are tested where a device is at hand, and the README names the ones that were.

## Environment and configuration

No environment variables and no secrets.

- `manifest.json`: `id` `property-reminders`, `name` "Property Reminders", `minAppVersion` `1.8.7`, `isDesktopOnly` false, `author` "Abdulkader Safi".
- `package.json`: name `property-reminders`, `obsidian` pinned to `1.14.4`, a `test` script, licence MIT.
- `versions.json`: `{ "1.0.0": "1.8.7" }`.
- Local storage key: `property-reminders:last-check`.

## Migrations and seed data

Settings carry `version: 1`. Loading merges the saved object over the defaults, so a later version can add fields without a migration. A change of shape raises the number and adds one function that converts the old shape.

No seed data. The sample plugin's code (ribbon icon, sample modal, commands, click listener) is deleted in M1, and the sample `README.md` and `LICENSE` are replaced.

## Repository layout

```
src/
  main.ts            lifecycle only: load settings, register handlers, add the tab
  settings.ts        Settings and Source types, defaults, load checks, validateSource
  parse.ts           parseSingle, parsePair, extract (pure)
  scope.ts           inScope (pure)
  due.ts             selectDue (pure)
  reminder-index.ts  ReminderIndex
  scheduler.ts       Scheduler, startup gate, last-check
  notify.ts          system notification, in-app notice, typed Electron surface
  open-note.ts       openNote
  settings-tab.ts    the settings tab and its folder suggest
  missed-modal.ts    the missed reminders list
tests/
  parse.test.ts  scope.test.ts  due.test.ts  settings.test.ts
  make-vault.mjs     writes the 10,000-note test vault
```

---

### Open questions

None.

### Assumptions confirmed

1. **A pair source with a time and no day : RESOLVED.** The note is ignored and not listed as unreadable. Calendar plugins write a start time with no date on recurring events, and listing each of those would bury the real mistakes.
2. **Seconds in a value : RESOLVED.** `2026-10-14T09:30:45` fires at 09:30. Seconds are dropped.
3. **Removing every source : RESOLVED.** Allowed. The tab shows "No properties set. No reminders will fire."
