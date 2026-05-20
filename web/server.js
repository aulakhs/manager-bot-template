import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DIRS = {
  team: path.join(ROOT, "team"),
  notes: path.join(ROOT, "notes", "1on1s"),
  data: path.join(ROOT, "data"),
  kudos: path.join(ROOT, "kudos"),
  outputs: path.join(ROOT, "outputs"),
};

const IS_HEROKU = !!process.env.DYNO;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use(express.static(path.join(__dirname, "public")));

const slug = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const today = () => new Date().toISOString().slice(0, 10);

const listMarkdown = async (dir) => {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  } catch { return []; }
};

const readFile = async (p) => {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
};

// ---------- Cockpit (main dashboard) ----------
app.get("/api/cockpit", async (req, res) => {
  const snapshotPath = path.join(DIRS.data, "live-snapshot.json");
  const raw = await readFile(snapshotPath);
  if (!raw) return res.status(404).json({ error: "No snapshot found. Run /pull-all first." });
  const snap = JSON.parse(raw);

  // Apply quarter filter if specified
  const qtr = req.query.qtr || "q1"; // default to Q1 since that's where we have data
  for (const ta of snap.team) {
    const qData = ta.by_quarter?.[qtr] || ta.by_quarter?.q1 || {};
    ta.q1_customer_hrs = qData.customer_hrs ?? ta.q1_customer_hrs ?? 0;
    ta.q1_hrs = qData.total_hrs ?? ta.q1_hrs ?? 0;
    ta.q1_acv_closed = qData.acv_closed ?? ta.q1_acv_closed ?? 0;
    ta.q1_deals_won = qData.deals_won ?? ta.q1_deals_won ?? 0;
    ta.q1_events = qData.events ?? ta.q1_events ?? 0;
  }
  snap.selected_quarter = qtr;

  const ACTIVITY_THRESHOLD = snap.meta.activity_threshold || 250;
  const CUSTOMER_THRESHOLD = snap.meta.customer_threshold || 150;
  const PIPELINE_THRESHOLD = snap.meta.pipeline_threshold || 500000;
  const ONE_ON_ONE_OVERDUE_DAYS = 21;

  const flags = [];
  const actions = [];
  const team = snap.team.map((ta) => {
    const issues = [];
    const custHrs = ta.q1_customer_hrs ?? ta.q1_hrs ?? 0;

    // Activity flags — use customer-related hours as the primary signal
    if (custHrs === 0) {
      issues.push({ type: "no_activity", severity: "critical", label: "No customer hrs Q1" });
      flags.push({ ta: ta.name, type: "no_activity", severity: "critical", msg: `${ta.name.split(" ")[0]} has 0 customer-related hours logged in Q1 FY27` });
      actions.push({
        ta: ta.name, slug: ta.slug, category: "activity",
        msg: `Zero customer-related activity in Q1. Verify they have SE Events linked to accounts/opportunities in org62.`,
        slack_draft: `Hey ${ta.name.split(" ")[0]} 👋 — I'm not seeing any customer-related SE activity logged for you in Q1. If you've been working with customers this quarter, please log those events in org62 and make sure they're linked to the right accounts. Happy to help if anything looks off!`
      });
    } else if (custHrs < CUSTOMER_THRESHOLD) {
      issues.push({ type: "low_activity", severity: "warning", label: `${custHrs}h customer hrs` });
      flags.push({ ta: ta.name, type: "low_activity", severity: "warning", msg: `${ta.name.split(" ")[0]} at ${custHrs}h customer-related — below ${CUSTOMER_THRESHOLD}h` });
      actions.push({
        ta: ta.name, slug: ta.slug, category: "activity",
        msg: `Only ${custHrs}h customer-related hours in Q1 (threshold: ${CUSTOMER_THRESHOLD}h). Review whether calls are logged and linked to accounts.`,
        slack_draft: `Hey ${ta.name.split(" ")[0]} 👋 — your Q1 customer-related activity shows ${custHrs}h. Our benchmark is ${CUSTOMER_THRESHOLD}h. If you have unlogged calls, please add them in org62. Let me know if anything looks off!`
      });
    }

    // Pipeline flags
    if (ta.pipeline_acv === 0) {
      issues.push({ type: "no_pipeline", severity: "critical", label: "No pipeline contribution" });
      flags.push({ ta: ta.name, type: "no_pipeline", severity: "critical", msg: `${ta.name.split(" ")[0]} has no open pipeline contributions` });
      actions.push({
        ta: ta.name, slug: ta.slug, category: "pipeline",
        msg: `No open pipeline (Q1+Q2). Verify if they have SFR coverage on active opportunities.`,
        slack_draft: `Hey ${ta.name.split(" ")[0]} — I'm not seeing you listed on any open opps in the pipeline tracker. Can you make sure you're added as Primary or Secondary SE on the opportunities you're actively supporting?`
      });
    } else if (ta.pipeline_acv < PIPELINE_THRESHOLD) {
      issues.push({ type: "low_pipeline", severity: "warning", label: `$${(ta.pipeline_acv / 1000).toFixed(0)}K pipeline` });
      flags.push({ ta: ta.name, type: "low_pipeline", severity: "warning", msg: `${ta.name.split(" ")[0]} pipeline at $${(ta.pipeline_acv / 1000).toFixed(0)}K` });
      actions.push({
        ta: ta.name, slug: ta.slug, category: "pipeline",
        msg: `Pipeline at $${(ta.pipeline_acv / 1000).toFixed(0)}K — low relative to team. Review opp coverage with them.`,
        slack_draft: `Hey ${ta.name.split(" ")[0]} — can we take a few minutes on our next 1:1 to review your pipeline coverage? I want to make sure your work is showing up on the right opportunities.`
      });
    }

    // 1:1 cadence flags
    if (ta.last_1on1_days === null) {
      issues.push({ type: "no_1on1", severity: "critical", label: "No 1:1 on record" });
      flags.push({ ta: ta.name, type: "no_1on1", severity: "warning", msg: `${ta.name.split(" ")[0]} — no 1:1 found in Granola` });
      actions.push({
        ta: ta.name, slug: ta.slug, category: "1on1",
        msg: `No 1:1 notes found. Schedule or confirm cadence.`,
        slack_draft: null
      });
    } else if (ta.last_1on1_days > ONE_ON_ONE_OVERDUE_DAYS) {
      issues.push({ type: "overdue_1on1", severity: "warning", label: `Last 1:1 ${ta.last_1on1_days}d ago` });
      flags.push({ ta: ta.name, type: "overdue_1on1", severity: "warning", msg: `${ta.name.split(" ")[0]} last 1:1 was ${ta.last_1on1_days} days ago` });
    }

    // Canvas — not updated
    if (!ta.canvas_status) {
      issues.push({ type: "canvas_missing", severity: "info", label: "Canvas not updated" });
    }

    return { ...ta, issues };
  });

  // Canvas not-updated list
  const canvasMissing = team.filter((t) => !t.canvas_status).map((t) => t.name.split(" ")[0]);
  if (canvasMissing.length > 0) {
    actions.push({
      ta: "Team",
      slug: "team",
      category: "canvas",
      msg: `${canvasMissing.join(", ")} haven't updated the load balancing canvas before today's call.`,
      slack_draft: `Hey team 👋 — quick reminder to update the load balancing canvas before our call today: your capacity status, key focus areas, and anything you need help with. Takes 2 minutes and keeps us focused! Canvas: <SLACK_CANVAS_URL>`
    });
  }

  // Summary counts
  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const warningCount = flags.filter((f) => f.severity === "warning").length;

  res.json({
    meta: snap.meta,
    pulled_at: snap.meta.pulled_at,
    summary: { criticalCount, warningCount, teamCount: team.length, canvasMissing: canvasMissing.length },
    flags,
    team,
    actions,
    canvas: snap.canvas,
    load_balancing_call: snap.load_balancing_call,
    q2_pacing: snap.q2_pacing || null,
    travel: snap.travel || [],
  });
});

