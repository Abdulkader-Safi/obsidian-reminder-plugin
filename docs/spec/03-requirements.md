# Functional requirements

Status: signed off 2026-10-12

> **Changes:** 2026-10-12: FR-NOTIFY-03 no longer promises to detect blocked notifications, because Electron cannot report a block set in macOS System Settings (found in stage 04). FR-SET-08, the test button, moves from Should to Must so the user can check.

Requirements say what the product must do, not how. Tech choices are in Stage 4. Each traces to the product (Stage 1) and the journey or core loop (Stage 2).

Terms used below:

- A **source** is one entry in settings that tells the plugin where a reminder's day and time live. A single source names one property that holds both. A pair source names two properties: one for the day, one for the time.
- A **reminder** is one note plus one source whose values give a readable day and time.
- **In scope** means the note is a Markdown file inside the folders chosen in settings (or anywhere, if the scope is the whole vault).
- **Due** means the reminder's day and time, read as the device's local time, has arrived.

## Core features (MVP)

### Reminder sources (SRC)

- **FR-SRC-01 [Must]** The plugin must read a reminder from a single property that holds a day and a time.
  *Acceptance:* given the default source `reminder` and a note with `reminder: 2026-10-14T09:30`, when the device clock reaches 09:30 on 14 October 2026, then one notification fires for that note.
- **FR-SRC-02 [Must]** The plugin must read a reminder from a pair of properties, one holding the day and one holding the time.
  *Acceptance:* given a pair source with day property `date` and time property `startTime`, and a note with `date: 2026-10-14` and `startTime: 09:30`, when the clock reaches 09:30 on 14 October 2026, then one notification fires for that note.
- **FR-SRC-03 [Must]** The plugin must watch every source listed in settings at the same time, and treat each one independently.
  *Acceptance:* given the sources `reminder` and `due`, a note with `reminder` at 09:00 and another note with `due` at 09:05 each fire at their own time. A single note carrying both fires twice, once per source.
- **FR-SRC-04 [Must]** A reminder must have both a day and a time. A day with no time must never fire.
  *Acceptance:* given a note with `reminder: 2026-10-14`, or a pair source where the day is filled and the time is empty, then no notification fires on 14 October, and the note is counted as unreadable (FR-SET-07).
- **FR-SRC-05 [Must]** The plugin must accept the formats Obsidian itself writes: `YYYY-MM-DDTHH:mm` and `YYYY-MM-DDTHH:mm:ss` for a single property, `YYYY-MM-DD` for the day in a pair, `HH:mm` (24-hour) for the time in a pair.
  *Acceptance:* each of those values, typed by hand or set with Obsidian's picker, produces a reminder at the stated minute. A value such as `tomorrow 9am` produces no reminder and is counted as unreadable.
- **FR-SRC-06 [Should]** The plugin should also accept a space in place of the `T` (`2026-10-14 09:30`) and a 12-hour time in a pair (`9:30 AM`).
- **FR-SRC-07 [Must]** Property names must match without regard to letter case, the same way Obsidian treats property names.
  *Acceptance:* given the source `reminder`, a note with `Reminder: 2026-10-14T09:30` fires.
- **FR-SRC-08 [Must]** If two sources on the same note give the same minute, the plugin must fire one notification for that note, not two.
  *Acceptance:* given sources `reminder` and `due`, and a note with both set to `2026-10-14T09:30`, one notification fires.

### Scope: whole vault or chosen folders (SCOPE)

- **FR-SCOPE-01 [Must]** By default the plugin must read reminders from every Markdown note in the vault.
  *Acceptance:* on a fresh install with no settings changed, a note in any folder with a valid `reminder` fires.
- **FR-SCOPE-02 [Must]** The user must be able to limit the plugin to one or more chosen folders. A chosen folder includes all of its subfolders.
  *Acceptance:* given scope "Specific folders" with `Projects` and `Calendar`, a note at `Projects/Client A/invoice.md` fires, a note at `Calendar/2026-10-14 call.md` fires, and a note at `Archive/old.md` does not.
- **FR-SCOPE-03 [Must]** A change of scope must apply at once, with no restart.
  *Acceptance:* given a pending reminder in `Archive/old.md`, when the user switches to "Specific folders" without `Archive`, then that reminder does not fire. When they add `Archive`, a reminder there that is still in the future fires at its time.
- **FR-SCOPE-04 [Should]** When a chosen folder is renamed or moved inside Obsidian, the setting should follow it. When a chosen folder is deleted, its entry should stay in the list, marked as missing.
- **FR-SCOPE-05 [Must]** Only Markdown notes are read. Canvas files, Bases files and attachments are ignored.
  *Acceptance:* a `.canvas` or `.base` file never produces a reminder.

### Keeping reminders up to date (SCHED)

