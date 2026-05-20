---
description: Search Slack for kudos, shoutouts, and escalation signals for each TA
argument-hint: [TA name or "all"] [--since YYYY-MM-DD]
---

Search Slack for positive signals (kudos, shoutouts, wins) and escalation signals for your TAs, and append findings to their kudos brag board.

## Steps

1. Read `team/` to get the full TA roster. If $ARGUMENTS contains a name, filter to that TA only.

2. For each TA, run multiple Slack searches:

   **Kudos / positive signals:**
   - `<TA first name> great` in all channels
   - `<TA first name> amazing` in all channels  
   - `<TA first name> kudos` in all channels
   - `<TA first name> shoutout` in all channels
   - `<TA first name> thank` (catches "thanks", "thank you") in all channels
   - `<TA first name> win` in all channels

   **Escalation signals (flag, don't log as kudos):**
   - `<TA first name> issue` in private/DM channels
   - `<TA first name> escalat` in all channels

   If `--since` is passed, add `after:<date>` to each query. Otherwise search the last 30 days (`after:<today minus 30 days>`).

3. For each result, evaluate:
   - Is this actually about the TA (not just a coincidence of the first name)?
   - Is it from a credible signal source — AE, customer, peer, leadership?
   - Is it specific enough to be useful in a quarterly review?

4. For qualifying kudos, append to `kudos/<ta-slug>.md`:

```markdown

## <YYYY-MM-DD> · Slack · <channel or DM sender>
<1-2 sentence summary of what was said and why it mattered. Quote briefly if the original is specific.>
[Source](<slack permalink>)
```

5. Print a summary:

```
## Slack Kudos Pull — <date>

<TA name>: X new kudos added, Y escalation signals flagged
  Kudos: [brief list]
  Escalation flags: [brief list — for your attention, not logged to brag board]

<TA name>: no new signals found
...
```

## Rules
- Only append genuinely new entries — don't duplicate if the same message was already logged.
- Escalation signals go in the terminal report only, not in the kudos file.
- If a signal is ambiguous (wrong person with same first name), skip it.
- Keep kudos entries tight — 1-2 sentences is enough.