// ---------- TA Activity Insights ----------
app.get("/api/ta-activity-insights", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "ta-activity-insights.json"));
  if (!raw) return res.json({});
  res.json(JSON.parse(raw));
});

// ---------- Forecast Sheet Health ----------
app.get("/api/forecast-health", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "forecast-health.json"));
  if (!raw) return res.json({ aes: [], checked_at: null });
  res.json(JSON.parse(raw));
});

// ---------- Forecast ----------
app.get("/api/forecast", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "forecast.json"));
  if (!raw) return res.json({ aes: [], totals: { commit: 0, best: 0, worst: 0 } });
  res.json(JSON.parse(raw));
});

// ---------- Patch Forecast (Don's business) ----------
app.get("/api/patch-forecast", async (req, res) => {
  const raw = await readFile(path.join(DIRS.data, "patch-forecast.json"));
  if (!raw) return res.json({});
  const pf = JSON.parse(raw);

  // Select leader data
  const leader = req.query.leader || "don";
  const leaderData = pf.leaders?.[leader] || pf.leaders?.don || {};
  const leadersRaw = await readFile(path.join(DIRS.data, "leaders.json"));
  const leadersConfig = leadersRaw ? JSON.parse(leadersRaw) : {};
  const aeTeam = leadersConfig[leader]?.aes || [];

  const result = {
    patch: pf.patch,
    fiscal_year: pf.fiscal_year,
    source: pf.source,
    leader_name: leaderData.name || "Don Mardjonovic",
    ae_team: aeTeam,
    quarters: [...(leaderData.quarters || [])],
    ytd_closed: leaderData.ytd_closed || 0,
    total_pipeline: leaderData.total_pipeline || 0,
  };

  // Filter quarters if specified
  const qtrs = req.query.qtrs;
  if (qtrs) {
    const qtrMap = { q1: ['Q4 FY26', 'Q1 FY27'], q2: ['Q2 FY27'], q3: ['Q3 FY27'], q4: ['Q4 FY27'] };
    const selectedLabels = new Set();
    qtrs.split(",").forEach(q => (qtrMap[q] || []).forEach(l => selectedLabels.add(l)));
    if (selectedLabels.size > 0) {
      result.quarters = result.quarters.filter(q => selectedLabels.has(q.label));
    }
    result.ytd_closed = result.quarters.reduce((s, q) => s + (q.closed || 0), 0);
    result.total_pipeline = result.quarters.reduce((s, q) => s + (q.pipeline || 0), 0);
  }

  res.json(result);
});

