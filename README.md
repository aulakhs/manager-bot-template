# Manager Bot

A personal assistant for Salesforce SE managers — built on Claude Code.

Track team activity, pipeline, 1:1 cadence, kudos, capacity, and generate weekly/quarterly reviews — all from your terminal or a deployed web dashboard.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/aulakhs/manager-bot-template)

---

## What You Get

| Feature | How |
|---------|-----|
| **Team health heatmap** | Activity hours, pipeline, 1:1 recency, canvas status |
| **1:1 prep** | Auto-generated talking points from Granola, SF, kudos |
| **Weekly review** | One-line-per-TA summary + watch-this section |
| **Quarterly reviews** | Evidence-backed drafts with strengths + growth areas |
| **Pipeline tracker** | Open opps, coverage gaps, AE forecast sheets |
| **Slack nudges** | Pre-drafted messages for activity/pipeline gaps |
| **Actions view** | Monday kickoff, Friday wrap, 1:1 prep cards |

---

## Quick Start (15 minutes)

### Prerequisites

- **Claude Code** installed ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **Node.js 18+** (`node --version`)
- **Salesforce CLI** (`sf --version`) — for the Salesforce MCP server
- **GitHub CLI** (`gh --version`) — optional, for pushing

### Step 1: Clone & Install

```bash
git clone https://github.com/aulakhs/manager-bot-template.git manager-bot
cd manager-bot
npm install
```

### Step 2: Run the Setup Wizard

```bash
./setup.sh
```

This interactive script will:
1. Ask for your name and Salesforce User ID
2. Ask for your team members (names, emails, SF IDs)
3. Configure `.mcp.json` for Salesforce (org62)
4. Optionally wire Granola and Slack
5. Create `CLAUDE.md` with your identifiers
6. Create team profile files

### Step 3: Authenticate Salesforce MCP

```bash
sf org login web --alias manager-bot --instance-url https://login.salesforce.com
```

This connects the Salesforce MCP server to org62.

### Step 4: First Data Pull

Open Claude Code in the project directory and run:

```
/pull-all
```

This pulls Salesforce activity, Granola notes, Calendar gaps, and Slack kudos, then generates your first weekly review.

### Step 5: Launch the Dashboard (optional)

```bash
npm start
# Open http://localhost:4178
```

---

## Deploy to Heroku

### One-Click Deploy

Click the purple **Deploy to Heroku** button at the top of this README. It will:
1. Create a new Heroku app
2. Deploy the web dashboard
3. Set up the `web` dyno

After deploying, push data updates from your local machine:

```bash
heroku git:remote -a your-app-name
git push heroku main
```

### Manual Deploy

```bash
heroku create your-app-name
git push heroku main
heroku open
```

> **Note:** The dashboard on Heroku is read-only. Data syncs happen locally via Claude Code, then you `git push heroku main` to update the deployed dashboard.

---

## Data Sources

| Source | What it provides | Setup |
|--------|-----------------|-------|
| **Salesforce org62** | SE activity hours, events, pipeline | Salesforce MCP (included in `.mcp.json`) |
| **Granola** | 1:1 meeting notes | Granola MCP or local cache |
| **Google Calendar** | 1:1 cadence, upcoming meetings | Google Workspace MCP (global) |
| **Slack** | Kudos, shoutouts, escalations | Slack MCP (global) |

### Setting Up Each Source

**Salesforce (required):**
```bash
# Already configured by setup.sh — just authenticate:
sf org login web --alias manager-bot
```

**Granola (recommended):**
- If you use Granola Enterprise, the MCP server is already in `.mcp.json`
- Otherwise, Claude reads from `~/Library/Application Support/Granola/cache-v6.json`

**Slack (recommended):**
- Slack MCP is registered globally in Claude Code
- No extra setup needed — just use `/pull-slack-kudos`

**Google Calendar (recommended):**
- Google Workspace MCP is registered globally
- If auth expires: `~/.mcp-adaptor/bin/mcp-adaptor auth --provider google-workspace-rw --env prod`

---

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/pull-all` | Monday refresh: all sources + weekly review |
| `/pull-sf-activity` | SE utilization from org62 Events |
| `/pull-granola-notes` | Import 1:1 notes from Granola |
| `/pull-calendar-gaps` | 1:1 cadence check |
| `/pull-slack-kudos` | Kudos + escalation signals |
| `/weekly-review` | Team health report |
| `/prep-1on1 <name>` | Pre-call talking points |
| `/quarterly-review <name>` | Performance review draft |

---

## Project Structure

```
manager-bot/
├── CLAUDE.md                  # Claude Code instructions
├── .mcp.json                  # MCP server config (Salesforce, Granola)
├── .claude/commands/          # Slash commands
├── team/                      # One file per TA
├── notes/1on1s/               # 1:1 notes (YYYY-MM-DD-<name>.md)
├── kudos/                     # Per-TA brag boards
├── data/                      # JSON data (live-snapshot, forecast, etc.)
├── outputs/                   # Generated reviews and reports
├── web/                       # Express dashboard
│   ├── server.js
│   └── public/index.html
├── package.json
├── Procfile                   # Heroku process
├── app.json                   # Heroku deploy button config
└── setup.sh                   # Interactive setup wizard
```

---

## Daily Workflow

1. **Monday AM:** Run `/pull-all` — pulls everything, generates weekly review
2. **Before 1:1s:** Run `/prep-1on1 <name>` — gets talking points
3. **During the week:** Dashboard shows live team health at `localhost:4178`
4. **Friday PM:** Check the Actions view for wrap messages
5. **Quarterly:** Run `/quarterly-review <name>` — drafts performance review

---

## FAQ

**Q: I don't use Granola. Will it still work?**
Yes. Granola is optional. Without it, 1:1 prep and quarterly reviews will use local notes in `notes/1on1s/` instead.

**Q: How do I add a new team member?**
Create a file in `team/<firstname>.md` using the template in `team/README.md`, then add their SF ID to `CLAUDE.md`.

**Q: The Heroku dashboard shows stale data.**
Push your latest data: `git add data/ && git commit -m "sync" && git push heroku main`

**Q: How do I find my Salesforce User ID?**
In org62, go to Setup → Users → find yourself → the ID is in the URL (starts with `005`).

**Q: How do I find my team members' SF IDs?**
Run: `sf data query --query "SELECT Id, Name FROM User WHERE ManagerId = '<YOUR_ID>' AND IsActive = true" --target-org manager-bot`

---

## Credits

Built by Sandeep Aulakh using [Claude Code](https://claude.ai/code). Shared for Salesforce SE managers who want to run their teams with data, not vibes.
