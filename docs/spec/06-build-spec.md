# Build spec: Property Reminders

> **This is the hand-off document for Claude Code.** It is self-contained: build from this file alone. It pulls together the decisions from stages 1 to 5. Where it says "see Stage N", that is optional background.

Status: signed off 2026-10-12. Sources: 01 to 05 as of that date.

## 1. What we're building

An Obsidian community plugin, "Property Reminders" (ID `property-reminders`). It sends a notification when the day and time held in a note's properties arrive, and opens that note when the notification is clicked. It is for people who plan in Obsidian with Kanban cards, calendar event notes and Bases views, where dates already live in properties. The difference from the existing reminder plugins is that the reminder is a plain property: there is no inline syntax, no plugin-owned data and no plugin view. The plugin is free, MIT licensed, and makes no network calls.

## 2. Stack (decided, see Stage 4)

| Layer | Choice |
|-------|--------|
| Language | TypeScript `^5.8.3`, strict mode |
| Bundler | esbuild `0.25.5`, one `main.js`, existing `esbuild.config.mjs` |
| Obsidian API | `obsidian` types pinned to `1.14.4`, `minAppVersion` `1.8.7` |
| Run-time dependencies | None |
| Reminder data | Obsidian metadata cache (`getFileCache(file).frontmatter`) |
| Scheduler | One `window.setInterval` every 5 seconds via `registerInterval` |
| Date parsing | Hand-written, two regular expressions and `new Date(...)` |
| Time display | `Intl.DateTimeFormat` in the device locale |
| Desktop notification | Electron `remote.Notification` behind `Platform.isDesktopApp` |
| Mobile and fallback notification | Obsidian `Notice` with duration 0 |
| Missed list | Obsidian `SuggestModal` |
| Settings UI | `PluginSettingTab`, `Setting`, `AbstractInputSuggest` |
| Settings storage | `loadData` and `saveData` (`data.json`) |
| Device state | `app.loadLocalStorage` and `app.saveLocalStorage` |
| Tests | `node --test` on pure modules, Vitest only as a fallback |
| Lint | ESLint 9 with `eslint-plugin-obsidianmd`, existing config |
| CI | Existing GitHub Actions: `lint.yml` (add `npm test`), `release.yml` |
| Distribution | GitHub release, then the Obsidian community directory |
| Backend, database, auth, hosting | None |

## 3. Architecture and principles

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

The keystone is the last-check timestamp, one number per device. On every tick the scheduler fires each indexed reminder whose due time is after last-check and at or before now, then sets last-check to now. Nothing else records what has fired.

**Non-negotiable principles:**

1. **Never write to a note.** The plugin reads properties and paths only. No `processFrontMatter`, no `vault.modify`.
2. **No network.** No `fetch`, no `requestUrl`, no telemetry.
3. **The timestamp is the only memory.** Do not add a list of fired reminders. Do not store last-check in `data.json`, because that file syncs between devices.
4. **Compare against the wall clock.** Never schedule a timer per reminder.
5. **Pure logic stays pure.** `parse.ts`, `scope.ts` and `due.ts` import nothing from `obsidian`, so `node --test` can run them.
6. **Electron in one file.** Only `notify.ts` touches `window.require('electron')`, behind `Platform.isDesktopApp` and an `undefined` check. The plugin must load on mobile.
7. **Clean unload.** Every listener and interval goes through a `register*` helper. On unload, open notifications and notices are closed.
8. **Text only in the DOM.** Note names and paths go through `setText` or `createEl({ text })`. No `innerHTML`.
9. **Bad data is never an exception.** An unreadable value becomes an entry in the unreadable list. Handlers and the tick catch errors and log with the prefix `[property-reminders]`.