// ---------- Pipeline Forecast ----------
app.get("/api/pipeline-forecast", async (req, res) => {
  const raw = await readFile(path.join(DIRS.data, "pipeline-forecast.json"));
  if (!raw) return res.json({ deals: [], totals: {}, coverage_gaps: {} });
  const pf = JSON.parse(raw);

  // Filter by leader if specified
  const leader = req.query.leader;
  if (leader) {
    const leadersRaw = await readFile(path.join(DIRS.data, "leaders.json"));
    if (leadersRaw) {
      const leaders = JSON.parse(leadersRaw);
      const leaderConfig = leaders[leader];
      if (leaderConfig) {
        const aeSet = new Set(leaderConfig.aes);
        pf.deals = pf.deals.filter(d => aeSet.has(d.ae));
      }
    }
  }

  // Filter by quarters if specified
  const qtrs = req.query.qtrs;
  if (qtrs) {
    // Map quarter selections to date ranges
    const qtrRanges = {
      q1: { start: "2026-02-01", end: "2026-04-30" },
      q2: { start: "2026-05-01", end: "2026-07-31" },
      q3: { start: "2026-08-01", end: "2026-10-31" },
      q4: { start: "2026-11-01", end: "2027-01-31" },
    };
    const selected = qtrs.split(",");
    pf.deals = pf.deals.filter(d => {
      if (!d.close) return true;
      return selected.some(q => {
        const range = qtrRanges[q];
        return range && d.close >= range.start && d.close <= range.end;
      });
    });
  }

  // Recompute totals from filtered deals
  const commit = pf.deals.filter(d => d.category === "Commit");
  const best = pf.deals.filter(d => d.category === "Best Case");
  const pipeline = pf.deals.filter(d => d.category === "Pipeline");
  const noSe = pf.deals.filter(d => !d.se_engaged);
  pf.totals = {
    commit: commit.reduce((s, d) => s + (d.acv || 0), 0),
    best_case: best.reduce((s, d) => s + (d.acv || 0), 0),
    pipeline: pipeline.reduce((s, d) => s + (d.acv || 0), 0),
  };
  pf.coverage_gaps = {
    no_se_count: noSe.length,
    no_se_acv: noSe.reduce((s, d) => s + (d.acv || 0), 0),
    no_comments_count: pf.deals.filter(d => !d.comments && (d.category === "Commit" || d.category === "Best Case")).length,
  };

  res.json(pf);
});

