---
description: Pull 1:1 notes from Granola local cache and save them into notes/1on1s/
argument-hint: [TA name or "all"] [--since YYYY-MM-DD]
---

Pull 1:1 meeting notes from the Granola local cache and save them as structured markdown files.

## Source

The Granola cache lives at:
`~/Library/Application Support/Granola/cache-v6.json`

Read it with the Read tool. It's a large JSON file — the relevant structure per document is:
- `title` — meeting title
- `notes_markdown` — the written notes (most useful)
- `summary` — AI summary
- `people` — attendee list
- `google_calendar_event.start.dateTime` — meeting datetime
- `google_calendar_event.attendees` — attendee emails

**Note:** If the Granola MCP returns Unauthorized, fall back to reading the local cache file directly.

## Steps

1. Read `team/` to get the current TA roster (names and slugs).

2. If $ARGUMENTS contains a specific name, filter to meetings with that person. If "all" or no argument, process all TAs.

3. Parse the Granola cache JSON. For each document:
   - Check if it's a 1:1: look for the TA's name in `title`, `people`, or `google_calendar_event.attendees`
   - Extract the date from `google_calendar_event.start.dateTime`
   - If `--since` was passed, skip meetings before that date
   - Prefer `notes_markdown` if non-empty; fall back to `summary`

4. For each matching 1:1 found, check if a file `notes/1on1s/<date>-<ta-slug>.md` already exists. Skip if it does (don't overwrite manual notes).

5. Save each new 1:1 as `notes/1on1s/<YYYY-MM-DD>-<ta-slug>.md` in this format:

```markdown
# 1:1 with <TA Full Name> — <YYYY-MM-DD>
> Source: Granola (auto-imported)

## Notes
<notes_markdown content>

## Summary
<summary if notes_markdown is empty>
```

6. After saving, print a summary:

```
## Granola pull — <date>

Imported X new 1:1 notes:
- <TA name>: <N> notes (<date range>)
- ...

Skipped Y existing files.
TAs with no Granola meetings found: <list>
```

## Rules
- Never overwrite an existing notes file — manual notes take precedence.
- If Granola has no notes for a TA, say so clearly; don't create an empty file.
- If the cache file can't be read, report that and suggest checking if the Granola app is running.
