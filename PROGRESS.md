# Progress

Build log for Property Reminders. The plan is `docs/spec/06-build-spec.md`.

## Milestones

- M0 de-risk: partly done, two checks need Safi (see below)
- M1 foundation and pure logic: not started
- M2 index, scheduler and in-app notice: not started
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

## Decisions and deviations

- 2026-10-12: the GitHub repo is `Abdulkader-Safi/obsidian-reminder-plugin`, not `property-reminders` as first written. The plugin ID is unchanged. Spec stages 04 and 06 are updated.
- 2026-10-12: commit after each step and push to `origin main`, at Safi's request. The spec said once per milestone with no push.
- 2026-10-12: M1 starts before the M0 click check is confirmed. M1 is the rename and the pure logic, and neither depends on the answer. M3 does, and will not start without it.
