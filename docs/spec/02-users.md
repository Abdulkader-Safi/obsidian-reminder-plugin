# Users and usage

Status: signed off 2026-10-12

## Personas

### Primary: the property-based planner

Working name "Sam". Modelled on Safi's own use.

- A freelancer or small-team developer who runs client work out of one Obsidian vault. Kanban boards hold a note per card, a calendar plugin holds a note per event, and Bases views list projects by status.
- Wants one place for work, and wants dates that already sit in notes to do something. Dislikes tools that own their data: if a reminder is not visible in the note, they do not trust it.
- Today they copy important dates into the phone's reminders app or a calendar by hand, or they just check the board each morning. A typical miss is a follow-up that sat in a note for three days because nobody opened that note.
- Installs community plugins without help and edits properties daily. Will read a README. Will not learn inline syntax, write a Dataview query to make a plugin work, or run anything in a terminal.
- On notifications: wants few, at the exact minute, and wants each one to land on the right note in one click. A reminder that fires for an archived note or a template is worse than no reminder.
- Works on a Mac or Windows laptop with Obsidian open most of the working day. The laptop sleeps at night and Obsidian is sometimes quit. May sync the vault to a phone.

### Secondary: the mobile-first user

Working name "Mona".

- Uses Obsidian mostly on a phone, with a desktop now and then. Captures notes on the go and sets dates in properties from the mobile properties panel.
- Wants the same reminder property to work on the phone.
- Gets an in-app notice while Obsidian is open and on screen. Gets nothing while the phone is locked or Obsidian is in the background, because Obsidian gives plugins no system notification API on mobile.
- Matters because a synced vault means the plugin will load on phones whether we plan for it or not, and it must not crash or mislead there. Not the beachhead because the plugin cannot deliver its main promise (a notification at the exact minute) on a phone.

### Not the target

- People who want a task manager with recurring tasks and priorities, plus a review screen. Tasks and the uphy Reminder plugin serve them. We will not add checklist parsing or a task list to win them.
- People who need guaranteed mobile push. That takes a companion app or an external service, and we will not add network calls for it.
- Teams sharing one vault who need "remind Ali, not me". There is no per-person targeting. Every device that has the plugin and the note fires the reminder.

## Roles and permissions

Single user. No accounts and no roles. Anyone who can open the vault on a device gets that vault's reminders on that device.

## Jobs to be done

- When Sam adds a card to a Kanban board that needs action on a set day, they want to put a time on the card's note, so they can stop holding the date in their head.
- When a reminder fires while Sam is in another app, they want to click it and land on the right note, so they can act without searching the vault.
- When Sam opens the laptop after a weekend, they want to see what came due while Obsidian was closed, so that nothing is silently lost.
- When Sam keeps templates and an archive in the same vault, they want reminders only from chosen folders, so old or template notes never fire.
- When Sam's vault already uses a property called `due` or `remind_at`, they want to add that name in settings next to `reminder`, so they do not have to rewrite existing notes.
- When Sam's calendar plugin writes the day and the time as two properties (for example `date` and `startTime`), they want to name that pair in settings, so event notes remind them with no extra property.
- When Sam types a date the plugin cannot read, they want to find out, so they do not wait for a reminder that will never fire.
- When Sam wants a list of what is coming up, they want to build it with Bases over the same property, so the plugin does not need its own view.
- When Mona opens Obsidian on her phone, she wants to see reminders that are due, so the property is still useful away from the desktop.

## Primary user journey

1. **Discovery:** Sam searches "reminder" in Obsidian's community plugin browser, or reads a forum thread asking how to get a reminder from a property. The pitch that lands: "Add a `reminder` property to any note. Get a notification. Click it to open the note."
2. **Setup:** Install and enable. On desktop the plugin asks the operating system for notification permission the first time it is needed. Nothing else is required: the default is the whole vault and the property name `reminder`. Under one minute.
3. **First use:** Sam opens any note, adds a property named `reminder`, picks "Date & time" as its type and chooses a time two minutes ahead with Obsidian's picker.
4. **Aha moment:** Two minutes later a system notification shows the note's title. Sam clicks it and Obsidian comes forward with that note open. They did not write syntax or open a plugin panel.
5. **Optional power-up:** Sam opens the settings tab, switches scope from "Whole vault" to "Specific folders" and adds `Projects` and `Calendar`. They add a second source, the pair `date` and `startTime`, so calendar event notes fire too. They add the `reminder` property to their Templater template for new Kanban cards, and build a Bases view sorted by `reminder` as their own upcoming list.
6. **Finish:** The reminder is done once it has fired. The property stays in the note as a record. Sam can change the date to be reminded again, or delete the property.
7. **Ongoing use:** Setting a reminder becomes part of creating a card or an event note. The plugin stays invisible until something is due.

## Core loop

**The repeated action:** set a `reminder` date and time on a note -> carry on working -> notification fires at that minute -> click -> note opens -> act on it.

**What pulls users back:**

- Each reminder that fires on time and opens the right note builds trust, so more dates get a reminder.
- It costs one property per note, and a card template or a calendar plugin can fill that property for them.
- Missed reminders show up on the next launch, so users stop double-entering dates in a phone app.

## Language and accessibility

- Plugin text (settings tab, notification labels, error notices) is English only in v1.
- Note titles in any script, including Arabic, must show correctly in the notification. The operating system renders the text, so the plugin passes the title through unchanged and never truncates or reorders it.
- A reminder always needs a day and a time. It comes either from one "Date & time" property (`YYYY-MM-DDTHH:mm`, the format Obsidian writes) or from a pair: a "Date" property (`YYYY-MM-DD`) plus a text property holding the time (`HH:mm`). A day with no time is not a reminder and never fires.
- Values are treated as the device's local time. Any time shown back to the user follows the device locale.
- The settings tab uses Obsidian's own setting components, so it inherits keyboard navigation, screen-reader labels, theme colours and font size. No custom controls that need their own accessibility work, apart from the folder list, whose remove buttons need a text label.
- Four set-ups to test against:
  - Kanban with a note per card
  - Full Calendar style event notes, which keep the day and the start time in two separate properties
  - Bases views over the reminder properties
  - Templater or core templates that stamp the properties into new notes

---

### Open questions

None.

### Assumptions confirmed

1. **Primary persona : RESOLVED.** The property-based planner, modelled on Safi's own use.
2. **Secondary persona : RESOLVED.** The mobile-first user, supported with in-app notices and a documented limit.
3. **Languages : RESOLVED.** English only for plugin text. Note titles pass through in any script.
4. **Plugins to test with : RESOLVED.** Kanban (note-per-card), Full Calendar or similar, Bases, Templater or core templates.
5. **Roles : RESOLVED.** Single user, no accounts.
6. **Day and time : RESOLVED.** A reminder must have both a day and a time. A day with no time never fires. There is no default time.
7. **Property names : RESOLVED.** Configurable in settings, and there can be several. Each entry is either one property holding day and time, or a pair of properties (one for the day, one for the time) with both names configurable. Default: one entry, the single property `reminder`.
