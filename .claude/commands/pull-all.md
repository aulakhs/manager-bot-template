---
description: Pull all live data sources — SF activity, Granola notes, Calendar gaps, Slack kudos — then run weekly review
---

Run a full data refresh across all live sources, then generate the weekly review. This is your Monday morning command.

## Steps — run in order

### 1. Salesforce activity (utilization)
Follow the `/pull-sf-activity` command exactly. Save the CSV and note any capacity flags.

### 2. Granola 1:1 notes
Follow the `/pull-granola-notes all` command. Import any new 1:1 notes not already on disk.

### 3. Google Calendar cadence
Follow the `/pull-calendar-gaps` command. Capture the cadence table internally (don't print yet — it'll appear in the weekly review).

### 4. Slack kudos
Follow the `/pull-slack-kudos all` command for the last 7 days. Append any new kudos to the brag boards.

### 5. Weekly review
Follow the `/weekly-review` command. At this point all sources are fresh, so the review should reflect live data.

## Output

After all steps complete, print a pull summary before the weekly review:

```
## Pull-all summary — <date>

✓ Salesforce: X TAs with activity data, pulled from Event (current quarter)
✓ Granola: X new 1:1 notes imported (Y skipped — already on disk)  
✓ Calendar: X 1:1s found in last 30 days
✓ Slack: X new kudos across Y TAs

--- Weekly Review follows ---
```

Then print the full weekly review below it.

## Rules
- If any individual pull fails (e.g. SF auth expired, Granola cache stale), continue with the others and note the failure in the summary.
- Do not abort the weekly review if a data source is unavailable — use whatever is on disk.
- Total runtime should feel like one coherent command, not five separate ones.