// ---------- Send Slack nudge to TA about deal coverage ----------
app.post("/api/nudge-ta", async (req, res) => {
  if (IS_HEROKU) return res.json({ ok: false, error: "Slack nudges require local Claude CLI. Use the copy button instead." });
  const { ta_slug, ta_name, ta_slack_id, bulk_message, deals_data, account, ae, acv, opp_id } = req.body || {};
  if (!ta_slug) return res.status(400).json({ error: "Missing params" });

  const mcpConfig = path.join(ROOT, ".mcp.json");

  // Write the message to a temp file to avoid shell escaping issues
  const tmpFile = path.join(ROOT, "data", `.nudge-${ta_slug}-${Date.now()}.txt`);
  const message = bulk_message || `Hey ${ta_name?.split(" ")[0] || "there"} — I noticed an opportunity that needs your deal contribution. Check the link above. Thanks!`;
  const prompt = `Send a Slack direct message to the user with Slack ID "${ta_slack_id}". Read the file at ${tmpFile} for the message content. Send the exact content of that file as the Slack message. Use the mcp__slack__slack_send_message tool.`;

  try {
    await fs.writeFile(tmpFile, message, "utf8");
    const { stdout } = await execAsync(
      `claude --print --mcp-config ${mcpConfig} --allowedTools "mcp__slack__slack_send_message,Read" -p ${JSON.stringify(prompt)}`,
      { cwd: ROOT, timeout: 60000, env: { ...process.env, HOME: process.env.HOME } }
    );
    await fs.unlink(tmpFile).catch(() => {});
    res.json({ ok: true, message: `Nudge sent to ${ta_name}` });
  } catch (e) {
    await fs.unlink(tmpFile).catch(() => {});
    res.json({ ok: false, error: e.message.slice(0, 100) });
  }
});

// ---------- Onboarding ----------
app.get("/api/onboarding", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "onboarding.json"));
  if (!raw) return res.json({});
  res.json(JSON.parse(raw));
});

// ---------- Sync: signal or run ----------
app.post("/api/sync", async (_req, res) => {
  if (IS_HEROKU) {
    return res.json({ ok: true, synced_at: new Date().toISOString(), output: "Sync queued — your local machine refreshes every 3 minutes and auto-deploys." });
  }
  try {
    const syncPrompt = `You are refreshing data for the Manager Bot dashboard. Do these steps in order:

1. GRANOLA: Use mcp__granola__list_meetings with time_range "last_30_days". For each 1:1 meeting with Arup, Emily, Gregory, Sarah, Surabhi, or Vinicius, use mcp__granola__get_meetings to get the summary. Save the last 2 meetings per person as JSON to ${path.join(ROOT, "data/granola-notes.json")} in this format: {"slug": [{"date":"YYYY-MM-DD","title":"...","summary":"2-3 sentence summary"}]}

2. SALESFORCE ACTIVITY: Run the pull-sf-activity command logic — query Event records for direct reports in the current fiscal quarter using mcp__salesforce__run_soql_query. Get the team member IDs dynamically from the ManagerId query.

3. Read the file ${path.join(ROOT, "data/live-snapshot.json")}, update the q1_hrs for each TA from the SOQL results, update last_1on1 dates from the Granola data, and write it back.

4. Report what was updated in 2-3 sentences.

Be efficient. Write files directly. Do not ask for confirmation.`;

    const mcpConfig = path.join(ROOT, ".mcp.json");

    // Use spawn for better handling of long-running commands
    const { spawn } = await import("node:child_process");
    const result = await new Promise((resolve, reject) => {
      const child = spawn("claude", [
        "--print",
        "--mcp-config", mcpConfig,
        "--allowedTools", "mcp__granola__list_meetings,mcp__granola__get_meetings,mcp__salesforce__run_soql_query,Write,Read",
        "-p", syncPrompt
      ], { cwd: ROOT, env: { ...process.env, HOME: process.env.HOME }, timeout: 180000 });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", d => { stdout += d.toString(); });
      child.stderr.on("data", d => { stderr += d.toString(); });
      child.on("close", code => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.slice(0, 200) || `Exit code ${code}`));
      });
      child.on("error", reject);
    });
    res.json({ ok: true, synced_at: new Date().toISOString(), output: result.slice(0, 500) });
  } catch (e) {
    res.json({ ok: false, synced_at: new Date().toISOString(), error: e.message.slice(0, 200) });
  }
});

