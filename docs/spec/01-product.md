# Property reminders

Status: signed off 2026-10-12

Product name as shown in Obsidian: "Property Reminders". Plugin ID: `property-reminders`.

> **Changes:** 2026-10-12: the plugin can watch several property names, and a source can be a pair of properties (one for the day, one for the time). Decided in stage 02 so that calendar notes with separate date and time properties work. A reminder always needs both a day and a time.

## Mission

Make any Obsidian note able to remind you, using a property the note already owns. A reminder is plain data in the note, so it works with every plugin that reads or writes properties (Kanban, calendar, Bases, Dataview, templates) without any of them knowing this plugin exists.

That rule shapes the rest of the spec: the plugin never asks for its own syntax, its own file or its own view. It reads the properties you name in settings (by default one, called `reminder`) and fires one notification per reminder.

The plugin is free and open source, published in the Obsidian community catalog. There is no paid tier and no account.

## One-liner

An Obsidian plugin that sends a system notification when the date and time in a note's `reminder` property arrives, and opens that note when you click it.

## The problem

People who plan in Obsidian keep dates in note properties: a Kanban card has a due date, a calendar plugin creates one note per event, a project note has a deadline. Obsidian shows those dates but never tells you one has arrived. You have to be looking at the right note at the right time.

The existing plugins do not solve this for property-based notes:

- **Reminder** by uphy (342,212 downloads, version 1.5.1, 74 open issues, per [Obsidian Stats](https://www.obsidianstats.com/plugins/obsidian-reminder-plugin), checked 2026-10-12). Reminders are inline text on a checklist line: `@YYYY-MM-DD HH:MM`, the Tasks format `📅 YYYY-MM-DD` or the Kanban format `@{YYYY-MM-DD}`. A note with no checklist cannot have a reminder. A date that lives in a property is ignored.
- **Simple Reminder** by Dmitry (3,081 downloads, version 1.13.5, MIT, per [Obsidian Stats](https://www.obsidianstats.com/plugins/simple-reminder), checked 2026-10-12). Reminders are created in a sidebar form and stored in the plugin's `data.json`. They are not in the note, so no other plugin can see or set them. A notification opens a note only if you attached a link by hand.
- **Note Snooze** (per [Obsidian Stats](https://www.obsidianstats.com/plugins/note-snooze)) reads a date property, but it hides and shows notes in the file explorer. It sends no notification.

The shared flaw: the reminder is either private syntax in the note body or private data outside the note. Neither is a property, so neither works with tools that are built on properties.

The gap is a reminder that is a property. I found no plugin in the community catalog that does it (searched 2026-10-12).

## The value

Safi has a Kanban board where each card is a note. He opens the card "Send invoice to client", adds `reminder: 2026-10-14T09:30` in the properties panel using Obsidian's own date and time picker, and closes it. On Wednesday at 09:30 a macOS notification says "Send invoice to client". He clicks it. Obsidian comes to the front with that note open.

He installed nothing else and learned no syntax. The same property works on a calendar event note, a meeting note or a daily note.

Versus Reminder by uphy, the user gets:

- A reminder on any note, with or without a checklist. This covers notes created by Kanban or calendar plugins and by templates, which is where dates already live.
- Obsidian's built-in date and time picker to set it. No syntax to remember or mistype.
- A value other plugins can read and write. A Bases view can list upcoming reminders today, with no dashboard built by this plugin.
- A folder filter, so an archive or templates folder never fires.

What it deliberately is not: a task manager, a reminder list or a dashboard. It has no sidebar view in v1. Listing upcoming reminders is left to Bases or Dataview, which already query properties. A built-in dashboard is a phase 2 idea. It is also not a mobile push service: see Platforms.

## Product category

Obsidian community plugin, in the reminders and notifications group. It competes with Reminder by uphy on where the reminder lives (property versus inline checklist syntax) and with Simple Reminder on whether the reminder is part of the note at all. The space it sits in is small and specific: property-native reminders with no UI of its own.

## Business model and licence

Free and open source, distributed through the Obsidian community catalog and GitHub releases. No pricing, no telemetry and no network calls.

Licence: MIT. The repo currently carries the sample plugin's 0-BSD licence with a Dynalist Inc. copyright line, which has to be replaced before release.

## Platforms

Day one:

- **Desktop** (macOS, Windows, Linux): system notifications. Clicking one focuses Obsidian and opens the note.
- **Mobile** (iOS, Android): an in-app notice that opens the note when tapped, shown only while Obsidian is open. Obsidian gives plugins no system notification API on mobile. The uphy plugin's FAQ says the same: "System notification in mobile device is not available because Obsidian doesn't provide the feature."

On every platform the plugin only runs while Obsidian is running. A reminder that comes due while Obsidian is closed fires once, marked as missed, the next time Obsidian opens.

Later: nothing planned. Real mobile push would need a companion app or an external service such as ntfy, which breaks the "no network calls" rule and is out of scope.

## What success looks like

One year in, the plugin is in the community catalog and Safi uses it daily on his own Kanban and calendar notes without thinking about it. Reminders he set fire at the right minute, and none are lost when the laptop was shut.

Measurable signals: accepted into the community catalog within three months of the first release, 1,000 downloads in the first year, and fewer than 10 open issues at any time.

## UI and product references

None supplied. The plugin has two pieces of UI:

- The notification. Keep what the operating system gives: the note title as the heading, a short second line, click to open.
- The settings tab. Follow Obsidian's own settings layout and the folder picker pattern used by core plugins (a text field with folder suggestions and a list of chosen folders, each with a remove button).

---

### Open questions

None.

### Assumptions confirmed

1. **Name : RESOLVED.** Property Reminders, plugin ID `property-reminders`. It differs from uphy's `obsidian-reminder-plugin` ID and names the mechanism.
2. **Distribution : RESOLVED.** Free community plugin, open source.
3. **Mobile : RESOLVED.** The plugin loads on mobile and shows an in-app notice. System notifications are desktop only.
4. **Missed reminders : RESOLVED.** Each missed reminder fires once on the next startup, marked as missed.
5. **Dashboard : RESOLVED.** Not in v1. Possible phase 2.
6. **Licence : RESOLVED.** MIT, replacing the sample plugin's 0-BSD file.
7. **Success numbers : RESOLVED.** Catalog listing within three months of first release, 1,000 downloads in year one, fewer than 10 open issues at any time.
8. **Folder name : RESOLVED.** Rename the folder to `property-reminders` at build time, as a first task in M1. Nothing moves during the spec stages.
