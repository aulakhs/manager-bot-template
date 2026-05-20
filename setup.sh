#!/bin/bash
# Manager Bot — Interactive Setup Wizard
# Run this once to configure the bot for your team.

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Manager Bot Setup Wizard       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# --- Manager Info ---
echo -e "${BLUE}Step 1: Your Info${NC}"
echo "---"
read -p "Your full name: " MANAGER_NAME
read -p "Your Salesforce User ID (starts with 005): " MANAGER_SF_ID
read -p "Your email (e.g. you@salesforce.com): " MANAGER_EMAIL

echo ""
echo -e "${GREEN}✓ Got it: $MANAGER_NAME ($MANAGER_SF_ID)${NC}"

# --- Team Members ---
echo ""
echo -e "${BLUE}Step 2: Team Members${NC}"
echo "Enter your direct reports. Type 'done' when finished."
echo "Format: Full Name, email, Salesforce User ID"
echo "Example: Jane Smith, jsmith@salesforce.com, 005ed000001abcDEF"
echo "---"

TEAM_IDS=""
TEAM_COUNT=0

mkdir -p team

while true; do
  read -p "Team member (or 'done'): " INPUT
  if [ "$INPUT" = "done" ] || [ "$INPUT" = "d" ]; then
    break
  fi

  # Parse: "Name, email, SF ID"
  NAME=$(echo "$INPUT" | cut -d',' -f1 | xargs)
  EMAIL=$(echo "$INPUT" | cut -d',' -f2 | xargs)
  SF_ID=$(echo "$INPUT" | cut -d',' -f3 | xargs)

  if [ -z "$NAME" ] || [ -z "$EMAIL" ] || [ -z "$SF_ID" ]; then
    echo -e "${YELLOW}⚠ Please use format: Name, email, SF ID${NC}"
    continue
  fi

  # Generate slug
  SLUG=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | cut -d' ' -f1)

  # Create team file
  cat > "team/${SLUG}.md" << EOF
# ${NAME}

- Role: Technical Architect
- Email: ${EMAIL}
- Salesforce ID: ${SF_ID}
- Focus / specialty: (fill in)
- AEs they support: (fill in)
- Stated career goals: (fill in)
- Watch-outs: (fill in)
EOF

  TEAM_IDS="${TEAM_IDS}'${SF_ID}', "
  TEAM_COUNT=$((TEAM_COUNT + 1))
  echo -e "${GREEN}  ✓ Added $NAME ($SLUG)${NC}"
done

# Remove trailing comma
TEAM_IDS=$(echo "$TEAM_IDS" | sed 's/, $//')

echo ""
echo -e "${GREEN}✓ $TEAM_COUNT team members added${NC}"

# --- MCP Configuration ---
echo ""
echo -e "${BLUE}Step 3: MCP Configuration${NC}"

# Detect SF MCP path
SF_MCP_PATH=""
if [ -f "/opt/homebrew/bin/sf-mcp-server" ]; then
  SF_MCP_PATH="/opt/homebrew/bin/sf-mcp-server"
elif command -v sf-mcp-server &> /dev/null; then
  SF_MCP_PATH=$(which sf-mcp-server)
else
  # Try homebrew cellar
  SF_MCP_PATH=$(find /opt/homebrew/Cellar/salesforce-mcp -name "sf-mcp-server" 2>/dev/null | head -1)
fi

if [ -z "$SF_MCP_PATH" ]; then
  echo -e "${YELLOW}⚠ sf-mcp-server not found. Install: brew install salesforce-mcp${NC}"
  SF_MCP_PATH="/opt/homebrew/bin/sf-mcp-server"
fi

# Granola
echo ""
read -p "Do you use Granola for meeting notes? (y/n): " USE_GRANOLA

GRANOLA_BLOCK=""
if [ "$USE_GRANOLA" = "y" ] || [ "$USE_GRANOLA" = "Y" ]; then
  GRANOLA_BLOCK=',
    "granola": {
      "type": "http",
      "url": "https://mcp.granola.ai/mcp"
    }'
  echo -e "${GREEN}  ✓ Granola MCP enabled${NC}"
fi

# Write .mcp.json
cat > .mcp.json << EOF
{
  "mcpServers": {
    "salesforce": {
      "command": "${SF_MCP_PATH}",
      "args": [
        "--orgs",
        "manager-bot",
        "--toolsets",
        "data",
        "orgs",
        "metadata",
        "users"
      ]
    }${GRANOLA_BLOCK}
  }
}
EOF

echo -e "${GREEN}✓ .mcp.json configured${NC}"

# --- CLAUDE.md ---
echo ""
echo -e "${BLUE}Step 4: Generating CLAUDE.md${NC}"

cat > CLAUDE.md << EOF
# Manager Bot

Personal assistant for managing a team of ${TEAM_COUNT} technical architects.

## Who I'm supporting

A Salesforce manager leading ~${TEAM_COUNT} technical architects (TAs). Core recurring work:

