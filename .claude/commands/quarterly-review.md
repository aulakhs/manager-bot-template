---
description: Draft a quarterly performance review for a specific TA
argument-hint: <TA name> [quarter, e.g. Q1-FY2026]
---

Draft a quarterly performance review for the TA named in $ARGUMENTS.

## Fiscal calendar
Q1 = Feb 1–Apr 30, Q2 = May 1–Jul 31, Q3 = Aug 1–Oct 31, Q4 = Nov 1–Jan 31.
If no quarter specified, use the most recently completed quarter.

## Data gathering

1. **Team profile** — read `team/<name>.md`. If missing, ask for role, tenure, and focus before proceeding.

2. **1:1 notes** — read all files in `notes/1on1s/` matching this TA within the target quarter. Also check the Granola cache at `~/Library/Application Support/Granola/cache-v6.json` — pull any meetings with this TA in the quarter that aren't already in local files.

3. **Salesforce activity** — read all `data/capacity-*.csv` files touching the quarter. Also if SF MCP is available, run the activity query for this TA specifically:

   ```sql
   SELECT Owner.Name, COUNT(Id) events, SUM(Duration__c) hrs
   FROM Event
   WHERE RecordType.Name IN (
     'EBU Sales Engineer Events','EMEA Solution Engineer Events',
     'Marketing Cloud Solution Engineer Events','Sales Engineer Events','Solutions Event')
   AND (SE_Task_Type__c != 'VTO' OR SE_Task_Type__c = null)
   AND Owner.Name = '<TA Full Name>'
   AND ActivityDate >= <quarter_start> AND ActivityDate <= <quarter_end>
   GROUP BY Owner.Name
   ```

4. **Kudos brag board** — read `kudos/<ta-slug>.md` in full. These are your evidence anchors.

5. **Weekly reviews** — read all `outputs/weekly-*.md` from the quarter that mention this TA.

6. **Slack (spot check)** — search Slack for the TA's first name over the quarter period to surface any notable signals not yet captured.

## Review format

Save to `outputs/quarterly-<ta-slug>-<quarter>.md`:

```
# Quarterly Review — <TA name>, <quarter>

## Summary
<2–3 sentences on the quarter overall. What changed, what was the arc.>

## Activity (from Salesforce)
- Hours logged: <N hrs> (<compare to team avg if available>)
- Events: <N>
- Utilization: <X%>

## Strengths (with evidence)
- <Strength>: <specific example — week, customer, outcome from notes or kudos>
(3–5 bullets)

## Growth areas (with evidence)
- <Area>: <specific behavior and impact, not a personality judgment>
(2–3 bullets)

## Suggestions for next quarter
- <Concrete and actionable — name the habit, the cadence, or the stretch assignment>
(2–4 bullets)

## Data gaps
- <Weeks with no 1:1 notes, missing SF data, or thin evidence — name it>

## Sources used
- 1:1 notes: <N files, date range>
- Granola: <N meetings pulled>
- SF hours: <total, source>
- Kudos: <N entries>
```

## Rules
- Specific over vague. Cite week, customer, outcome.
- No corporate hedging. If there's a real issue, say it plainly.
- Never invent evidence. If a strength isn't supported by sources, don't claim it.
- Keep the whole review under 600 words.

After writing the file, print the review to the terminal.
