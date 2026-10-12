# Property reminders

An Obsidian plugin that sends a notification when the date and time in a note's property arrives, and opens that note when you click it.

Add a `reminder` property to any note, pick "Date & time" as its type and choose a time. That is the whole setup.

## Status

In development. Nothing is released yet. The plan and its progress are in [docs/spec/06-build-spec.md](docs/spec/06-build-spec.md) and [PROGRESS.md](PROGRESS.md).

## Development

```bash
npm install
npm run dev     # watch build
npm test        # unit tests, needs Node 22.18 or later
npm run lint
npm run build
```

## Licence

MIT