- **FR-SCHED-01 [Must]** The plugin must pick up a reminder that is added, changed or removed while Obsidian is running, with no restart and no command.
  *Acceptance:* given Obsidian running, when the user sets `reminder` to two minutes from now and does nothing else, then the notification fires at that minute. When they then clear the property on another note before its time, that note does not fire. This also holds when the file is changed from outside Obsidian (a sync client or another editor).
- **FR-SCHED-02 [Must]** A reminder must survive its note being renamed or moved, and must follow the scope rules at its new location.
  *Acceptance:* a note renamed before its time still fires and the notification shows the new name. A note moved out of the chosen folders before its time does not fire.
- **FR-SCHED-03 [Must]** Deleting a note must cancel its reminders.
  *Acceptance:* a note deleted before its time never fires.
- **FR-SCHED-04 [Must]** A reminder must fire once. Changing its value to a new future time must arm it again.
  *Acceptance:* after a reminder fires, restarting Obsidian or editing the note body does not fire it again. Changing `reminder` to a time one hour ahead fires once more at that time.
- **FR-SCHED-05 [Must]** A reminder whose time is already in the past when it is set, or when it first comes into scope, must not fire.
  *Acceptance:* at 10:00, typing `reminder: 2026-10-14T09:30` on 14 October fires nothing. Adding a new source `due` to a vault with 300 old `due` dates fires nothing for the old ones.
- **FR-SCHED-06 [Must]** A reminder that comes due while the computer is asleep must fire when it wakes.
  *Acceptance:* given a reminder at 09:30 and a laptop asleep from 09:00 to 10:00 with Obsidian left open, a notification fires within 30 seconds of waking, labelled as missed (FR-MISSED-01).

### Notification (NOTIFY)

- **FR-NOTIFY-01 [Must]** On desktop the plugin must send a system notification when a reminder is due. The heading is the note's name without `.md`. The second line is the word "Reminder" and the reminder time in the device's locale format.
  *Acceptance:* on each desktop platform in NFR-05, a due reminder on `Send invoice.md` shows a notification in the operating system's notification area with the heading "Send invoice" while Obsidian is in the background.
- **FR-NOTIFY-02 [Must]** On mobile the plugin must show an in-app notice with the same two lines. The notice must stay on screen until the user taps or dismisses it.
  *Acceptance:* on iOS and Android with Obsidian open, a due reminder shows a notice that is still visible 60 seconds later.
- **FR-NOTIFY-03 [Must]** If system notifications are not supported or fail to show on desktop, the plugin must fall back to the same in-app notice, and tell the user once per session. The plugin cannot detect notifications blocked in the operating system's settings: the test button (FR-SET-08) and the README cover that case.
  *Acceptance:* with the system notification call made to report "not supported" or to fail, a due reminder shows an in-app notice, and the first one of the session is followed by a notice saying system notifications are unavailable.
- **FR-NOTIFY-04 [Must]** Reminders on different notes that are due in the same minute must each get their own notification.
  *Acceptance:* three notes due at 09:30 produce three notifications, each opening its own note.
- **FR-NOTIFY-05 [Must]** The note's name must be passed to the notification unchanged, in any script.
  *Acceptance:* a note named `اجتماع العميل.md` shows that exact text as the heading, in the correct reading direction.

### Opening the note (OPEN)

- **FR-OPEN-01 [Must]** Clicking the system notification must bring the Obsidian window to the front and show the note.
  *Acceptance:* with Obsidian minimised and another app focused, clicking the notification makes Obsidian the front window with the note visible and focused.
- **FR-OPEN-02 [Must]** If the note is already open in a tab, the plugin must switch to that tab. Otherwise it must open the note in a new tab. It must not replace the note the user was working in.
  *Acceptance:* with note A open and being edited, clicking a notification for note B leaves A open in its tab and shows B in another.
- **FR-OPEN-03 [Must]** Tapping the in-app notice must open the note in the same way.
  *Acceptance:* on mobile, tapping the notice shows the note.
- **FR-OPEN-04 [Must]** If the note was renamed or moved after the notification fired, clicking must still open it. If it was deleted, the plugin must show a notice saying the note no longer exists.
  *Acceptance:* rename the note after the notification appears, then click: the renamed note opens. Delete it, then click: a notice reads "Note not found: Send invoice".

### Missed reminders (MISSED)

- **FR-MISSED-01 [Must]** When Obsidian starts, or the computer wakes, the plugin must fire each reminder that came due since the plugin last ran on this device. Each fires once. The second line reads "Missed" with the day and time it was due.
  *Acceptance:* quit Obsidian at 09:00 with a reminder at 09:30, start it at 11:00: one notification fires within 10 seconds of the workspace loading, reading "Missed" and "09:30". Restart again: nothing fires.