## 4. Repository structure

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
docs/spec/           these six files
PROGRESS.md          milestone status and deviations
```

The repo starts as the official Obsidian sample plugin. Its sample code (ribbon icon, modal, commands, click listener), `README.md` and 0-BSD `LICENSE` are replaced. The remote is `github.com/Abdulkader-Safi/obsidian-reminder-plugin`, branch `main`. Commit after each step and push there.

## 5. Data model

Times are epoch milliseconds in the device's local zone. Paths are vault-relative. Property names are compared in lower case.

### Settings (`data.json`)

| Field | Type | Notes |
|-------|------|-------|
| version | number | `1` |
| scope | `'vault'` or `'folders'` | Default `'vault'` |
| folders | string[] | No trailing slash, no duplicates, default `[]` |
| sources | Source[] | Default `[{ kind: 'single', property: 'reminder' }]` |

### Source

| Field | Type | Notes |
|-------|------|-------|
| kind | `'single'` or `'pair'` | |
| property | string | Single only: one property holding day and time |
| dayProperty | string | Pair only |
| timeProperty | string | Pair only, must differ from `dayProperty` |

Source key: `single:<property>` or `pair:<dayProperty>+<timeProperty>`, lower case. Equal keys are duplicates.

### Reminder (memory only)

| Field | Type | Notes |
|-------|------|-------|
| file | TFile | Obsidian updates it in place on rename |
| sourceKey | string | |
| dueAt | number | Truncated to the minute |

### Unreadable value (memory only)

| Field | Type | Notes |
|-------|------|-------|
| file | TFile | |
| sourceKey | string | |
| reason | `'no-time'` or `'bad-format'` | |

### Device state

Local storage key `property-reminders:last-check`, epoch ms, set to now on the first load on a device.

The index is a `Map<string, { reminders: Reminder[]; unreadable: Unreadable[] }>` keyed by note path. Full detail is in Stage 5.

## 6. API / command surface

No commands, views or URL handlers. The internal surface:

Pure logic:

- `parseSingle(value)` in `parse.ts`. Accepts `YYYY-MM-DDTHH:mm`, the same with `:ss`, the same with a space for the `T`, and an optional offset (`Z` or `+03:00`). A bare `YYYY-MM-DD` gives `no-time`. Empty or missing gives null. Anything else, including month 13 or 25:00, gives `bad-format`. Seconds are dropped.
- `parsePair(day, time)` in `parse.ts`. Day is `YYYY-MM-DD`. Time is `HH:mm`, `H:mm` or `h:mm AM`, or a minute count as a number if M0 shows Obsidian produces one. Day present with time empty gives `no-time`. Both empty gives null. Time present with day empty gives null (recurring calendar events are ignored).
- `extract(frontmatter, sources)` in `parse.ts`. Looks up each source's properties without regard to case and returns `{ reminders, unreadable }`.
- `inScope(path, settings)` in `scope.ts`. True for a `.md` path when scope is `'vault'`, or when the path starts with a chosen folder plus `/`. `Projects` must not match `Projects-old/a.md`.
- `selectDue(reminders, lastCheck, now)` in `due.ts`. Keeps `lastCheck < dueAt <= now`. Drops a second entry for the same note and minute. Late means more than 5 minutes old. More than five late entries all move to `summary`, oldest first.
- `validateSource(candidate, existing)` in `settings.ts`. Returns a message for an empty name, a duplicate key or a pair using one name twice, otherwise null.

Obsidian-facing:

- `ReminderIndex` in `reminder-index.ts`: `rebuild()`, `update(file)`, `remove(path)`, `all()`, `unreadable()`, `pendingCount()`.
- `Scheduler` in `scheduler.ts`: `start()`, `tick()`. Owns last-check.
- `notify(item)`, `notifySummary(items)`, `sendTest()`, `closeAll()` in `notify.ts`.
- `openNote(file)` in `open-note.ts`: reveal the note's existing tab if one is open (`iterateAllLeaves`, `revealLeaf`), otherwise `getLeaf('tab').openFile(file)`. If the file no longer exists, show the notice "Note not found: <name>".

Event wiring, all registered in `main.ts`:

- `workspace.onLayoutReady`: `rebuild()`, then start the scheduler.
- `metadataCache.on('changed')`: `update(file)`.
- `metadataCache.on('deleted')`: `remove(path)`.
- `vault.on('rename')`: for a file, `remove(oldPath)` then `update(file)`. For a folder, rewrite matching entries in `settings.folders`, save, then `rebuild()`.
- Any settings change, from the tab or `onExternalSettingsChange`: `rebuild()`, debounced by 300 ms.

Scheduler rules:

- Startup gate: no tick until `pendingCount()` is zero or 60 seconds have passed since layout ready. Last-check does not move before then.
- Each tick: if the time zone offset changed since the previous tick, `rebuild()` first. If now is before last-check, set last-check to now and fire nothing. Otherwise call `selectDue`, send the results, set last-check to now and save it.

## 7. Screens

### System notification (desktop)

- Title: the note's name without `.md`, unchanged.
- Body on time: `Reminder · 09:30`, time in the device locale.
- Body when late: `Missed · Wed 14 Oct, 09:30`.
- Summary: title `12 missed reminders`, body `Click to see the list`.
- Click: bring the Obsidian window forward (restore it if minimised) through `remote.getCurrentWindow()`, then open the note, or the missed list for a summary.
- Keep a reference to each notification object until it is clicked or closed, or its click handler can be lost.

Fallback: when Electron's `Notification` is missing, reports not supported or emits `failed`, show the in-app notice. The first fallback in a session adds the notice "System notifications are unavailable. Showing reminders inside Obsidian instead." The plugin cannot detect notifications blocked in the operating system's settings.

### In-app notice (mobile and fallback)

A `Notice` with duration 0 holding the same two lines, built with `createEl`. Clicking it opens the note. It stays until clicked.

### Missed reminders list

A `SuggestModal` with the placeholder "Missed reminders". Each row shows the note name and its due day and time, oldest first. Choosing a row opens that note.

### Settings tab

Rows in this order:

1. Scope: a dropdown with "Whole vault" and "Specific folders".
2. Folders, shown only for "Specific folders": a text field with folder suggestions and an "Add" button, then one row per chosen folder with a remove button whose `aria-label` is "Remove <folder>". A folder that no longer exists shows "(missing)". The same folder cannot be added twice.
3. Heading "Reminder properties": one row per source with a dropdown ("One property (day and time)" or "Two properties"), one or two text fields and a remove button. Then an "Add property" button.
4. Heading "Status": "N reminders scheduled". Then, if any, "N notes have a value that cannot be read" and one link per note with its reason ("no time set" or "unrecognised format"). A link opens the note.
5. "Send test notification" button, with the description "If nothing appears, allow notifications for Obsidian in your system settings."

States:

- Empty folders: "No folders chosen. No reminders will fire."
- Empty sources: "No properties set. No reminders will fire."
- Invalid source: an inline message under the row. The row keeps the typed text and the saved setting keeps its last valid value.
- No loading state. Numbers are read when the tab opens and after each change.
- At 375 pt wide, controls stack under their labels and the pair row's two fields sit on separate lines.

Settings read from `data.json` are checked on load: an unknown scope becomes `'vault'` and a source that fails `validateSource` is dropped.

## 8. Build plan (milestones)

### M0: de-risk (do this first)

A throwaway spike in a scratch branch, tried on macOS in Safi's vault. It answers four questions:

1. Does `window.require('electron').remote.Notification` show a system notification, and does its click handler bring a minimised or background Obsidian window to the front?
2. What does the metadata cache hold for `startTime: 09:30`, `startTime: 14:30` and `startTime: "09:30"`: a string or a number?
3. How long after layout ready does `getFileCache` return a value for every Markdown file in a large vault?
4. With notifications blocked for Obsidian in System Settings, does the notification call fail silently?

Exit criteria: each answer is written in `PROGRESS.md`. If question 1 fails, try the web `Notification` API for showing and keep `remote.getCurrentWindow()` for focus. If neither focuses the window, stop there and tell Safi. If question 2 gives a number, `parsePair` accepts a minute count. If question 3 exceeds 60 seconds, raise the gate's limit and say so.

### M1: foundation and pure logic

Builds: FR-SRC-04, FR-SRC-05, FR-SRC-07, FR-SRC-08, FR-SCOPE-05, FR-SET-05

Tasks:

- Rename the plugin: `manifest.json` (`id` `property-reminders`, `name` "Property Reminders", `minAppVersion` `1.8.7`, `author` "Abdulkader Safi", a one-line description), `package.json` (name, `obsidian` pinned to `1.14.4`, a `test` script, licence MIT), `versions.json` (`{ "1.0.0": "1.8.7" }`).
- Ask Safi to rename the plugin folder to `property-reminders` so it matches the ID. Obsidian must be closed while it is renamed.
- Replace `LICENSE` with MIT, copyright Abdulkader Safi.
- Delete the sample code. Leave `main.ts` loading settings only.
- Write `settings.ts`, `parse.ts`, `scope.ts`, `due.ts` and their four test files. Add FR-SRC-06 (space separator, 12-hour time) in the parser.
- Add `npm test` to `lint.yml`.

Exit criteria: `npm test`, `npm run lint` and `npm run build` pass. The plugin loads in Obsidian and does nothing.

### M2: index, scheduler and in-app notice

Builds: FR-SRC-01, FR-SRC-02, FR-SRC-03, FR-SCOPE-01, FR-SCHED-01, FR-SCHED-02, FR-SCHED-03, FR-SCHED-04, FR-SCHED-05, FR-SCHED-06, FR-NOTIFY-02, FR-NOTIFY-04, FR-OPEN-02, FR-OPEN-03, FR-OPEN-04, FR-MISSED-01, FR-MISSED-03, FR-MISSED-04

Tasks:

- `reminder-index.ts` with the event wiring from section 6.
- `scheduler.ts` with the startup gate, the time zone check and last-check in local storage.
- `notify.ts` with the in-app notice only, on every platform for now.
- `open-note.ts`.

Exit criteria: with default settings, a `reminder` set two minutes ahead shows a notice at that minute and a click opens the note in a new tab. Quitting Obsidian across a due time gives one "Missed" notice on the next start and none on the start after. The M2 acceptance boxes are ticked by hand.

### M3: system notification and missed summary

Builds: FR-NOTIFY-01, FR-NOTIFY-03, FR-NOTIFY-05, FR-OPEN-01, FR-MISSED-02

Tasks:

- Add the Electron path to `notify.ts` using the M0 result, with the fallback and its once-per-session notice.
- `missed-modal.ts` and `notifySummary`.
- Close tracked notifications and notices on unload.

Exit criteria: on macOS, with Obsidian minimised, a due reminder shows a system notification and a click brings Obsidian forward on the right note. A note with an Arabic name shows correctly. Twelve missed reminders give one summary that opens the list.

### M4: settings tab

Builds: FR-SCOPE-02, FR-SCOPE-03, FR-SET-01, FR-SET-02, FR-SET-03, FR-SET-04, FR-SET-06, FR-SET-08, FR-SET-09

Tasks:

- `settings-tab.ts` as laid out in section 7, with the folder suggest.
- Folder rename following and the "(missing)" mark (FR-SCOPE-04).
- The status section with the unreadable list (FR-SET-07).
- `onExternalSettingsChange`.

Exit criteria: every row works with the keyboard alone. Scope and source changes take effect without a restart and survive one. The tab is usable at 375 pt wide.

### M5: release readiness

Builds: NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07

Tasks:

- `tests/make-vault.mjs` and the performance checks on the 10,000-note vault.
- A full manual pass of section 9 in a test vault holding a Kanban board with note cards, a Full Calendar style event note, a Bases view over `reminder` and a Templater template.
- Load the plugin on a phone if one is at hand, and confirm it shows notices and does not crash.
- Write `README.md`: what it does, the two source kinds, the accepted formats, that it runs only while Obsidian is running, the mobile limit, where to allow notifications on each desktop system, and which platforms were tested.
- Confirm that disabling the plugin stops the tick and closes open notifications.

Exit criteria: every box in section 9 is ticked or has a note in `PROGRESS.md` saying why it could not be tested. `npm run lint`, `npm test` and `npm run build` pass. No release is tagged until Safi asks.

## 9. Acceptance criteria

### POC (proves the core idea)

- [x] **FR-SRC-01** A note with `reminder: 2026-10-14T09:30` fires one notification at 09:30 on that day.
- [ ] **FR-SCHED-01** A reminder added, changed or cleared while Obsidian runs is picked up with no restart, including a change made by a sync tool or another editor.
- [x] **FR-NOTIFY-01** On desktop a due reminder shows a system notification headed with the note's name, with "Reminder" and the time on the second line, while Obsidian is in the background.
- [ ] **FR-OPEN-01** Clicking the system notification brings a minimised Obsidian to the front with the note visible.

### MVP (shippable v1)

- [x] **FR-SRC-02** With a pair source `date` + `startTime`, a note with `date: 2026-10-14` and `startTime: 09:30` fires at 09:30 on that day.
- [ ] **FR-SRC-03** With sources `reminder` and `due`, each fires at its own time, and a note carrying both at different times fires twice.
- [x] **FR-SRC-04** A day with no time (single or pair) never fires and is counted as unreadable.
- [x] **FR-SRC-05** `YYYY-MM-DDTHH:mm`, the same with `:ss`, and `YYYY-MM-DD` with `HH:mm` in a pair all fire at the stated minute. `tomorrow 9am` fires nothing and is counted as unreadable.
- [x] **FR-SRC-07** With the source `reminder`, a note using `Reminder:` fires.
- [x] **FR-SRC-08** Two sources giving the same minute on one note fire one notification.
- [x] **FR-SCOPE-01** On a fresh install a valid reminder in any folder fires.
- [x] **FR-SCOPE-02** With folders `Projects` and `Calendar`, `Projects/Client A/invoice.md` fires and `Archive/old.md` does not.
- [x] **FR-SCOPE-03** Removing a folder from scope stops its pending reminder at once. Adding it back arms reminders still in the future.
- [x] **FR-SCOPE-05** A `.canvas` or `.base` file never produces a reminder.
- [ ] **FR-SCHED-02** A renamed note still fires under its new name. A note moved out of the chosen folders does not fire.
- [x] **FR-SCHED-03** A note deleted before its time never fires.
- [ ] **FR-SCHED-04** A fired reminder does not fire again after a restart or a body edit. Changing it to a new future time fires once more.
- [ ] **FR-SCHED-05** A time already past when typed fires nothing. Adding a source over 300 old dates fires nothing.
- [ ] **FR-SCHED-06** A reminder due while the laptop sleeps with Obsidian open fires within 30 seconds of waking, marked as missed.
- [ ] **FR-NOTIFY-02** On mobile a due reminder shows an in-app notice that is still on screen 60 seconds later.
- [ ] **FR-NOTIFY-03** When the system notification is not supported or fails to show, the in-app notice appears, and the first one of the session is followed by a notice saying system notifications are unavailable.
- [x] **FR-NOTIFY-04** Three notes due in the same minute give three notifications, each opening its own note.
- [ ] **FR-NOTIFY-05** A note named `اجتماع العميل.md` shows that exact text as the heading.
- [x] **FR-OPEN-02** With note A being edited, clicking a notification for note B leaves A in its tab and shows B in another. If B is already open, its tab is shown.
- [ ] **FR-OPEN-03** Tapping the in-app notice opens the note.
- [ ] **FR-OPEN-04** A note renamed after its notification appeared still opens on click. A deleted one shows "Note not found: <name>".
- [ ] **FR-MISSED-01** Quit at 09:00 with a reminder at 09:30, start at 11:00: one "Missed" notification within 10 seconds of the workspace loading. Restart: nothing.
- [x] **FR-MISSED-02** Twelve missed reminders give one notification reading "12 missed reminders", which opens a list of 12 notes with due times, oldest first. Choosing one opens it.
- [ ] **FR-MISSED-03** A reminder that fired on the laptop still shows as missed on a phone sharing the vault, and the other way round.
- [x] **FR-MISSED-04** Enabling the plugin in a vault with 50 past `reminder` values fires nothing.
- [x] **FR-SET-01** The settings tab exists and scope reads "Whole vault" on a fresh install.
- [x] **FR-SET-02** Typing `Pro` suggests `Projects`, choosing it adds a row, the remove button deletes it, and the same folder cannot be added twice.
- [x] **FR-SET-03** "Specific folders" with an empty list shows "No folders chosen. No reminders will fire."
- [x] **FR-SET-04** The default list holds `reminder`. Adding the pair `date` + `startTime` makes those notes fire, and removing it stops them.
- [x] **FR-SET-05** An empty name, a duplicate source and a pair using one name twice each show an inline message and are not saved.
- [x] **FR-SET-06** Scope and sources are unchanged after an Obsidian restart.
- [ ] **FR-SET-08** "Send test notification" shows a system notification within 2 seconds on desktop or a notice on mobile, and the text beside it says where to allow notifications.
- [ ] **FR-SET-09** At 375 pt wide every control is reachable and no row is cut off.
- [ ] **NFR-01** On a 16 GB M1 MacBook with 10,000 notes: first scan under 2 seconds and only after the workspace loads, plugin load under 50 ms, a due reminder within 10 seconds of its minute, a changed note reflected within 5 seconds.
- [ ] **NFR-02** No network request of any kind, and no write to any note.
- [ ] **NFR-03** Works with the network off. The README says the plugin runs only while Obsidian is running.
- [ ] **NFR-04** With 10,000 notes and 1,000 pending reminders, typing in a note shows no slowdown.
- [ ] **NFR-05** `isDesktopOnly` is false and the plugin loads on desktop and mobile.
- [ ] **NFR-06** The settings tab is usable by keyboard alone, every button has a text label, and plugin text is English.
- [ ] **NFR-07** `npm run lint` passes with zero errors, and after disabling the plugin no notification fires.

Should requirements, built but not release blockers: FR-SRC-06 (space separator and 12-hour time), FR-SCOPE-04 (folder rename following), FR-SET-07 (scheduled count and unreadable list).

## 10. Standard states

- Undo and redo: out of scope. The plugin never edits notes.
- Empty states: FR-SET-03, FR-SET-07, plus the empty sources text.
- Loading and progress: out of scope. The first scan is short (NFR-01).
- Error states and messages: FR-NOTIFY-03, FR-OPEN-04, FR-SET-05, FR-SET-07, FR-SET-08.
- Confirm before destructive actions: out of scope. Removing a folder or source deletes no data.
- Autosave: FR-SET-06.
- Search and filter: FR-SET-02 only.
- Keyboard shortcuts: out of scope. No commands in v1.
- Settings that persist: FR-SET-06.
- First-run and onboarding: FR-MISSED-04. No onboarding screen.
- Offline behaviour: NFR-03.
- Permissions per role: out of scope. Single user.
- Notifications: FR-NOTIFY-01 to FR-NOTIFY-05.
- Import and export: out of scope. Reminders are properties in the user's notes.
- Delete and restore: FR-SCHED-03. A restored note is picked up by FR-SCHED-01.
- Audit log: out of scope. No history in v1.
- Multi-language and RTL: FR-NOTIFY-05 for note names. Plugin text is English.
- Accessibility: NFR-06.
- Mobile layout: FR-SET-09.
- Rate limits and quotas: FR-MISSED-02.

## 11. Out of scope for MVP

Do not build these, even if they look easy.

Phase 2:

- A dashboard or list view of reminders.
- Recurring reminders.
- Snooze and "mark done".
- A history of fired reminders.
- Advance notice (remind N minutes before).
- A command to set a reminder on the current note.

Never:

- Reminders inside the note body (inline dates, checklist syntax).
- Mobile system notifications or push.
- Per-person reminders in a shared vault.
- Custom sound or notification styling.
- Natural-language dates.

Revisit if users ask: a time zone setting. Values are local time, and a value with an explicit offset is read as that instant.

## 12. Top risks and mitigations

1. **System notification and click-to-focus** : it relies on an Obsidian internal (`remote`). M0 proves it on macOS first. The web `Notification` API is the fallback for showing, and the in-app notice is the fallback for everything.
2. **Reminders lost at startup** : a note indexed after the first tick would be skipped. The startup gate holds the first tick until every in-scope file has a cache entry, with a 60 second limit. M0 measures the wait.
3. **Time values in pair sources** : the cache may hold a number for `09:30`. M0 prints what it holds, and `parsePair` accepts a minute count if needed.
4. **Blocked notifications cannot be detected** : a user who blocked Obsidian gets silence. The test button and the README are the defence.
5. **The sample plugin's remote** : the repo began with Obsidian's sample repo as its remote. It now points at Safi's repo, and nothing is ever pushed anywhere else.

## 13. Instructions for Claude Code

- Build milestone by milestone, in order. Finish M0 before any feature work.
- Keep a `PROGRESS.md` at the repo root: milestone status, decisions made, deviations from this spec and why.
- At the end of each milestone, run the tests and tick the acceptance boxes it covers. Don't move on with a failing box.
- Many boxes need a person watching Obsidian. Say which ones you could not check yourself and give Safi the exact steps.
- Don't add features outside this spec. If something seems missing, note it in `PROGRESS.md` and ask.
- If a spec decision turns out to be wrong in practice, stop. Explain what you found. Don't silently swap a stack choice.
- Follow `AGENTS.md` in the repo root for Obsidian conventions: sentence case in UI text, `register*` helpers for cleanup, `main.ts` kept to lifecycle code.
- Check the `@since` tag of every Obsidian API you call. Nothing newer than 1.8.7.
- Commit after each step, with a message naming the milestone, and push to `origin main`.
- There are no secrets and no environment variables.

---

*Companion files in `docs/spec/`: 01-product, 02-users, 03-requirements, 04-tech-decisions, 05-tech-requirements. This build spec is the entry point.*
