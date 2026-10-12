# Progress

Build log for Property Reminders. The plan is `docs/spec/06-build-spec.md`.

## Milestones

- M0 de-risk: partly done, two checks need Safi (see "Checks for Safi")
- M1 foundation and pure logic: done, except the folder rename, which needs Safi
- M2 index, scheduler and in-app notice: built, 15 boxes ticked, the rest need a person or a second device
- M3 system notification and missed summary: built, not ticked. Every box needs a person to see or click the notification
- M4 settings tab: built, 7 boxes ticked, 2 need a person
- M5 release readiness: README and the test-vault script are written. 1.0.0 released at Safi's request with the performance run and most manual checks still open

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

## M3 and M4 results (2026-10-12)

Built: the Electron notification path in `notify.ts` with the in-app notice as its fallback, `settings-tab.ts`, and `onExternalSettingsChange` in `main.ts`.

Checked in the live Obsidian:

- The settings tab shows scope, the folder list, the property rows, the status section and the test button.
- Typing `CR` in the folder field suggested `CRM` and its subfolders. Choosing `CRM` and pressing Add added a row. Adding it again showed "This folder is already in the list." The remove button deleted a row. A folder that does not exist showed "(missing)".
- A duplicate property showed "This property is already in the list." and was not saved. A new property `due` was saved to `data.json`.
- Both empty-state lines appear.
- Scope, folders and sources were unchanged after the plugin was disabled and enabled again.
- The status section read "1 reminder scheduled" and listed a date-only note as "no time set".
- "Send test notification" ran with no error and without falling back to the in-app notice.

Not checked: whether the system notification was visible, and what a click on it does. Nobody was watching the screen.

`npm run lint` reported no errors and one warning, `prefer-setting-definitions`. Fixed in 1.0.1.

## M5 so far (2026-10-12)

- `README.md` is written in full.
- `tests/make-vault.mjs` writes a test vault. It was tried with 300 notes and refuses to write into a folder that is not empty.
- Not done: the performance run. It needs the 10,000-note vault opened in Obsidian as its own vault, with the plugin copied in.

To run it: `node tests/make-vault.mjs ~/Desktop/pr-perf-vault`, open that folder as a vault in Obsidian, copy `main.js` and `manifest.json` into its `.obsidian/plugins/property-reminders/` folder, and enable the plugin.

## Release 1.0.0 (2026-10-12)

Safi asked for release 1.0.0 so the plugin can be submitted to the community directory.

- Safi saw the system notifications from four test notes in the `Reminder test` folder. FR-NOTIFY-01 is ticked on that.
- Still not confirmed: that clicking a notification brings Obsidian to the front (FR-OPEN-01), and checks 3 to 7 below. Tested on macOS only. The performance run has not been done.
- The local tag `1.0.0` came with the sample plugin's history (a 2020 commit by its author). It was never on this repo's remote. It was replaced with a tag on the release commit.
- Known issue: a pair source such as `date` + `startTime` lists every note that has the day property without a readable time as unreadable. In a vault where `date` is a common property, that list gets noisy. Nothing fires wrongly.

## Release 1.0.1 (2026-10-12)

Obsidian's submission scan warned that the settings tab did not implement `getSettingDefinitions()`, so its settings would not appear in settings search on 1.13.0 and later.

- The tab now describes its rows once and offers them two ways: through `getSettingDefinitions()` for Obsidian 1.13.0 and later, and drawn by hand in `display()` for older versions. `minAppVersion` stays 1.8.7.
- Layout changes that came with it: each property row is named "Property 1", "Property 2" and so on, the folder list has a "Folders" heading, and the scheduled count and the unreadable list share one row.
- Obsidian keeps the definitions it was last given, so the tab is refreshed when settings change outside it (a sync tool rewriting `data.json`, a chosen folder being renamed).
- Checked in the live Obsidian 1.14.4: the declarative tab renders, adding and removing rows works, a duplicate property is rejected, a renamed folder shows under its new name, and an external settings change shows at once. The by-hand drawing was checked by calling it directly. It has not been run inside an Obsidian older than 1.13.0.
- `npm run lint` now reports no errors and no warnings.

## Checks for Safi

1. Click-to-focus (M0, FR-OPEN-01). Open **Settings → Community plugins → Property Reminders** and press **Send**. Switch to another app, then click the notification. Obsidian should come to the front.
2. A real reminder (FR-NOTIFY-01). Add `reminder` to a note, two minutes ahead, switch to another app and wait. Click the notification: Obsidian should come forward with that note open.
3. Minimised window (FR-OPEN-01). Repeat check 2 with Obsidian minimised.
4. Blocked notifications (FR-SET-08). Turn notifications off for Obsidian in System Settings, press **Send**, and confirm nothing appears and no error shows.
5. Restart (FR-MISSED-01). Set a reminder two minutes ahead, quit Obsidian, wait five minutes, reopen. One "Missed" notification should appear. Quit and reopen again: nothing.
6. Sleep (FR-SCHED-06). Set a reminder a few minutes ahead, close the laptop lid past that time with Obsidian open, then open it. The reminder should fire within 30 seconds.
7. Folder rename. Quit Obsidian, rename the plugin folder to `property-reminders`, reopen.

## Decisions and deviations

- 2026-10-12: the GitHub repo is `Abdulkader-Safi/obsidian-reminder-plugin`, not `property-reminders` as first written. The plugin ID is unchanged. Spec stages 04 and 06 are updated.
- 2026-10-12: commit after each step and push to `origin main`, at Safi's request. The spec said once per milestone with no push.
- 2026-10-12: M1 started before the M0 click check was confirmed. M1 is the rename and the pure logic, and neither depends on the answer.
- 2026-10-12: `missed-modal.ts` and the summary notice were built in M2, not M3. Without them the scheduler had nowhere to send more than five late reminders.
- 2026-10-12: `authorUrl` in the manifest is the GitHub profile `https://github.com/Abdulkader-Safi`. The spec did not name one.
- 2026-10-12: an invalid property row is not saved at all, and the row keeps what was typed. Stage 5 said the saved setting keeps its last valid value. Stage 3 (FR-SET-05) says the source is not saved, and that is what is built.
- 2026-10-12: M3 was built before the click check came back. The notification shows either way and the in-app notice is the fallback, so the code does not depend on the answer. The check is now easier to run from the real plugin (check 1 above).
- 2026-10-12: clicking a note in the unreadable list opens it behind the settings window. Closing settings from a plugin needs an internal Obsidian API, which is avoided.
