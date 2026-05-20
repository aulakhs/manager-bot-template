---
description: Check Google Calendar for 1:1 cadence gaps — flag TAs not met with in 2+ weeks
---

Check Google Calendar to surface 1:1 cadence gaps across your team. Flag anyone you haven't met with recently.

## Steps

1. Read `team/` to get the full TA roster.

2. Search Google Calendar for the past 30 days. For each TA on the roster, search for:
   - Events with their name in the title (e.g. "1:1 with Priya", "Sandeep / Priya")
   - Events where they are listed as an attendee

   Use the Google Calendar MCP tools to search events in the range `[today - 30 days, today]`.

3. For each TA, find their most recent 1:1 event. Also check `notes/1on1s/` as a fallback (look for the most recent file matching their slug).

4. Compute days since last 1:1 for each TA. Also look ahead 14 days for any upcoming scheduled 1:1s.

5. Print the cadence report to terminal:

```
## 1:1 Cadence Report — <today>

| TA | Last 1:1 | Days ago | Next scheduled | Status |
|----|----------|----------|----------------|--------|
| …  | …        | …        | …              | ✓ / ⚠️ / 🔴 |

Legend:
  ✓  = met within 14 days
  ⚠️ = 15–21 days ago (schedule soon)
  🔴 = 22+ days ago or no record found (overdue)

Upcoming 1:1s in the next 14 days:
- <date>: <TA name>
```

6. Also flag: any TA who has a 1:1 in the next 7 days but no Granola/notes entry from the last meeting (i.e., prep may be needed).

## Rules
- If Google Calendar search returns no results for a TA, fall back to `notes/1on1s/` file dates.
- Don't create or modify any files — this is a read-only report.
- Keep the report under 300 words.