// ---------- Chat (Claude CLI agent) ----------
app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.json({ reply: "Please ask a question." });
  if (IS_HEROKU) return res.json({ reply: "AI chat requires the local server with Claude CLI access. This deployed version is read-only." });

  const context = `You are Manager Bot, an assistant for a people manager. You have access to Granola (meeting notes), Salesforce (via sf-mcp-server), Google Calendar, and Slack. Answer concisely in 2-4 sentences. Use the MCP tools to get real-time data. If asked about a meeting, check Granola. If asked about deals, check Salesforce. Today is ${new Date().toISOString().slice(0, 10)}. Read data/live-snapshot.json for team member names.`;

  const prompt = `${context}\n\nUser question: ${message}`;
  const mcpConfig = path.join(ROOT, ".mcp.json");

  try {
    const { stdout } = await execAsync(
      `claude --print --mcp-config ${mcpConfig} --allowedTools "mcp__granola__list_meetings,mcp__granola__get_meetings,mcp__granola__query_granola_meetings,mcp__salesforce__run_soql_query,mcp__plugin_google-workspace_vmcp-google-workspace__get_events,mcp__slack__slack_search_public_and_private,Read" -p ${JSON.stringify(prompt)}`,
      { cwd: ROOT, timeout: 90000, env: { ...process.env, HOME: process.env.HOME } }
    );
    const reply = stdout.trim().replace(/\n/g, "<br>");
    res.json({ reply: reply || "I couldn't find an answer. Try being more specific about which team member or topic." });
  } catch (e) {
    // Fallback to static keyword matcher
    const msg = message.toLowerCase();
    const snapshotRaw = await readFile(path.join(DIRS.data, "live-snapshot.json"));
    const snap = snapshotRaw ? JSON.parse(snapshotRaw) : { team: [] };
    const ta = snap.team.find(t => msg.includes(t.name.split(" ")[0].toLowerCase()));
    if (ta) {
      return res.json({ reply: `${ta.name}: ${ta.q1_customer_hrs || 0}h customer hrs, $${((ta.q1_acv_closed || 0) / 1e6).toFixed(1)}M closed, $${((ta.pipeline_acv || 0) / 1e6).toFixed(1)}M pipeline, last 1:1 ${ta.last_1on1 || "no record"}.<br><br><em>(Static fallback — Claude CLI unavailable)</em>` });
    }
    res.json({ reply: `I couldn't process that in real-time (Claude CLI timeout). Try asking about a specific team member by name.<br><br><em>Error: ${e.message.slice(0, 100)}</em>` });
  }
});

// ---------- Panels (deals closing, wins, action items) ----------
app.get("/api/panels", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "panels.json"));
  if (!raw) return res.json({ deals_closing: [], recent_wins: [], action_items: { you_owe_them: [], they_owe_you: [] } });
  res.json(JSON.parse(raw));
});

