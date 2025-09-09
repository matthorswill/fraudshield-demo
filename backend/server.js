// backend/server.js
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const app = express();

const { loadAll } = require("./lib/dataLoader");
const { buildAlerts } = require("./lib/alertsService");

// Trust proxy for correct IPs behind Render/Proxies
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  referrerPolicy: { policy: "no-referrer" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.disable('x-powered-by');

// Basic compression
app.use(compression());

// Global rate limiting (per IP)
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS restricted to configured frontend origin or localhost
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  if (!origin || origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get("/", (_req, res) => res.send("OK"));
app.get("/_status", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
  const minScoreRaw = Number(req.query.minScore || 0);
  const minScore = Number.isFinite(minScoreRaw) ? Math.max(0, Math.min(100, minScoreRaw)) : 0;
  const pageRaw = parseInt(req.query.page || '1', 10);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = parseInt(req.query.pageSize || '50', 10);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(100, Math.max(1, pageSizeRaw)) : 50;

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

// Simple API-key middleware for admin endpoints
function requireApiKey(req, res, next) {
  const key = req.header('X-API-Key');
  if (!process.env.ADMIN_API_KEY || key === process.env.ADMIN_API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Recalcul (protégé par clé d'API)
app.get("/api/recompute", requireApiKey, async (req, res) => {
  try {
    const thrRaw = Number(req.query.threshold || 75);
    const threshold = Number.isFinite(thrRaw) ? Math.max(0, Math.min(100, thrRaw)) : 75;
    DATASETS = loadAll();
    ALERTS = await buildAlerts(DATASETS, { threshold });
    lastBuiltAt = new Date().toISOString();
    res.json({ ok: true, lastBuiltAt, count: ALERTS.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Centralized error handler (no stack trace leak)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  try { console.error('ERR', new Date().toISOString(), err?.message || err); } catch {}
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend on http://0.0.0.0:${PORT}`);
});
