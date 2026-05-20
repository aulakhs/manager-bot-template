---
description: Pull SE utilization data for all direct reports from Salesforce org62
---

Pull live SE activity data from Salesforce for the current fiscal quarter and save it as a capacity snapshot.

## Fiscal calendar
Q1 = Feb 1–Apr 30, Q2 = May 1–Jul 31, Q3 = Aug 1–Oct 31, Q4 = Nov 1–Jan 31.
Manager's User Id = `<YOUR_SF_USER_ID>` (set in CLAUDE.md).

## Step 1 — identify direct reports

Run this SOQL to get the non-manager direct reports:

```sql
SELECT Id, Name FROM User
WHERE ManagerId = '<YOUR_SF_USER_ID>'
AND IsActive = true
AND IsManager__c = false
```

Collect the resulting `Id` values as a comma-separated list for the next query.

## Step 2 — pull aggregate SE activity hours for current fiscal quarter

Determine the current quarter date range (Q1=Feb–Apr, Q2=May–Jul, Q3=Aug–Oct, Q4=Nov–Jan), then run:

```sql
SELECT Owner.Name, COUNT(Id) events, SUM(Duration__c) hrs
FROM Event
WHERE RecordType.Name IN (
  'EBU Sales Engineer Events','EMEA Solution Engineer Events',
  'Marketing Cloud Solution Engineer Events','Sales Engineer Events','Solutions Event')
AND (SE_Task_Type__c != 'VTO' OR SE_Task_Type__c = null)
AND OwnerId IN (<ids from step 1>)
AND ActivityDate >= <quarter_start> AND ActivityDate <= <quarter_end>
GROUP BY Owner.Name
ORDER BY SUM(Duration__c) DESC NULLS LAST
```

## Step 3 — read the team roster

Read all files in `team/` to get the full list of TAs including those with 0 logged activity.

## Step 4 — compute utilization

Use this benchmark: a TA working full-load (~10 accounts) typically logs ~300 hrs/quarter.
- >= 85% of expected = High (flag risk)
- 60–84% = Healthy
- < 60% = Low (flag gap)

Map hours → utilization %: `round(hrs / 300 * 100)` capped at 100.
For TAs with no SF data this quarter, set utilization to null, note "no logged activity".

## Step 5 — save and report

Save as `data/capacity-<today>.csv` with columns: `name,utilization,hours,events,quarter,notes`

Then print a summary table to the terminal:

```
## SE Activity — <quarter> (pulled <date>)

| TA | Hours | Events | Utilization | Flag |
|----|-------|--------|-------------|------|
| …  | …     | …      | …%          | ⚠️ / ✓ / – |

Source: Salesforce org62 (Event SObject, current-owner SOQL)
Note: SOQL hours may differ slightly from CRM Analytics dashboard for TAs with recurring events.
```

Flag anyone > 85% as "⚠️ high" and anyone < 60% or with no data as "– low/no data".