// ---------- TA opps filtered by AE ----------
app.get("/api/ta-ae-opps", async (req, res) => {
  const { slug, ae } = req.query;
  if (!slug || !ae) return res.json({ opps: [] });

  // Read the full opps file that includes owner info
  const aeRaw = await readFile(path.join(DIRS.data, "ae-opps-by-owner.json"));
  if (aeRaw) {
    const data = JSON.parse(aeRaw);
    const taOpps = data[slug] || [];
    const filtered = taOpps.filter(o => o.owner === ae);
    return res.json({ opps: filtered });
  }

  // Fallback: use all-opps (no owner field) — can't filter
  res.json({ opps: [] });
});

// ---------- TA Detail (opps + granola) ----------
app.get("/api/ta/:slug", async (req, res) => {
  const s = req.params.slug;

  // All opps
  const oppsRaw = await readFile(path.join(DIRS.data, "all-opps.json"));
  const allOpps = oppsRaw ? JSON.parse(oppsRaw) : {};
  const opps = (allOpps[s] || []).sort((a, b) => (b.amount || 0) - (a.amount || 0));

  // Granola notes (array per person)
  const gRaw = await readFile(path.join(DIRS.data, "granola-notes.json"));
  const gNotes = gRaw ? JSON.parse(gRaw) : {};
  const notes = gNotes[s] || [];
  const granola = Array.isArray(notes) ? notes : [notes];

  // AE pipeline
  const aeRaw = await readFile(path.join(DIRS.data, "ae-pipeline.json"));
  const aePipeline = aeRaw ? JSON.parse(aeRaw) : {};
  const ae_pipeline = aePipeline[s] || [];

  res.json({ slug: s, opps, granola, ae_pipeline });
});

