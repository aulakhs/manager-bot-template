---
description: Generate a weekly team health review across all TAs
---

Run a weekly review for my team.

## Data sources (in priority order)

For each TA, gather data from all available sources:

1. **Salesforce (live)** — read `data/capacity-*.csv` for the most recent file. If it's more than 3 days old, note that SF data may be stale (suggest running `/pull-sf-activity`).
2. **Granola (live)** — check `notes/1on1s/` for the most recent file per TA. If nothing in the last 14 days, also check if the Granola cache at `~/Library/Application Support/Granola/cache-v6.json` has a more recent entry (look for the TA's name in titles/attendees).
3. **Kudos** — check `kudos/<ta-slug>.md` for any entries in the last 7 days.
4. **Local data** — any CSV in `data/` dated this week.
5. **Team profiles** — read `team/` for context (focus areas, AEs, watch-outs).

## Report shape

Write to `outputs/weekly-<YYYY-MM-DD>.md`:

```
# Weekly Review — <today's date>

## Per-TA one-liner
- <name>: <one sentence: what they're on, utilization if known, any flag>
(repeat for all TAs)

## Watch this week
- <2–4 bullets: capacity risks, coverage gaps, TAs not met with recently, anything needing attention>

## Kudos this week
- <any kudos logged in the last 7 days — TA name, brief context>
(omit section if none)

## Asks for me
- <decisions or outreach required this week; else "none">

## Data freshness
- SF activity: <date of latest capacity CSV or "not pulled">
- Granola notes: <date of most recent import>
- Slack kudos: <date of last pull or "not pulled">
```

## Rules
- If a TA has no recent 1:1 notes, say "no 1:1 in the last N days."
- Flag capacity > 85% (burnout risk) and < 60% (bench / coverage gap).
- Do not invent customer names, numbers, or activity. Missing data = say "no data."
- Keep the whole report under 500 words.

After writing the file, print the report to the terminal.
