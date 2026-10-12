# Progress

Build log for Property Reminders. The plan is `docs/spec/06-build-spec.md`.

## Milestones

- M0 de-risk: partly done, two checks need Safi (see below)
- M1 foundation and pure logic: done, except the folder rename, which needs Safi
- M2 index, scheduler and in-app notice: built, 15 boxes ticked, the rest need a person or a second device
- M3 system notification and missed summary: not started
- M4 settings tab: not started
- M5 release readiness: not started

## M0 results (2026-10-12)

Run against the live Obsidian 1.14.4 (Electron 43.7.7, macOS) in the `plugins` vault, through `obsidian eval`. No spike plugin was written: the CLI runs the same code inside the app.

### 1. System notification and click-to-focus

- `window.require('electron').remote` exists and `remote.Notification.isSupported()` is true.
- A notification with an Arabic title showed, and its `show` event fired.
- `win.restore()` brings a minimised window back.
- Not proven: focus. Calling `win.show()`, `win.focus()` and `remote.app.focus({ steal: true })` from code while another app was in front left `win.isFocused()` false. macOS does not let a background app take focus on its own. A real click on a notification is a user action, which macOS treats differently, so this needs a person.

Check for Safi: a notification titled "Property Reminders test" is in Notification Center. Click it with another app in front. Obsidian should come forward. The click handler records the result in `window.__m0.log` inside Obsidian.

### 2. What the cache holds for time values

All strings. The base 60 worry in Stage 4 does not apply.

| Property line | Cached value |
|---------------|--------------|
| `reminder: 2026-10-14T09:30` | string `2026-10-14T09:30` |
| `reminder: 2026-10-14T09:30:00` | string `2026-10-14T09:30:00` |
| `reminder: 2026-10-14 09:30` | string `2026-10-14 09:30` |
| `date: 2026-10-14` | string `2026-10-14` |
| `startTime: 09:30` | string `09:30` |
| `startTime: 14:30` | string `14:30` |
| `startTime: "09:30"` | string `09:30` |
| `startTime: 9:30 AM` | string `9:30 AM` |
| `empty:` | `null` |

The cache keeps the property name's case as typed (`ReminderCase` stayed `ReminderCase`), so the lower-case comparison is needed.

Decision: `parsePair` takes strings only. No minute-count branch.

### 3. Cache readiness

- `getFileCache` returns `null` for a file that has just been created, and the `changed` event arrived 15 ms later. The startup gate's test (count the in-scope files with no cache entry) works as designed.
- Not measured: how long a 10,000-note vault takes after layout ready. This vault has 25 notes. Measured in M5 with the generated vault. The gate's 60 second limit stays until then.

### 4. Blocked notifications

Not tested. It needs notifications switched off for Obsidian in System Settings.

Check for Safi, during M3: turn notifications off for Obsidian, press "Send test notification", and confirm nothing appears and no error is shown.

## M1 results (2026-10-12)

- The plugin is renamed in `manifest.json`, `package.json` and `versions.json`. The licence is MIT. The sample code and `styles.css` are gone.
- `settings.ts`, `parse.ts`, `scope.ts` and `due.ts` are written with 36 unit tests. `npm test`, `npm run lint` and `npm run build` pass.
- Relative imports carry the `.ts` extension so that Node can run the tests with no build step. `tsconfig.json` has `allowImportingTsExtensions` for this.
- CI no longer runs on Node 20, which cannot run `.ts` test files.
- ESLint turns off two plugin-only rules for `tests/`.

Check for Safi: the plugin folder is still named `obsidian-reminder-plugin` while the ID is `property-reminders`. Obsidian loads it anyway. To rename it, quit Obsidian, rename the folder to `property-reminders`, and reopen.

## M2 results (2026-10-12)

Built: `reminder-index.ts`, `scheduler.ts`, `notify.ts` (in-app notice only), `open-note.ts`, and `missed-modal.ts`, which the plan had in M3 but the scheduler needs for its summary. The plugin is enabled in the `plugins` vault.

Checked in the live Obsidian through `obsidian eval`, using notes in a temporary folder that has since been deleted:

- Three notes due in the same minute gave three notices, 8 seconds into the minute. Each opened its own note in a new tab, and the note already open stayed in its tab.
- A note with `Reminder:` (capital R) fired. A note with an Arabic name showed its name unchanged.
- A value 10 minutes in the past fired nothing. A date with no time and `tomorrow 9am` fired nothing and were listed as unreadable.
- A note deleted before its time did not fire. A note renamed before its time fired under its new name.
- A note with `reminder` and `due` in the same minute gave one notice. A pair source (`date` and `startTime`) fired.
- With scope set to one folder, a note in another folder did not fire.
- A note written from the shell, outside Obsidian, fired.
- A reminder that had fired was changed to a new time and fired again.
- With the timestamp wound back two hours and the plugin reloaded, two late reminders showed as "Missed". A second reload showed nothing.
- With eight late reminders, one notice read "8 missed reminders". It opened a list ordered oldest first, and choosing a row opened that note.
- Clicking the notice of a deleted note showed "Note not found: Send invoice".
- Disabling the plugin closed its open notices.

Not checked, and left unticked:

- FR-SRC-03: two sources on one note at different times. Unit tests cover it.
- FR-SCHED-01: clearing a property on a pending reminder.
- FR-SCHED-02: moving a note out of the chosen folders before its time.
- FR-SCHED-04: a body edit after firing.
- FR-SCHED-05: adding a source over 300 old dates.
- FR-SCHED-06: sleep and wake. Needs the laptop to sleep.
- FR-MISSED-01: a real quit and restart. Only a plugin reload was tried, which skips the wait for Obsidian's index.
- FR-MISSED-03: needs a second device on the same vault.
- FR-NOTIFY-02 and FR-OPEN-03: need a phone.
- FR-OPEN-04: renaming a note after its notice appeared.

## Decisions and deviations

- 2026-10-12: the GitHub repo is `Abdulkader-Safi/obsidian-reminder-plugin`, not `property-reminders` as first written. The plugin ID is unchanged. Spec stages 04 and 06 are updated.
- 2026-10-12: commit after each step and push to `origin main`, at Safi's request. The spec said once per milestone with no push.
- 2026-10-12: M1 starts before the M0 click check is confirmed. M1 is the rename and the pure logic, and neither depends on the answer. M3 does, and will not start without it.
- 2026-10-12: `missed-modal.ts` and the summary notice were built in M2, not M3. Without them the scheduler had nowhere to send more than five late reminders.
- 2026-10-12: `authorUrl` in the manifest is the GitHub profile `https://github.com/Abdulkader-Safi`. The spec did not name one.