// ---------- Team ----------
app.get("/api/team", async (_req, res) => {
  const files = await listMarkdown(DIRS.team);
  const team = await Promise.all(
    files.map(async (f) => {
      const raw = await readFile(path.join(DIRS.team, f));
      const name = f.replace(/\.md$/, "");
      const display = (raw?.match(/^#\s+(.+)$/m)?.[1] || name).trim();
      return { slug: name, name: display, file: f, content: raw || "" };
    })
  );
  res.json({ team });
});

app.post("/api/team", async (req, res) => {
  const { name, role, tenure, focus, aes, goals, watchouts } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const s = slug(name.split(" ")[0]);
  const body = `# ${name.trim()}\n\n- Role: ${role || ""}\n- Tenure: ${tenure || ""}\n- Focus / specialty: ${focus || ""}\n- AEs they support: ${aes || ""}\n- Stated career goals: ${goals || ""}\n- Watch-outs: ${watchouts || ""}\n`;
  const file = path.join(DIRS.team, `${s}.md`);
  await fs.writeFile(file, body, "utf8");
  res.json({ ok: true, file: path.relative(ROOT, file) });
});

// ---------- 1:1 notes ----------
app.post("/api/notes", async (req, res) => {
  const { ta, date, theyRaised, iRaised, actions, notes } = req.body || {};
  if (!ta?.trim()) return res.status(400).json({ error: "ta required" });
  const d = (date || today()).slice(0, 10);
  const s = slug(ta.split(" ")[0]);
  const body = `# 1:1 with ${ta.trim()} — ${d}\n\n## What they raised\n${theyRaised || ""}\n\n## What I raised\n${iRaised || ""}\n\n## Decisions / action items\n${actions || ""}\n\n## Notes\n${notes || ""}\n`;
  const file = path.join(DIRS.notes, `${d}-${s}.md`);
  await fs.writeFile(file, body, "utf8");
  res.json({ ok: true, file: path.relative(ROOT, file) });
});

// ---------- Kudos ----------
app.post("/api/kudos", async (req, res) => {
  const { ta, date, source, summary } = req.body || {};
  if (!ta?.trim() || !summary?.trim()) return res.status(400).json({ error: "ta and summary required" });
  const s = slug(ta.split(" ")[0]);
  const file = path.join(DIRS.kudos, `${s}.md`);
  const existing = (await readFile(file)) || `# Kudos — ${ta.trim()}\n`;
  const entry = `\n## ${(date || today()).slice(0, 10)}${source ? ` · ${source}` : ""}\n${summary.trim()}\n`;
  await fs.writeFile(file, existing + entry, "utf8");
  res.json({ ok: true, file: path.relative(ROOT, file) });
});

app.get("/api/kudos/:ta", async (req, res) => {
  const s = slug(req.params.ta.split(" ")[0]);
  const content = await readFile(path.join(DIRS.kudos, `${s}.md`));
  res.json({ content });
});

// ---------- Capacity ----------
app.post("/api/capacity", async (req, res) => {
  const { date, rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows required" });
  const d = (date || today()).slice(0, 10);
  const header = "name,utilization,hours,customers,notes";
  const csv = [header, ...rows.map((r) =>
    [r.name, r.utilization, r.hours, r.customers, r.notes]
      .map((v) => { const s = String(v ?? "").replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; })
      .join(",")
  )].join("\n");
  const file = path.join(DIRS.data, `capacity-${d}.csv`);
  await fs.writeFile(file, csv, "utf8");
  res.json({ ok: true, file: path.relative(ROOT, file) });
});

// ---------- V2C ----------
app.post("/api/v2c", async (req, res) => {
  const { raw, label } = req.body || {};
  if (!raw?.trim()) return res.status(400).json({ error: "raw required" });
  const tag = slug(label || "v2c-import");
  const file = path.join(DIRS.data, `${tag}-${today()}.txt`);
  await fs.writeFile(file, raw, "utf8");
  res.json({ ok: true, file: path.relative(ROOT, file) });
});

// ---------- Outputs ----------
app.get("/api/outputs", async (_req, res) => {
  const files = (await listMarkdown(DIRS.outputs)).reverse().slice(0, 30);
  res.json({ files });
});

app.get("/api/outputs/:file", async (req, res) => {
  const f = req.params.file;
  if (!/^[\w.\-]+\.md$/.test(f)) return res.status(400).json({ error: "bad filename" });
  const content = await readFile(path.join(DIRS.outputs, f));
  if (content == null) return res.status(404).json({ error: "not found" });
  res.json({ content });
});

// ---------- Manager (managing up) ----------
app.get("/api/manager/actions", async (_req, res) => {
  const raw = await readFile(path.join(DIRS.data, "manager-actions.json"));
  if (!raw) return res.json({ actions: [] });
  res.json(JSON.parse(raw));
});

app.post("/api/manager/actions/:id", async (req, res) => {
  const filePath = path.join(DIRS.data, "manager-actions.json");
  const raw = await readFile(filePath);
  if (!raw) return res.status(404).json({ error: "No actions file" });
  const data = JSON.parse(raw);
  const action = data.actions.find(a => a.id === req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (req.body.status) action.status = req.body.status;
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  res.json({ ok: true, action });
});

app.get("/api/manager", async (_req, res) => {
  const managerFile = path.join(DIRS.data, "manager.json");
  const raw = await readFile(managerFile);
  if (!raw) return res.json({
    name: "Aiysha Mubarik",
    slug: "aiysha",
    last_1on1: null,
    granola_notes: [],
    slack_threads: [],
    priorities: [],
    how_i_can_help: [],
    next_meeting: null,
  });
  res.json(JSON.parse(raw));
});

app.post("/api/manager/sync", async (_req, res) => {
  if (IS_HEROKU) return res.json({ ok: false, error: "Manager sync requires local Claude CLI." });

  const mcpConfig = path.join(ROOT, ".mcp.json");
  const managerFile = path.join(DIRS.data, "manager.json");
  const existing = await readFile(managerFile);
  const prev = existing ? JSON.parse(existing) : {};

  const prompt = `You are gathering context about my manager Aiysha Mubarik so I can support her better.

1. SLACK: Search Slack for recent messages FROM Aiysha Mubarik in the last 14 days using mcp__slack__slack_search_public_and_private with query "from:aiysha.mubarik". Look for:
   - Things she's working on or asking for help with
   - Priorities she's mentioned
   - Asks she's made to the team or org
   - Shoutouts or kudos she's given
   Summarize each relevant thread as: { "date": "YYYY-MM-DD", "channel": "#channel", "summary": "1-2 sentence summary", "type": "priority|ask|kudos|update" }

2. CALENDAR: Use mcp__plugin_google-workspace_vmcp-google-workspace__get_events to find upcoming 1:1 meetings with Aiysha in the next 14 days. Also find the most recent past 1:1.

3. GRANOLA: Read the file at ~/Library/Application Support/Granola/cache-v6.json and look for meetings with "Aiysha" in the title or attendees. Extract the last 3 meeting summaries.

Write the result as JSON to ${managerFile} in this format:
{
  "name": "Aiysha Mubarik",
  "slug": "aiysha",
  "synced_at": "<ISO timestamp>",
  "last_1on1": "YYYY-MM-DD or null",
  "next_meeting": { "date": "YYYY-MM-DD", "time": "HH:MM", "title": "meeting title" } or null,
  "granola_notes": [{ "date": "YYYY-MM-DD", "title": "...", "summary": "..." }],
  "slack_threads": [{ "date": "YYYY-MM-DD", "channel": "...", "summary": "...", "type": "priority|ask|kudos|update" }],
  "priorities": ["inferred priority 1", "inferred priority 2"],
  "how_i_can_help": ["suggestion 1 based on her asks", "suggestion 2"]
}

Be concise. Write the file directly.`;

  try {
    const { spawn } = await import("node:child_process");
    const result = await new Promise((resolve, reject) => {
      const child = spawn("claude", [
        "--print", "--mcp-config", mcpConfig,
        "--allowedTools", "mcp__slack__slack_search_public_and_private,mcp__plugin_google-workspace_vmcp-google-workspace__get_events,Read,Write",
        "-p", prompt
      ], { cwd: ROOT, env: { ...process.env, HOME: process.env.HOME }, timeout: 120000 });
      let stdout = "", stderr = "";
      child.stdout.on("data", d => { stdout += d.toString(); });
      child.stderr.on("data", d => { stderr += d.toString(); });
      child.on("close", code => code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(0, 200) || `Exit ${code}`)));
      child.on("error", reject);
    });
    const updated = await readFile(managerFile);
    res.json({ ok: true, data: updated ? JSON.parse(updated) : {} });
  } catch (e) {
    res.json({ ok: false, error: e.message.slice(0, 200) });
  }
});

// ---------- Dashboard (legacy) ----------
app.get("/api/dashboard", async (_req, res) => {
  const teamFiles = await listMarkdown(DIRS.team);
  const noteFiles = await listMarkdown(DIRS.notes);
  const kudosFiles = await listMarkdown(DIRS.kudos);
  const noteDateFor = (taSlug) => noteFiles.filter((f) => f.endsWith(`-${taSlug}.md`)).map((f) => f.slice(0, 10)).sort().pop() || null;
  const kudosCountFor = async (taSlug) => {
    const content = await readFile(path.join(DIRS.kudos, `${taSlug}.md`));
    return content ? (content.match(/^## /gm) || []).length : 0;
  };
  const capacityCsv = (await fs.readdir(DIRS.data)).filter((f) => f.startsWith("capacity-") && f.endsWith(".csv")).sort().pop();
  let latestCapacity = {};
  if (capacityCsv) {
    const raw = (await readFile(path.join(DIRS.data, capacityCsv))) || "";
    const [, ...rows] = raw.trim().split("\n");
    rows.forEach((row) => {
      const [name, utilization] = row.split(",");
      if (name) latestCapacity[slug(name.split(" ")[0])] = Number(utilization) || null;
    });
  }
  const ta = await Promise.all(teamFiles.map(async (f) => {
    const taSlug = f.replace(/\.md$/, "");
    const raw = await readFile(path.join(DIRS.team, f));
    const display = (raw?.match(/^#\s+(.+)$/m)?.[1] || taSlug).trim();
    return { slug: taSlug, name: display, last1on1: noteDateFor(taSlug), kudosCount: await kudosCountFor(taSlug), utilization: latestCapacity[taSlug] ?? null };
  }));
  res.json({ teamCount: teamFiles.length, latestCapacityFile: capacityCsv || null, ta });
});



const PORT = process.env.PORT || 4178;
app.listen(PORT, () => {
  console.log(`\nmanager-bot web UI  →  http://localhost:${PORT}\n`);
});