- **FR-MISSED-02 [Must]** If more than five reminders were missed, the plugin must send one summary notification in place of separate ones. Clicking it must show a list of the missed notes, each of which opens its note.
  *Acceptance:* with 12 reminders missed over a weekend, one notification reads "12 missed reminders". Clicking it opens a list of 12 note names with their due times, ordered oldest first. Choosing one opens that note.
- **FR-MISSED-03 [Must]** Missed reminders must be tracked per device.
  *Acceptance:* with a vault synced between a laptop and a phone, a reminder that already fired on the laptop still shows as missed on the phone the next time the phone opens Obsidian, and the other way round.
- **FR-MISSED-04 [Must]** The first time the plugin is enabled on a device, reminders dated before that moment must not fire.
  *Acceptance:* enabling the plugin in a vault with 50 past `reminder` values fires nothing.

### Settings (SET)

- **FR-SET-01 [Must]** The plugin must have a settings tab with a scope choice: "Whole vault" or "Specific folders".
  *Acceptance:* the tab appears under **Settings → Community plugins → Property Reminders** and the choice is "Whole vault" on a fresh install.
- **FR-SET-02 [Must]** With "Specific folders" chosen, the user must be able to add folders from a suggestion list of the vault's folders, and remove any folder from the list.
  *Acceptance:* typing `Pro` suggests `Projects`. Choosing it adds a row. The row's remove button deletes it. The same folder cannot be added twice.
- **FR-SET-03 [Must]** With "Specific folders" chosen and no folders in the list, the tab must say that no notes are being watched.
  *Acceptance:* an empty list shows the text "No folders chosen. No reminders will fire."
- **FR-SET-04 [Must]** The user must be able to add and remove sources, and edit any source in the list. Each source is either "One property (day and time)" with one name, or "Two properties" with a day name and a time name.
  *Acceptance:* the default list holds one source, `reminder`. Adding a pair source `date` + `startTime` makes notes with those properties fire. Removing it stops them.
- **FR-SET-05 [Must]** The tab must reject a source with an empty name, a duplicate of an existing source, or a pair that uses the same name for both parts.
  *Acceptance:* each of those three cases shows an inline message and the source is not saved.
- **FR-SET-06 [Must]** Every setting must be saved as it is changed, apply at once, and still be there after Obsidian restarts.
  *Acceptance:* change scope and sources, restart Obsidian, reopen the tab: the values are unchanged.
- **FR-SET-07 [Should]** The tab should show how many reminders are scheduled, and list the in-scope notes whose values are unreadable (a day with no time, or a format the plugin cannot read). Each listed note opens when clicked.
- **FR-SET-08 [Must]** The tab must have a "Send test notification" button that fires a sample notification straight away, so the user can check that the operating system allows it. The text beside it must say where to allow notifications for Obsidian if nothing appears.
  *Acceptance:* clicking the button shows a system notification within 2 seconds on desktop, or an in-app notice on mobile. With notifications blocked for Obsidian in the operating system, nothing appears and the text beside the button tells the user where to allow them.
- **FR-SET-09 [Must]** The settings tab must be usable on a phone screen.
  *Acceptance:* on a 375 pt wide screen every control is reachable and no row is cut off.

## Standard states

- Undo and redo: out of scope. The plugin never edits notes, and a settings change is reversed by changing it back.
- Empty states: FR-SET-03 (no folders), FR-SET-07 (zero scheduled).
- Loading and progress: out of scope. The first scan is short enough to need no progress display (NFR-01).
- Error states and messages: FR-NOTIFY-03 (notifications unavailable), FR-SET-08 (test button), FR-OPEN-04 (note gone), FR-SET-05 (bad source), FR-SET-07 (unreadable values).
- Confirm before destructive actions: out of scope. Removing a folder or a source deletes no data, and adding it back restores the behaviour.
- Autosave: FR-SET-06.
- Search and filter: FR-SET-02 (folder suggestions). Nothing else to search in v1.
- Keyboard shortcuts: out of scope. The plugin adds no commands in v1.
- Settings that persist: FR-SET-06.
- First-run and onboarding: FR-MISSED-04 (no flood on install), FR-NOTIFY-03 (permission). No onboarding screen: the defaults work untouched.
- Offline behaviour: NFR-03. The plugin never needs a connection.
- Permissions per role: out of scope. Single user.
- Notifications: FR-NOTIFY-01 to FR-NOTIFY-05.
- Import and export: out of scope. Reminders are properties in the user's own notes.
- Delete and restore: FR-SCHED-03. A note restored from trash with a future reminder is picked up by FR-SCHED-01.
- Audit log: out of scope. No history of fired reminders is kept in v1.
- Multi-language and RTL: FR-NOTIFY-05 for note names. Plugin text is English only (NFR-06).
- Accessibility: NFR-06.
- Mobile layout: FR-SET-09.
- Rate limits and quotas: FR-MISSED-02 (cap on startup notifications).