- Weekly 1:1s with each TA
- Activity tracking review: are they logging activity, hours on customers, and capacity?
- Capacity balancing: who is over, who is under, who needs a rebalance?
- Quarterly performance reviews with written feedback
- Sales coverage planning: do the AEs I support have enough TA coverage?
- Enablement: does my team have enough growth / learning opportunities?

## How to help me

- When I ask for a weekly review, use \`/weekly-review\` — it pulls from all live sources.
- When I ask for a quarterly review, use \`/quarterly-review <name>\` — it pulls Granola, Salesforce, kudos, and weekly summaries.
- When prepping a 1:1, use \`/prep-1on1 <name>\` — it checks Granola, SF, kudos, and calendar.
- Ask me for missing context instead of guessing. If a TA's notes are sparse, say so.
- Keep outputs concise. I read these between meetings.

## Project structure

\`\`\`
manager-bot/
├── CLAUDE.md                  # this file
├── .mcp.json                  # MCP servers: Salesforce (org62), Granola
├── .claude/commands/          # slash commands
│   ├── pull-all.md            # Monday refresh: all sources + weekly review
│   ├── pull-sf-activity.md    # SE utilization from org62 Events
│   ├── pull-granola-notes.md  # Import 1:1 notes from Granola cache
│   ├── pull-calendar-gaps.md  # 1:1 cadence check via Google Calendar
│   ├── pull-slack-kudos.md    # Kudos + escalation signals from Slack
│   ├── weekly-review.md       # Team health report
│   ├── prep-1on1.md           # Pre-call talking points
│   └── quarterly-review.md   # Performance review draft
├── team/                      # one file per TA with their basics
├── notes/1on1s/               # 1:1 notes, named YYYY-MM-DD-<name>.md
├── kudos/                     # per-TA brag boards, named <slug>.md
├── data/                      # JSON exports (capacity, hours, activity)
└── outputs/                   # generated reviews and reports
\`\`\`

## Data sources (all wired)

| Source | What it provides | How accessed |
|--------|-----------------|--------------|
| **Salesforce org62** | SE activity hours, event counts, utilization | MCP (\`mcp__salesforce__run_soql_query\`) via \`.mcp.json\` |
| **Granola** | 1:1 meeting notes and transcripts | Local cache or MCP |
| **Google Calendar** | 1:1 cadence, upcoming meetings, attendance | Google Workspace MCP (registered globally) |
| **Slack** | Kudos, shoutouts, AE signals, escalations | Slack MCP (registered globally) |
| **Local files** | Manual notes, capacity CSVs, brag boards | \`notes/\`, \`data/\`, \`kudos/\` directories |

## Key identifiers

- Manager Salesforce User Id: \`${MANAGER_SF_ID}\`
- Fiscal calendar: Q1=Feb–Apr, Q2=May–Jul, Q3=Aug–Oct, Q4=Nov–Jan
- SE activity benchmark: ~300 hrs/quarter = 100% utilization
- Utilization thresholds: > 85% = high risk, 60–84% = healthy, < 60% = low / coverage gap

## Style for generated outputs

- Lead with the decision or the ask, not the background.
- Quarterly reviews: strengths (with evidence), growth areas (with evidence), specific suggestions. No corporate hedging.
- Weekly summaries: one line per TA, then a team-level "watch this" section.
- Never fabricate activity, hours, or customer names. If the data isn't there, say "no data for this week."
- If a data source is unavailable (auth expired, cache stale), note it and continue with what's on disk.
EOF

echo -e "${GREEN}✓ CLAUDE.md generated${NC}"

# --- Seed data ---
echo ""
echo -e "${BLUE}Step 5: Seeding initial data${NC}"

cat > data/live-snapshot.json << 'EOF'
{
  "meta": {
    "pulled_at": "not-yet-pulled",
    "quarter": "Q2 FY27",
    "quarter_label": "Q2 FY27 (May–Jul)",
    "activity_threshold": 250,
    "pipeline_threshold": 500000,
    "customer_threshold": 150,
    "note": "Run /pull-all to populate with live data."
  },
  "team": [],
  "canvas": {},
  "q2_pacing": {
    "quarter": "Q2 FY27",
    "period": "May–Jul 2026",
    "acv_closed": 0,
    "pipeline": 0,
    "pipeline_deals": 0,
    "target": 15000000
  },
  "travel": []
}
EOF

echo -e "${GREEN}✓ Seed data created${NC}"

# --- Final ---
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}Setup Complete!${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Authenticate Salesforce:"
echo "     sf org login web --alias manager-bot"
echo ""
echo "  2. Open Claude Code and run your first pull:"
echo "     claude"
echo "     /pull-all"
echo ""
echo "  3. Launch the dashboard:"
echo "     npm start"
echo "     Open http://localhost:4178"
echo ""
echo "  4. Deploy to Heroku (optional):"
echo "     heroku create my-manager-bot"
echo "     git push heroku main"
echo ""
echo -e "${BLUE}Tip: Run /pull-all every Monday to refresh all data.${NC}"
echo ""
