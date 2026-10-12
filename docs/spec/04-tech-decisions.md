# Tech decisions

Status: signed off 2026-10-12

For each decision: what was chosen, what else was considered, and why, traced to a requirement (Stage 3) or the mission and users (Stages 1 and 2).

> **Constraints going in:** the repo is the official Obsidian sample plugin, and `AGENTS.md` fixes the toolchain: TypeScript, bundled by esbuild, installed with npm. The plugin is free, has no server and makes no network calls (NFR-02). It must load on mobile (NFR-05), so Node and Electron APIs are allowed only behind a desktop check. One developer, no deadline, no budget.

Facts below were checked on 2026-10-12 against three sources: the `obsidian` 1.14.4 type definitions on npm (the `@since` tags), the source of the uphy Reminder plugin on GitHub (`src/plugin/ui/system-notification.ts` and `electron.ts`), and Obsidian's [submission page](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).

## Overall architecture

Chosen: one plugin process with four small parts and no storage of its own. An index holds every reminder found in the vault's cached properties. A clock tick compares that index with the device time. A notifier shows what is due, and an opener shows the note. The only thing written to disk besides settings is one timestamp per device, the last time the tick ran.

Considered: keeping a list of fired reminders in `data.json`. Dropped because `data.json` syncs between devices, which breaks per-device missed reminders (FR-MISSED-03), and because the list grows for ever.

Why: the timestamp alone answers every "should this fire?" question. A reminder due after the timestamp and at or before now fires. A reminder due at or before the timestamp has been handled. That one rule covers fire once (FR-SCHED-04), past values never fire (FR-SCHED-05), missed on startup (FR-MISSED-01), sleep and wake (FR-SCHED-06) and no flood on first install (FR-MISSED-04, where the timestamp starts at the moment of install).

## Language and build

Chosen: TypeScript `^5.8.3` in strict mode, bundled by esbuild `0.25.5` to a single `main.js`, as the sample plugin ships. Types from `obsidian` 1.14.4. `minAppVersion` is `1.8.7`.

Considered: upgrading to TypeScript 7.0.2 and esbuild 0.28.2, the current npm versions. Dropped because the sample's lint and build scripts are tested against the pinned versions and the plugin gains nothing from the newer ones.

Why: `1.8.7` is the version that added `App.loadLocalStorage` and `App.saveLocalStorage`, which hold the device timestamp. Every other API used is older. The uphy plugin already requires 1.7.2, so the cost in lost users is small.

Landmine: `package.json` asks for `obsidian: "latest"`, so the types can describe APIs newer than `minAppVersion`. Pin it to `1.14.4`, and check the `@since` tag of each API before using it.

## Reminder index

Chosen: read properties from `app.metadataCache.getFileCache(file).frontmatter` for each file in `app.vault.getMarkdownFiles()`. Keep a `Map` from note path to that note's reminders. Build it once after `workspace.onLayoutReady`, then update one entry at a time from the events `metadataCache.on('changed')`, `metadataCache.on('deleted')` and `vault.on('rename')`.

Considered: reading and parsing each file with `vault.cachedRead`. Dropped because it reads 10,000 files from disk when Obsidian has already parsed them (NFR-01, NFR-04). Also considered Dataview's index, dropped because the plugin must not depend on another plugin (Stage 3, Integrations).

Why: the cache is in memory, so the first scan is a loop over objects with no disk access (NFR-01). The `changed` event fires for edits made inside Obsidian and by sync tools alike (FR-SCHED-01). Only `.md` files appear in `getMarkdownFiles()` (FR-SCOPE-05).

Landmines:

- The `changed` event does not fire on rename (stated in the type definitions), so rename needs its own handler (FR-SCHED-02). The same handler updates the folder list when a chosen folder is renamed (FR-SCOPE-04).
- Property names are compared in lower case, because the cache keeps the case the user typed (FR-SRC-07).
- A time such as `09:30` in a pair source may reach the plugin as a number, since some YAML parsers read `H:MM` as base 60. The parser accepts a minute count (570 for 09:30) as well as a string. M0 checks what Obsidian returns.

## Scheduler

Chosen: one `window.setInterval` every 5 seconds, registered with `registerInterval`. Each tick reads the device clock, fires every indexed reminder due after the stored timestamp and at or before now, then stores now as the new timestamp.