## Account and auth

None. It is a local plugin for a single user, with no server.

## Data the product handles

There are four kinds of data.

Settings hold the scope choice, the folder list and the source list. They are stored in the plugin's own data file in the vault's config folder, owned by the user and kept until the plugin is removed. The user's sync tool may copy them between devices.

A reminder is a note path, the source it came from and the due time. Reminders are worked out from the notes each time Obsidian starts. They are held in memory only and never written to disk.

Device state is the moment the plugin last checked for due reminders on this device. It is stored on the device, outside any synced file (FR-MISSED-03), and kept until the plugin is removed.

Notes are read only. The plugin reads properties and file paths. It never reads note bodies and never writes to a note.

## Integrations

No external systems. The plugin has no code that depends on another plugin. It must work alongside these, because they create the notes it reads:

- Kanban with a note per card. Cards that are notes carry the property. Nothing flows back.
- Full Calendar style plugins. Event notes carry a day property and a start-time property, read through a pair source.
- Bases (core). The user builds their own upcoming list over the same properties. The plugin does nothing here except leave the values untouched.
- Templater and core templates. New notes arrive with the property already filled, and FR-SCHED-01 picks them up.

## Non-functional requirements

- NFR-01 (performance). On a 16 GB M1 MacBook with a 10,000-note vault, the first scan finishes within 2 seconds and starts only after the workspace has loaded, so plugin load adds under 50 ms to Obsidian's startup. A due reminder fires within 10 seconds of its minute starting. A changed note is reflected within 5 seconds.
- NFR-02 (privacy and security). No network requests of any kind and no telemetry. The plugin reads only properties and paths, and writes nothing to notes. Nothing leaves the device.
- NFR-03 (offline). Works fully offline. Runs only while Obsidian is running, and says so in the README.
- NFR-04 (scale). 10,000 notes and 1,000 pending reminders with no visible slowdown while typing in a note.
- NFR-05 (platforms). Obsidian desktop (macOS, Windows, Linux) and Obsidian mobile (iOS, Android). `isDesktopOnly` is false.
- NFR-06 (accessibility and language). The settings tab is fully usable by keyboard, every button has a text label for screen readers, and it follows the user's theme and font size. Plugin text is English.
- NFR-07 (catalog readiness). `npm run lint` passes with zero errors under `eslint-plugin-obsidianmd`. Disabling the plugin stops all timers and listeners, and no notification fires afterwards.

## Out of scope for MVP

Phase 2:

- A dashboard or list view of reminders. Users build one with Bases for now.
- Recurring reminders. They need a recurrence rule in the property and a way to roll the date forward.
- Snooze and "mark done". Both need the plugin to write to the note, which v1 never does.
- A history of fired reminders, which comes with the dashboard.
- Advance notice (remind N minutes before). It doubles the timing rules.
- A command to set a reminder on the current note. Obsidian's own property picker does this already.

Never:

- Reminders inside the note body (inline dates, checklist syntax). The uphy Reminder plugin does this.
- Mobile system notifications or push, unless Obsidian adds an API. They need a companion app or a network service.
- Per-person reminders in a shared vault. No accounts exist.
- Custom sound or notification styling. The operating system decides.
- Natural-language dates ("tomorrow 9am"). Properties hold real dates.

Revisit if users ask:

- Time zones inside values. Values are local time. A value with an explicit offset (`Z` or `+03:00`) is read as that instant, but there is no setting for zones.

---

### Open questions

None.

### Assumptions confirmed

1. **Day and time : RESOLVED (stage 02).** Both are required. A day alone never fires.
2. **Sources : RESOLVED (stage 02).** Several allowed. Each is one property or a pair. Default is the single property `reminder`.
3. **Missed reminders : RESOLVED (stage 01).** Fire once on the next startup, marked as missed.
4. **Mobile : RESOLVED (stage 01).** In-app notice only.
5. **Many missed reminders at once : RESOLVED.** Up to five fire separately. Above five, one summary notification opens a list (FR-MISSED-02). The list is the only pop-up in the plugin.
6. **Where the note opens : RESOLVED.** Its own tab if it is already open, otherwise a new tab (FR-OPEN-02).
7. **Extras in v1 : RESOLVED.** Neither "remind N minutes before" nor a "set reminder" command. Both move to phase 2.
8. **Unreadable values : RESOLVED.** Shown only in the settings tab (FR-SET-07). No pop-up while typing.
9. **Second line of the notification : RESOLVED.** "Reminder · 09:30" when on time, "Missed · Wed 14 Oct, 09:30" when late. A reminder counts as late when it fires more than 5 minutes after its time.
