---
description: Prep talking points for a 1:1 with a specific TA
argument-hint: <TA name>
---

Prep my next 1:1 with $ARGUMENTS.

## Data gathering (pull from all live sources)

1. **Team profile** — read `team/<name>.md` for their role, AEs, goals, watch-outs.

2. **Recent 1:1 notes** — read the 3 most recent files in `notes/1on1s/` matching this TA. If the most recent is older than 10 days, also check the Granola cache at `~/Library/Application Support/Granola/cache-v6.json` — search for the TA's name in meeting titles and attendees, and surface any notes from there.

3. **Salesforce activity** — check the latest `data/capacity-*.csv` for this TA's utilization and hours. If no CSV, note "no SF data on disk — run `/pull-sf-activity`."

4. **Kudos** — read `kudos/<ta-slug>.md` for recent entries (last 60 days). These are evidence for quarterly reviews.

5. **Calendar** — use Google Calendar MCP to look for upcoming 1:1s with this TA in the next 7 days. Also check for any recent no-shows or reschedules (cancelled events) if visible.

6. **Slack (optional)** — do a quick search `from:<TA first name>` in the last 14 days to see if they've flagged anything publicly that hasn't surfaced in notes.

7. **Weekly reviews** — read the latest `outputs/weekly-*.md` for anything flagged about this TA.

## Output (print to terminal only — no file)

```
## 1:1 Prep — <name> (<upcoming date if found, else today>)

### Follow-ups from last time
- <items I said I'd do or check on>

### What they raised last time
- <their asks, blockers, frustrations>

### What I'm seeing in the data
- Utilization: <X% or "no SF data">
- Activity hours this quarter: <N hrs or "no SF data">
- Last 1:1: <date> (<N days ago>)
- Recent kudos: <count in last 60 days, or "none logged">

### Questions to ask
- <3–4 specific, open-ended questions grounded in the notes and data>

### If time: career / growth
- <1 prompt tied to their stated goals or recent work>

### Sources used
- Notes: <list of files read>
- Granola: <yes/no, date of most recent>
- SF data: <date of latest CSV or "none">
- Kudos: <N entries found>
```

## Rules
- Questions must be grounded in actual notes and data, not boilerplate.
- If I owed them something from the last 1:1, lead with that.
- Keep it under 300 words. I read this right before the call.
- If Granola has more recent notes than the local files, prefer Granola.
