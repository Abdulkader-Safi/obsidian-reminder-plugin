# Property reminders

An Obsidian plugin that sends a notification when the date and time in a note's property arrives, and opens that note when you click it.

The reminder is a plain property. There is no inline syntax to learn and no data kept outside your notes, so anything that reads or writes properties (Kanban cards, calendar event notes, Bases views, templates) works with it.

Status: in development and not yet released. Progress is tracked in [PROGRESS.md](PROGRESS.md).

## How to use it

1. Open any note and add a property named `reminder`.
2. Set its type to "Date & time" and pick a time.
3. Carry on working. At that minute a notification shows the note's name. Click it to open the note.

The property stays in the note after it fires. Change the time to be reminded again, or delete the property.

## Settings

### Scope

By default every Markdown note in the vault is watched. Switch to "Specific folders" to watch only the folders you choose. Subfolders are included. This keeps an archive or a templates folder from firing.

### Reminder properties

The plugin can watch several properties. Each one is either:

- one property that holds the day and the time, such as `reminder` or `due`
- two properties, one for the day and one for the time, such as `date` and `startTime`. Calendar plugins that write event notes often use this shape.

Property names match without regard to capital letters.

### Status and test

The settings tab shows how many reminders are scheduled and lists the notes whose value cannot be read. The "Send test notification" button checks that your system shows notifications from Obsidian.

## Accepted values

A reminder always needs a day and a time. A day on its own never fires.

| Where | Format | Example |
|-------|--------|---------|
| One property | `YYYY-MM-DDTHH:mm` | `2026-10-14T09:30` |
| One property | the same with a space | `2026-10-14 09:30` |
| Day of a pair | `YYYY-MM-DD` | `2026-10-14` |
| Time of a pair | `HH:mm` | `09:30` |
| Time of a pair | 12-hour | `9:30 AM` |

Times are read as your device's local time. Seconds are ignored. A value with an explicit offset, such as `2026-10-14T09:30:00Z`, is read as that exact instant.

## What to expect

- The plugin runs only while Obsidian is running. It cannot wake Obsidian.
- A reminder that came due while Obsidian was closed, or while the computer was asleep, fires once the next time Obsidian is open, marked "Missed". More than five missed reminders arrive as one summary that opens a list.
- Missed reminders are tracked per device. A reminder that fired on your laptop still shows as missed on your phone.
- A time that is already in the past when you type it does not fire.
- The plugin never edits your notes and makes no network requests.

## Desktop and mobile

On desktop you get a system notification. Clicking it brings Obsidian forward and opens the note.

On iOS and Android you get a notice inside Obsidian, and only while Obsidian is open on screen. Obsidian gives plugins no way to send a system notification on mobile.

Tested so far on macOS only.

## If no notification appears

Press "Send test notification" in the plugin's settings. If nothing shows, your system is blocking notifications from Obsidian. The plugin cannot detect this.

- macOS: System Settings, then Notifications, then Obsidian. Turn on "Allow notifications". Check that no Focus mode is silencing it.
- Windows: Settings, then System, then Notifications. Turn notifications on for Obsidian and check that "Do not disturb" is off.
- Linux: check your desktop environment's notification settings.

## Development

```bash
npm install
npm run dev     # watch build
npm test        # unit tests, needs Node 22.18 or later
npm run lint
npm run build
```

The design is written up in [docs/spec](docs/spec). Start with [06-build-spec.md](docs/spec/06-build-spec.md).

## Licence

MIT
