// backend/server.js
const express = require("express");
const app = express();

const { loadAll } = require("./lib/dataLoader");
const { buildAlerts } = require("./lib/alertsService");

// CORS simple (démo)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (_req, res) => res.send("OK"));

let DATASETS = null;
let ALERTS = [];
let lastBuiltAt = null;

// charge & calcule au boot
(async () => {
  DATASETS = loadAll();
  ALERTS = await buildAlerts(DATASETS, { threshold: 75 });
  lastBuiltAt = new Date().toISOString();
  console.log(`Loaded data. Alerts: ${ALERTS.length}`);
})().catch(err => {
  console.error("Boot error:", err);
  process.exit(1);
});

// Liste avec recherche / filtres / pagination
app.get("/api/alerts", (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const minScore = Number(req.query.minScore || 0);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)));

  // normalize rule filters: support repeated ?rule=... or comma-separated
  let rules = req.query.rule;
  if (Array.isArray(rules)) {
    rules = rules.flatMap(r => String(r).split(',')).map(s => s.trim()).filter(Boolean);
  } else if (typeof rules === 'string') {
    rules = rules.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    rules = [];
  }

  let items = ALERTS;
  if (q) {
    items = items.filter(a =>
      (a.entity || '').toLowerCase().includes(q) ||
      (a.desc || '').toLowerCase().includes(q) ||
      (a.type || '').toLowerCase().includes(q)
    );
  }
  if (minScore) items = items.filter(a => a.score >= minScore);
  if (rules.length) {
    items = items.filter(a => {
      const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
      return rules.some(r => hits.includes(r));
    });
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  res.json({ total, page, pageSize, lastBuiltAt, items: slice });
});

// Détail
app.get("/api/alerts/:id", (req, res) => {
  const id = Number(req.params.id);
  const a = ALERTS.find(x => x.id === id);
  if (!a) return res.status(404).json({ error: "Not found" });
  res.json(a);
});

// Transactions (filtres simples)
app.get("/api/transactions", (req, res) => {
  try {
    if (!DATASETS) DATASETS = loadAll();
    const { transactions } = DATASETS;
    let list = transactions.slice();

    const label = req.query.label ? String(req.query.label).toLowerCase() : "";
    const minA = Number(req.query.min_amount);
    const maxA = Number(req.query.max_amount);
    const rule = req.query.rule ? String(req.query.rule) : "";
    let limit = Number(req.query.limit || 500);
    if (!Number.isFinite(limit) || limit <= 0) limit = 500;
    limit = Math.min(limit, 2000);

    if (label) list = list.filter(t => String(t.label || '').toLowerCase() === label);
    if (Number.isFinite(minA)) list = list.filter(t => Number(t.amount) >= minA);
    if (Number.isFinite(maxA)) list = list.filter(t => Number(t.amount) <= maxA);
    if (rule) list = list.filter(t => (Array.isArray(t.rule_hits) ? t.rule_hits : String(t.rule_hits||'').split(';')).includes(rule));

    res.json(list.slice(0, limit));
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Recalcul (simple token si besoin)
app.get("/api/recompute", async (req, res) => {
  try {
    DATASETS = loadAll();
    ALERTS = await buildAlerts(DATASETS, { threshold: Number(req.query.threshold || 75) });
    lastBuiltAt = new Date().toISOString();
    res.json({ ok: true, lastBuiltAt, count: ALERTS.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend on http://0.0.0.0:${PORT}`);
});