Considered: one `setTimeout` per reminder. Dropped because timers stall while a laptop sleeps and a phone app is in the background, a delay over 24.8 days overflows, and 1,000 timers need cancelling on every edit.

Why: comparing against the wall clock makes sleep, wake and a backgrounded phone the same case as a normal tick, with no wake detection code (FR-SCHED-06, FR-MISSED-01). A 5 second tick meets "within 10 seconds of its minute starting" (NFR-01). Scanning 1,000 reminders every 5 seconds costs well under a millisecond (NFR-04).

A reminder fired more than 5 minutes late is labelled "Missed". If one tick finds more than five late reminders it sends the summary instead (FR-MISSED-02).

## Date and time parsing

Chosen: a hand-written parser of about 30 lines. Two regular expressions (one for `YYYY-MM-DD[T ]HH:mm[:ss]` with an optional offset, one for `HH:mm` and `h:mm AM`) feed `new Date(year, month, day, hour, minute)`. Times are shown with `Intl.DateTimeFormat` in the device locale.

Considered: `moment`, which Obsidian exports. Dropped because the `obsidian` npm package holds types only, so any module that imports it cannot run in a unit test without a mock. Also considered `Date.parse`, dropped because it reads date-only strings as UTC and accepts loose input.

Why: the formats are fixed and few (FR-SRC-05, FR-SRC-06), and this is the logic most worth testing. A parser with no imports is tested directly.

## System notification on desktop

Chosen: Electron's main-process `Notification`, reached through `window.require('electron').remote`, behind `Platform.isDesktopApp`. On click, the handler calls `remote.getCurrentWindow()` to bring the window to the front (restoring it first if it is minimised), then opens the note. The Electron surface the plugin uses is declared in one typed file.

Considered: the web `Notification` API in the renderer. It needs no Electron access to show a notification, but focusing the window on click still does. Kept as the fallback if `remote` is missing.

Why: this is the path the uphy Reminder plugin ships to 342,212 downloads, so it is known to work on the three desktop systems (FR-NOTIFY-01, FR-OPEN-01). The title is the note name passed through unchanged (FR-NOTIFY-05). Each reminder gets its own notification object (FR-NOTIFY-04).

Landmines:

- Electron gives no way to ask macOS whether the user has blocked notifications for Obsidian. The plugin can tell "not supported" (`Notification.isSupported()` is false) and "failed to show" (the `failed` event, Windows only, per the [Electron docs](https://www.electronjs.org/docs/latest/api/notification)). It cannot tell "blocked in System Settings". FR-NOTIFY-03 was reworded for this on 2026-10-12.
- `remote` is an Obsidian internal with no API guarantee. All use sits in one file with a check for `undefined`, and the in-app notice is the fallback.

## In-app notice

Chosen: Obsidian's `Notice` with a duration of 0, which stays until clicked. The click handler opens the note. Used on mobile, and on desktop when the system notification is unavailable.

Considered: a custom floating element. Dropped because `Notice` already stacks, themes itself and works on a phone.

Why: FR-NOTIFY-02, FR-NOTIFY-03, FR-OPEN-03.

## Opening the note

Chosen: look through `workspace.iterateAllLeaves` for a Markdown view on that file and reveal it with `workspace.revealLeaf`. If none is found, `workspace.getLeaf('tab').openFile(file)`. The notification keeps the `TFile` object, which Obsidian updates in place on rename.

Considered: `workspace.openLinkText`. Dropped because it reuses the active tab by default and resolves by name, which can pick the wrong note when two share a name.

Why: FR-OPEN-02, FR-OPEN-04. A deleted file is detected by `vault.getAbstractFileByPath` returning null.

## Missed reminders list

Chosen: Obsidian's `SuggestModal`, listing note names with their due times, oldest first.

Considered: a custom `Modal` with a hand-built list. Dropped because `SuggestModal` gives keyboard movement, type-to-filter and phone layout for free.

Why: FR-MISSED-02.

## Settings UI and storage

Chosen: a `PluginSettingTab` built from `Setting` rows. Folder suggestions use `AbstractInputSuggest` (since 1.4.10). Settings are saved with `saveData` on every change and merged over defaults with `loadData`. `onExternalSettingsChange` (since 1.5.7) reloads them when a sync tool rewrites `data.json`.

Considered: a framework such as Svelte for the tab. Dropped because the tab is two lists and two buttons.

Why: FR-SET-01 to FR-SET-09, NFR-06. Obsidian's own components carry keyboard and screen-reader support.

## Device state

Chosen: `app.saveLocalStorage('property-reminders:last-check', timestamp)`. Obsidian keys it by vault and it never leaves the device.

Considered: a second file in the plugin folder. Dropped because sync tools copy the whole plugin folder.

Why: FR-MISSED-03, FR-MISSED-04.

## Testing

Chosen: Node's built-in test runner (`node --test`) on the pure modules: the parser, the scope check and the "what is due" rule. Node 22.23 on this machine runs `.ts` files directly. Everything that touches Obsidian is checked by hand in a test vault against the acceptance lines in Stage 3.

Considered: Vitest 5.0.3. Held as the fallback if running `.ts` under Node needs import changes the linter rejects. Also considered mocking the Obsidian API for end-to-end tests, dropped as more code than the plugin.

Why: no new dependency, and the logic that can be wrong without anyone noticing (dates, scope, fire-once) is all pure.

## CI/CD

Chosen: the two GitHub Actions workflows already in the repo. `lint.yml` runs ESLint on every commit and gains a test step. `release.yml` builds and attaches `main.js`, `manifest.json` and `styles.css` when a tag is pushed.

Why: NFR-07.

Landmine: the repo began with `obsidianmd/obsidian-sample-plugin` as its remote. Since 2026-10-12 the remote is `github.com/Abdulkader-Safi/obsidian-reminder-plugin`, branch `main`.

## Distribution

Chosen: GitHub releases with a tag equal to the manifest version and no leading `v`, then a submission to the Obsidian community directory.

Why: Stage 1 success signal (catalog listing within three months).

Landmines, from the submission page: the plugin ID cannot contain "obsidian" (`property-reminders` passes), the repo root needs `README.md`, `LICENSE` and `manifest.json`, and the directory reads the manifest on the default branch.

## Layers that do not apply

Backend, database, auth, hosting, file storage, AI, email, payments, search and analytics: none. The plugin is local code inside Obsidian with no accounts and no network (NFR-02).

## Reused from existing work

- The sample plugin in this repo: build script, ESLint config, version bump script, both workflows.
- The uphy Reminder plugin (MIT) as a reference for the Electron notification calls. No code is copied.

## Cost

Zero to run. No hosting, APIs or paid licences.

## Licensing

The project is MIT, replacing the sample's 0-BSD `LICENSE` file. Nothing is bundled into `main.js` except the plugin's own code. Build tools are MIT or Apache-2.0 and are not shipped.

## Top technical risks

1. **System notification and click-to-focus** : it relies on an Obsidian internal (`remote`) and behaves differently on each desktop system. M0 is a throwaway plugin that fires one notification and opens a note on click, tried on macOS first, with Obsidian minimised and in the background.
2. **Reminders lost at startup** : if the missed check runs before the metadata cache has indexed every file, a late-indexed note looks like it has no reminder, and the timestamp moves past it. The first tick waits for the cache's `resolved` event. M0 logs how long that takes on a large vault.
3. **Time values in pair sources** : a time may arrive as a number. M0 prints what the cache holds for `startTime: 09:30`, `startTime: 14:30` and a quoted `"09:30"`.
4. **Blocked notifications cannot be detected** : a user who blocked Obsidian's notifications gets silence. The test button (FR-SET-08) and the README are the only defence, so M0 confirms the button shows nothing when blocked and the text beside it reads clearly.

---

### Open questions

None.

### Assumptions confirmed

1. **Blocked notifications : RESOLVED.** FR-NOTIFY-03 is reworded in Stage 3: the plugin falls back to the in-app notice when system notifications are not supported or fail to show, and does not claim to detect a block. The test button FR-SET-08 is now a Must. The README says where to allow notifications on each system.
2. **GitHub repo and author : RESOLVED.** The public repo `github.com/Abdulkader-Safi/obsidian-reminder-plugin`, which Safi created on 2026-10-12, with `author` set to "Abdulkader Safi" in the manifest. The repo name differs from the plugin ID, which stays `property-reminders`.
3. **Test runner : RESOLVED.** Node's built-in runner, with Vitest as the fallback.
4. **Toolchain : RESOLVED.** The sample plugin's pinned TypeScript, esbuild and ESLint versions stay. `minAppVersion` is 1.8.7.
