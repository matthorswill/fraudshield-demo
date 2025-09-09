// backend/server.js
const express = require("express");
try { require('./lib/otel'); } catch {}
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const app = express();

const { loadAll } = require("./lib/dataLoader");
const { buildAlerts } = require("./lib/alertsService");
const { buildReport } = require("./lib/reportsService");
const AI = require('./lib/aiAgent');
const dataCtx = require('./lib/dataContext');
let pino = null; try { pino = require('pino'); } catch {}
const logger = pino ? pino({ level: process.env.LOG_LEVEL || 'info' }) : console;
const { withSpan, getTraceId } = (()=>{ try { return require('./lib/tracing'); } catch { return { withSpan: async (_n,_a,fn)=>fn(), getTraceId: ()=>null }; } })();
const Cases = (()=>{ try { return require('./lib/casesService'); } catch { return null; } })();

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get("/", (_req, res) => res.send("OK"));
app.get(["/_status", "/status", "/health", "/healthz"], (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

let DATASETS = null;
let ALERTS = [];
let lastBuiltAt = null;
let LAST_REPORT = null;
const AUDIT_LOG = require('path').join(__dirname,'..','data','audit.log');
const AUDIT_CHAIN = require('path').join(__dirname,'..','data','audit.chain');
const fs = require('fs');
const crypto = require('crypto');
function audit(event, payload) {
  try {
    const entry = { ts:new Date().toISOString(), event, ...payload };
    const line = JSON.stringify(entry);
    fs.appendFileSync(AUDIT_LOG, line + "\n");
    // append hash chain (very lightweight, demo purpose)
    let prev = '';
    try { const parts = fs.readFileSync(AUDIT_CHAIN,'utf8').trim().split('\n'); prev = parts[parts.length-1]?.split(' ')[0] || ''; } catch {}
    const hash = crypto.createHash('sha256').update(prev + line).digest('hex');
    fs.appendFileSync(AUDIT_CHAIN, `${hash} ${entry.ts} ${event}\n`);
  } catch {}
}

// --- Auth & RBAC (HS256 JWT minimal) ---
function base64urlDecode(str){ return Buffer.from(str.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'); }
function base64urlEncode(str){ return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function verifyJwt(token, secret){
  try {
    const [h, p, s] = String(token||'').split('.'); if (!h||!p||!s) return null;
    const data = `${h}.${p}`;
    const sig = crypto.createHmac('sha256', String(secret||''))
      .update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (sig !== s) return null;
    const payload = JSON.parse(base64urlDecode(p));
    if (payload.exp && Date.now()/1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function requireAuth(req,res,next){
  const hdr = req.headers['authorization']||''; const tok = hdr.startsWith('Bearer ')? hdr.slice(7): null;
  const jwt = verifyJwt(tok, process.env.JWT_SECRET || 'dev-secret');
  if (!jwt) return res.status(401).json({ error: 'unauthorized' });
  req.user = { id: jwt.sub, role: jwt.role || 'Viewer', email: jwt.email };
  return next();
}
function requireRole(...roles){
  return (req,res,next)=>{
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

// charge & calcule au boot
(async () => {
  DATASETS = loadAll();
  ALERTS = await buildAlerts(DATASETS, { threshold: 75 });
  LAST_REPORT = await buildReport(DATASETS, ALERTS, require('./lib/aiAgent'));
  lastBuiltAt = new Date().toISOString();
  try { dataCtx.setData({ datasets: DATASETS, alerts: ALERTS, lastReport: LAST_REPORT }); } catch {}
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

// -------- v1 API (banking-grade routing) --------
const v1 = express.Router();

// status
v1.get('/_status', (_req,res)=> res.json({ ok:true, version: process.env.npm_package_version || null, time: new Date().toISOString() }));

// alerts list (reuses logic from /api/alerts)
v1.get('/alerts', (req,res)=>{
  const q = (req.query.q || '').toString().toLowerCase();
  const minScore = Math.max(0, Math.min(100, Number(req.query.minScore||0)));
  let rules = req.query.rule;
  if (Array.isArray(rules)) { rules = rules.flatMap(r=> String(r).split(',').map(s=>s.trim())).filter(Boolean); }
  else if (typeof rules === 'string') { rules = rules.split(',').map(s=>s.trim()).filter(Boolean); }
  else { rules = []; }
  const page = Math.max(1, parseInt(req.query.page||'1',10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize||'50',10)));
  let items = ALERTS;
  if (q) items = items.filter(a => (a.entity||'').toLowerCase().includes(q) || (a.desc||'').toLowerCase().includes(q) || (a.type||'').toLowerCase().includes(q));
  if (minScore) items = items.filter(a => a.score >= minScore);
  if (rules.length) items = items.filter(a => (Array.isArray(a.details?.hits)? a.details.hits: []).some(h => rules.includes(h)));
  const total = items.length; const start=(page-1)*pageSize; const slice = items.slice(start, start+pageSize);
  res.json({ total, page, pageSize, lastBuiltAt, items: slice });
});

// cases list
v1.get('/cases', async (req,res)=>{
  if (!Cases) return res.status(500).json({ error:'Cases service unavailable' });
  await withSpan('cases.list', { filters: JSON.stringify(req.query||{}) }, async ()=>{
    try {
      const out = await Cases.listCases({
        q: req.query.q || '',
        status: Array.isArray(req.query.status) ? req.query.status : (req.query.status ? [req.query.status] : []),
        assignee_id: req.query.assignee_id ? Number(req.query.assignee_id) : undefined,
        risk_band: Array.isArray(req.query.risk_band) ? req.query.risk_band : (req.query.risk_band ? [req.query.risk_band] : []),
        min_amount: req.query.min_amount ? Number(req.query.min_amount) : undefined,
        max_amount: req.query.max_amount ? Number(req.query.max_amount) : undefined,
        over_sla: String(req.query.over_sla||'') === 'true',
        page: req.query.page,
        pageSize: req.query.pageSize,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      logger.info({ traceId: getTraceId(), count: out.items.length }, 'cases.list');
      res.json(out);
    } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

v1.get('/cases/metrics', async (_req,res)=>{
  if (!Cases) return res.status(500).json({ error:'Cases service unavailable' });
  await withSpan('cases.metrics', {}, async ()=>{
    try { const m = await Cases.metrics({}); res.json(m); } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

v1.get('/cases/export.csv', async (req,res)=>{
  if (!Cases) return res.status(500).json({ error:'Cases service unavailable' });
  await withSpan('cases.export', { filters: JSON.stringify(req.query||{}) }, async ()=>{
    try { const csv = await Cases.exportCsv(req.query||{}); res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="cases.csv"'); res.end(csv); }
    catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

v1.get('/cases/:id', async (req,res)=>{
  if (!Cases) return res.status(500).json({ error:'Cases service unavailable' });
  await withSpan('cases.get', { case_id: req.params.id }, async ()=>{
    try { const out = await Cases.getCase(Number(req.params.id)); res.json(out); }
    catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

const IDEMPOTENCY = new Map();
function checkIdempotency(req,res,next){
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  if (IDEMPOTENCY.has(key)) return res.json(IDEMPOTENCY.get(key));
  const send = res.json.bind(res);
  res.json = (body)=>{ try { IDEMPOTENCY.set(key, body); setTimeout(()=>IDEMPOTENCY.delete(key), 10*60*1000); } catch {} return send(body); };
  next();
}

v1.patch('/cases/:id', requireAuth, requireRole('Admin','Analyst'), checkIdempotency, express.json({ limit:'1mb' }), async (req,res)=>{
  if (!Cases) return res.status(500).json({ error:'Cases service unavailable' });
  await withSpan('cases.patch', { case_id: req.params.id }, async ()=>{
    try { const row = await Cases.patchCase(Number(req.params.id), req.body||{}); audit('case_patch', { id: Number(req.params.id), by: req.user?.id||null, patch: req.body||{} }); res.json({ ok:true, case: row }); }
    catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

v1.post('/cases/:id/escalate', requireAuth, requireRole('Admin','Analyst'), checkIdempotency, express.json({ limit:'1mb' }), async (req,res)=>{
  await withSpan('cases.escalate', { case_id: req.params.id }, async ()=>{
    try {
      const approver = String(req.headers['x-approver-id']||'');
      if (!approver || String(approver) === String(req.user?.id||'')) return res.status(400).json({ error:'four-eyes required' });
      audit('case_escalate', { id: Number(req.params.id), by: req.user?.id||null, approver });
      res.json({ ok:true });
    } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

v1.get('/cases/:id/timeline', async (req,res)=>{
  await withSpan('cases.timeline', { case_id: req.params.id }, async ()=>{
    try {
      const text = fs.readFileSync(AUDIT_LOG,'utf8');
      const lines = text.trim().split('\n').map(l=>JSON.parse(l)).filter(e=> String(e.id||'') === String(req.params.id) && String(e.event||'').startsWith('case_'));
      res.json({ items: lines });
    } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

// alert detail
v1.get('/alerts/:id', (req,res)=>{
  const id = Number(req.params.id);
  const found = ALERTS.find(a=> a.id === id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  res.json(found);
});

// escalate alert (RBAC Analyst+)
v1.post('/alerts/:id/escalate', requireAuth, requireRole('Admin','Analyst'), express.json({ limit:'1mb' }), (req,res)=>{
  const id = Number(req.params.id);
  const found = ALERTS.find(a=> a.id === id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  const reason = String(req.body?.reason || '');
  found.status = 'ESCALATED';
  audit('alert_escalate', { id, user: req.user?.id || null, reason: reason.slice(0,240) });
  res.json({ ok:true, id, status: found.status });
});

// transactions list
v1.get('/transactions', (req,res)=>{
  const q = (req.query.q||'').toString().toLowerCase();
  const minA = Number(req.query.min_amount||0);
  const maxA = Number(req.query.max_amount||0);
  const rule = String(req.query.rule||'');
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit||'200',10)));
  let rows = DATASETS?.transactions || [];
  if (q) rows = rows.filter(t => (t.label||'').toLowerCase().includes(q));
  if (minA) rows = rows.filter(t => Number(t.amount||0) >= minA);
  if (maxA) rows = rows.filter(t => Number(t.amount||0) <= maxA);
  if (rule) rows = rows.filter(t => String(t.rule_hits||'').includes(rule));
  res.json(rows.slice(0, limit));
});

// transactions SSE
v1.get('/transactions/stream', (req,res)=>{
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders?.();
  let i = 0;
  const txs = (DATASETS?.transactions || []).slice(0, 500);
  const timer = setInterval(()=>{
    const t = txs[i++ % txs.length];
    if (t) res.write(`event: tick\n` + `data: ${JSON.stringify(t)}\n\n`);
  }, 1000);
  req.on('close', ()=> clearInterval(timer));
});

// entities list
v1.get('/entities', (req,res)=>{
  const map = new Map();
  for (const a of ALERTS) {
    const key = a.entity; const rec = map.get(key) || { entity: key, name: a.entity_name || a.entity, scoreMax: 0, alerts: 0 };
    rec.alerts++; rec.scoreMax = Math.max(rec.scoreMax, a.score || 0); map.set(key, rec);
  }
  res.json({ items: Array.from(map.values()) });
});
v1.get('/entities/:id', (req,res)=>{
  const id = String(req.params.id);
  const alerts = ALERTS.filter(a => a.entity === id);
  const entity = alerts[0]?.entity_name || id;
  res.json({ id, name: entity, alerts });
});

// AI facade
v1.post('/ai/explain-alert', express.json({ limit:'2mb' }), async (req,res)=>{
  try {
    const { tx_id } = req.body || {};
    const tx = (DATASETS?.transactions || []).find(t=> String(t.tx_id) === String(tx_id));
    const a = ALERTS.find(x=> String(x.details?.tx_id) === String(tx_id));
    if (!tx || !a) return res.status(404).json({ error:'not found' });
    const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
    const out = await AI.explain({ transaction: tx, hits, baseScore: a.score });
    audit('ai_explain', { tx_id: tx_id });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});
v1.post('/ai/nl-search', express.json({ limit:'1mb' }), (req,res)=>{
  try {
    const q = String(req.body?.prompt || req.body?.q || '').toLowerCase();
    const out = {};
    if (/cash|esp[eé]ces/.test(q)) out.channel = 'CASH';
    if (/sepa/.test(q)) out.channel = 'SEPA';
    if (/swift/.test(q)) out.channel = 'SWIFT';
    const m = q.match(/>(\s?)(\d+[\dkm\.\,]*)/);
    if (m) { const n = Number(m[2].replace(/k/,'000').replace(/m/,'000000').replace(/[,]/g,'')); out.minAmount = isFinite(n)? n : undefined; }
    const ctry = q.match(/au\s+([A-Za-z]{2})|pays\s+(\w{2})/);
    if (ctry) out.country = (ctry[1]||ctry[2]||'').toUpperCase();
    if (/score\s*>=?\s*(\d{2,3})/.test(q)) { out.minScore = Math.min(100, Number(RegExp.$1)); }
    res.json({ filters: out });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});
v1.post('/ai/generate-tracfin-report', requireAuth, requireRole('Admin','Analyst'), express.json({ limit:'1mb' }), async (req,res)=>{
  try {
    const { alertId } = req.body||{}; const alert = ALERTS.find(a=> a.id === Number(alertId));
    if (!alert) return res.status(404).json({ error:'not found' });
    // For now return a signed-like URL that points to a JSON summary; front can convert to PDF.
    const url = `/v1/reports/${alert.id}.pdf`;
    audit('report_request', { id: alert.id, user: req.user?.id||null });
    res.json({ ok:true, url });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// PDF endpoint
v1.get('/reports/:id.pdf', (req,res)=>{
  const id = Number(req.params.id); const a = ALERTS.find(x=> x.id===id);
  if (!a) return res.status(404).json({ error:'not found' });
  try {
    const PDFDocument = require('pdfkit');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    doc.pipe(res);

    // Header
    doc.fontSize(18).fillColor('#111').text('FraudShield — Rapport Alerte', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(new Date().toLocaleString());
    doc.moveDown(1);

    // Body
    doc.fontSize(12).fillColor('#000').text(`Alerte #${a.id}`, { continued: true }).fillColor('#333').text(`  |  Entité: ${a.entity}`);
    doc.moveDown(0.5);
    doc.fillColor('#000').text(`Score: ${a.score}  |  Bande: ${a.band || ''}`);
    doc.moveDown(0.5);
    if (a.desc) doc.fillColor('#222').text(`Description: ${a.desc}`);
    doc.moveDown(1);

    const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
    if (hits.length){
      doc.fontSize(12).fillColor('#000').text('Anomalies déclenchées:');
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#333');
      hits.slice(0, 20).forEach(h => doc.circle(doc.x - 6, doc.y + 6, 2).fillAndStroke('#666', '#666') && doc.text(`  ${h}`));
      doc.moveDown(0.8);
    }

    // Details table (light)
    const d = a.details || {};
    const rows = [
      ['Transaction', String(d.tx_id || '')],
      ['Montant', `${d.amount || ''} ${d.currency || ''}`],
      ['Canal', String(d.channel || '')],
      ['Origine', String(d.src_country || '')],
      ['Destination', String(d.dst_country || '')],
      ['Date', a.created_at || '']
    ];
    doc.fontSize(12).fillColor('#000').text('Détails');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#111');
    rows.forEach(([k,v]) => { doc.text(`${k}: ${v}`); });

    doc.end();
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// CSV exports
v1.get('/alerts.csv', (_req,res)=>{
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="alerts.csv"');
  res.write('id,entity,entity_name,score,band,created_at\n');
  for (const a of ALERTS) res.write(`${a.id},"${a.entity}","${a.entity_name||''}",${a.score},${a.band||''},${a.created_at||''}\n`);
  res.end();
});
v1.get('/transactions.csv', (_req,res)=>{
  const rows = DATASETS?.transactions || [];
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="transactions.csv"');
  res.write('tx_id,timestamp,amount,currency,channel,src_type,src_id,dst_type,dst_id,src_country,dst_country,rule_hits,anomaly_score,label\n');
  for (const t of rows) res.write(`${t.tx_id},${t.timestamp},${t.amount},${t.currency},${t.channel},${t.src_type},${t.src_id},${t.dst_type},${t.dst_id},${t.src_country},${t.dst_country},"${t.rule_hits}",${t.anomaly_score||0},"${(t.label||'').replace(/"/g,'\"')}"\n`);
  res.end();
});

// Admin rules update (API key)
v1.post('/rules', express.json({ limit:'1mb' }), (req,res)=>{
  const key = req.headers['x-api-key'] || req.query.key;
  if (!key || key !== (process.env.ADMIN_API_KEY || '')) return res.status(401).json({ error: 'unauthorized' });
  // Accept but not persist (demo)
  audit('rules_update', { size: JSON.stringify(req.body||{}).length });
  res.json({ ok:true });
});

app.use('/v1', v1);

// AI router with RBAC
try {
  const { requireAuth, requireRole } = require('./mw/auth');
  app.use('/v1/ai', requireAuth, requireRole('Admin','Analyst'), require('./routes/ai'));
} catch {}

// -------- Signed link sharing for reports --------
function signShareToken(payloadObj){
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const payload = base64urlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${payload}.${sig}`;
}
function verifyShareToken(token){
  try {
    const [payload, sig] = String(token||'').split('.'); if (!payload||!sig) return null;
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const expect = crypto.createHmac('sha256', secret).update(payload).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (expect !== sig) return null;
    const obj = JSON.parse(base64urlDecode(payload));
    if (!obj.exp || Date.now()/1000 > obj.exp) return null;
    return obj;
  } catch { return null; }
}

// Create signed link (24h default)
app.post('/v1/reports/share', express.json({ limit:'1mb' }), (req,res)=>{
  // Allow either JWT Analyst/Admin or X-API-Key
  const key = req.headers['x-api-key'] || req.query.key;
  let role = null;
  if (key && key === (process.env.ADMIN_API_KEY || '')) role = 'Admin';
  if (!role) {
    const hdr = req.headers['authorization']||''; const tok = hdr.startsWith('Bearer ')? hdr.slice(7): null;
    const jwt = verifyJwt(tok, process.env.JWT_SECRET || 'dev-secret');
    if (jwt && (jwt.role === 'Admin' || jwt.role === 'Analyst')) role = jwt.role;
  }
  // Dev-only bypass
  const devBypass = process.env.ALLOW_PUBLIC_SHARE_LINKS === 'true' && process.env.NODE_ENV !== 'production';
  if (!role && !devBypass) return res.status(401).json({ error:'unauthorized' });

  const alertId = Number(req.body?.alertId);
  if (!alertId) return res.status(400).json({ error:'alertId required' });
  const a = ALERTS.find(x=> x.id === alertId);
  if (!a) return res.status(404).json({ error:'not found' });
  const ttl = Math.max(60, Math.min(7*24*3600, Number(req.body?.expireSeconds || 24*3600)));
  const token = signShareToken({ id: alertId, exp: Math.floor(Date.now()/1000) + ttl });
  const url = `${req.protocol}://${req.get('host')}/v1/reports/shared/${token}`;
  audit('report_share', { id: alertId, ttl, dev_bypass: !!devBypass });
  res.json({ ok:true, url, expires_in: ttl });
});

// Consume signed link
app.get('/v1/reports/shared/:token', (req,res)=>{
  const t = String(req.params.token||'');
  const v = verifyShareToken(t);
  if (!v) return res.status(401).json({ error:'invalid_or_expired' });
  return res.redirect(302, `/v1/reports/${v.id}.pdf`);
});

// Détail
app.get("/api/alerts/:id", (req, res) => {
  const id = Number(req.params.id);
  const a = ALERTS.find(x => x.id === id);
  if (!a) return res.status(404).json({ error: "Not found" });
  res.json(a);
});

// Investigation report (LLM-assisted)
app.get('/api/alerts/:id/investigate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const alert = ALERTS.find(x => x.id === id);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    const tx = DATASETS.transactions.find(t => t.tx_id === alert.details?.tx_id);
    const neigh = DATASETS.transactions.filter(t => `${t.src_type}:${t.src_id}` === alert.entity).slice(0,100);
    const out = await AI.investigateAlert({ alert, transaction: tx, neighborTx: neigh, entities: {} });
    audit('investigate', { id, entity: alert.entity, score: alert.score });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Simple KPI overview
app.get('/api/kpi', (req,res) => {
  try {
    const totalTx = DATASETS?.transactions?.length || 0;
    const totalAlerts = ALERTS.length;
    const avoided = ALERTS.reduce((s,a)=> s + Number(a?.details?.amount||0) * (a.score/100) * 0.2, 0); // assume 20% recovery factor
    const falsePositiveRate = Math.max(0, Math.min(1, 1 - (totalAlerts / Math.max(1,totalTx*0.15))));
    const complianceCost = totalAlerts * 5; // minutes per alert (demo)
    const roi = avoided / Math.max(1, complianceCost);
    const byMonth = new Map();
    for (const a of ALERTS) { const d = new Date(a.created_at); const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; const v = byMonth.get(k)||{month:k, alerts:0, amount:0}; v.alerts++; v.amount+=Number(a?.details?.amount||0); byMonth.set(k,v); }
    res.json({ totalTx, totalAlerts, avoided_fraud_eur: Math.round(avoided), false_positive_rate: falsePositiveRate, roi, monthly: Array.from(byMonth.values()).sort((x,y)=>x.month.localeCompare(y.month)) });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
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

// Reports snapshot (aggregations + suggestions + predictions)
app.get("/api/reports", async (req, res) => {
  try {
    if (!DATASETS) DATASETS = loadAll();
    if (!ALERTS || !ALERTS.length) ALERTS = await buildAlerts(DATASETS, { threshold: 75 });
    const rep = await buildReport(DATASETS, ALERTS, require('./lib/aiAgent'), { channel: req.query.channel || null });
    LAST_REPORT = rep;
    return res.json({ lastBuiltAt, report: rep });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Force refresh report snapshot (admin)
app.get("/api/reports/refresh", requireApiKey, async (req, res) => {
  try {
    if (!DATASETS) DATASETS = loadAll();
    if (!ALERTS || !ALERTS.length) ALERTS = await buildAlerts(DATASETS, { threshold: 75 });
    const rep = await buildReport(DATASETS, ALERTS, require('./lib/aiAgent'), { channel: req.query.channel || null });
    LAST_REPORT = rep;
    lastBuiltAt = new Date().toISOString();
    res.json({ ok: true, lastBuiltAt, report: rep });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Simple SSE stream of real-time metrics (demo)
app.get('/api/stream/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (ev, data) => { res.write(`event: ${ev}\n`); res.write(`data: ${JSON.stringify(data)}\n\n`); };

  let i = 0;
  const timer = setInterval(() => {
    try {
      const now = new Date().toISOString();
      const txRate = 20 + Math.round(10*Math.sin(Date.now()/5000));
      const alertRate = Math.max(0, Math.round(txRate * 0.1 + (Math.random()*2-1)));
      const highShare = Math.max(0, Math.min(1, 0.3 + 0.1*Math.sin(Date.now()/12000)));
      const payload = { ts: now, tx_per_sec: txRate, alerts_per_min: alertRate*6, high_share: highShare };
      send('metrics', payload);
      if (++i % 15 === 0) send('ping', { ts: now });
    } catch {}
  }, 1000);

  req.on('close', () => { clearInterval(timer); try { res.end(); } catch {} });
});

// Prepare ingestion (bulk). Demo memory queue + API key protection.
const INGEST_QUEUE = [];
const MAX_INGEST_QUEUE = Number(process.env.MAX_INGEST_QUEUE || 10000);
app.post('/api/ingest/transactions', express.json({ limit: '10mb' }), requireApiKey, (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : (req.body && req.body.records ? req.body.records : []);
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Expected array of records or {records:[]}' });
    // Backpressure: cap queue size
    for (const r of records) {
      if (INGEST_QUEUE.length >= MAX_INGEST_QUEUE) { INGEST_QUEUE.shift(); }
      INGEST_QUEUE.push(r);
    }
    return res.json({ queued: records.length, queue_size: INGEST_QUEUE.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Share to Microsoft Teams via Incoming Webhook (text summary)
app.post('/api/share/teams', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const url = process.env.TEAMS_WEBHOOK_URL;
    if (!url) return res.status(400).json({ ok: false, error: 'TEAMS_WEBHOOK_URL not configured' });
    const text = req.body?.text || 'Rapport fraudshield';
    const payload = { text };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) return res.status(500).json({ ok: false, error: `Teams webhook error ${resp.status}` });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Real-time scoring API (for internal systems)
app.post('/api/score', express.json({ limit: '1mb' }), async (req,res) => {
  try {
    const t = req.body || {};
    // derive hits using current rule engine
    const { deriveHitsFR, weightFR } = require('./lib/ruleEngine.fr');
    const hits = deriveHitsFR(t, 0, []);
    const score = Math.max(0, Math.min(100, hits.reduce((s,h)=>s + (weightFR(h)||0), 0)));
    const ai = await AI.explain({ transaction: t, hits, baseScore: score });
    audit('score', { score, hits, tx_id: t.tx_id });
    res.json({ score, hits, explanation: ai.explanation, suggested_action: ai.suggested_action });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Copilot chat
app.post('/api/copilot', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const question = String(req.body?.question || '');
    const context = { stats: LAST_REPORT?.totals, bands: LAST_REPORT?.bands };
    const out = await AI.copilot({ question, context });
    audit('copilot', { q: question.slice(0,120) });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Natural language filter (very simple heuristic)
app.post('/api/nlq', express.json({ limit: '1mb' }), (req,res) => {
  try {
    const q = String(req.body?.q || '').toLowerCase();
    const out = {};
    if (/cash|esp[eè]ces/.test(q)) out.channel = 'CASH';
    if (/sepa/.test(q)) out.channel = 'SEPA';
    if (/swift/.test(q)) out.channel = 'SWIFT';
    const m = q.match(/>(\s?)(\d+[\dkm\.\,]*)/);
    if (m) { const n = Number(m[2].replace(/k/,'000').replace(/m/,'000000').replace(/[,]/g,'')); out.minAmount = isFinite(n)? n : undefined; }
    const ctry = q.match(/au\s+([A-Za-z]{2})|pays\s+(\w{2})/);
    if (ctry) out.country = (ctry[1]||ctry[2]||'').toUpperCase();
    if (/score\s*>=?\s*(\d{2,3})/.test(q)) { out.minScore = Math.min(100, Number(RegExp.$1)); }
    res.json({ filters: out });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Compliance advice for an alert
app.get('/api/compliance/advice', async (req,res) => {
  try {
    const id = Number(req.query.alertId);
    const alert = ALERTS.find(x=>x.id===id);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    const out = await AI.complianceAdvice({ alert });
    audit('compliance_advice', { id });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Graph around an entity
app.get('/api/graph/entity', (req,res) => {
  try {
    const entity = String(req.query.entity||'');
    if (!entity) return res.status(400).json({ error: 'entity required (e.g., customer:12)' });
    const nodes = new Map(); const links = [];
    const txs = DATASETS.transactions.filter(t => `${t.src_type}:${t.src_id}`===entity || `${t.dst_type}:${t.dst_id}`===entity).slice(0,500);
    const addNode = (id,label,type)=>{ if(!nodes.has(id)) nodes.set(id,{ id,label,type }); };
    addNode(entity, entity, 'entity');
    for (const t of txs){ const to=`${t.dst_type}:${t.dst_id}`; addNode(to,to,'entity'); links.push({ source: `${t.src_type}:${t.src_id}`, target: to, amount: t.amount, channel: t.channel }); }
    res.json({ nodes:[...nodes.values()], links });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Crypto flows summary
app.get('/api/crypto/flows', (req,res) => {
  try {
    const entity = req.query.entity ? String(req.query.entity) : null;
    const txs = DATASETS.transactions.filter(t => t.channel === 'CRYPTO' && (!entity || `${t.src_type}:${t.src_id}`===entity || `${t.dst_type}:${t.dst_id}`===entity));
    const total = txs.reduce((s,t)=>s+Number(t.amount||0),0);
    const unreg = txs.filter(t => String(t.crypto_institution_registered) !== 'true');
    const unregTotal = unreg.reduce((s,t)=>s+Number(t.amount||0),0);
    res.json({ count: txs.length, total, unregistered_total: unregTotal, share_unregistered: txs.length? (unreg.length/txs.length):0 });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Behavior change detection (simple deltas)
app.get('/api/behavior/delta', (req,res) => {
  try {
    const entity = String(req.query.entity||''); if (!entity) return res.status(400).json({ error: 'entity required' });
    const txs = DATASETS.transactions.filter(t => `${t.src_type}:${t.src_id}`===entity).sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
    const half = Math.max(1, Math.floor(txs.length/2));
    const early = txs.slice(0,half); const late = txs.slice(half);
    const sum = arr => arr.reduce((s,t)=>s+Number(t.amount||0),0);
    const r = { early_avg: early.length? sum(early)/early.length:0, late_avg: late.length? sum(late)/late.length:0, change: 0 };
    r.change = (r.late_avg - r.early_avg) / Math.max(1,r.early_avg);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Sanctions check (very light stub)
app.get('/api/sanctions/check', (req,res) => {
  try {
    const name = String(req.query.name||'').toUpperCase();
    const flagged = /TEST|SANCTION|DOE/.test(name);
    res.json({ name, flagged, list: flagged ? ['OFAC','UE'] : [] });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// KYC document verify (stub)
app.post('/api/kyc/verify', express.json({ limit: '10mb' }), (req,res) => {
  try {
    const { doc_type='ID', image_url, content_base64 } = req.body||{};
    const score = image_url || content_base64 ? 0.82 : 0.5;
    const findings = score>0.8 ? [] : ['Faible qualité image'];
    res.json({ doc_type, score_document_authenticity: score, findings });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Stress test simulation: impact if undetected X days
app.get('/api/simulate/stress', (req,res) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days||90)));
    const factor = 1 + days/365; // simplistic
    const impact = ALERTS.reduce((s,a)=> s + Number(a.details?.amount||0) * (a.score/100) * factor * 0.1, 0);
    res.json({ days, estimated_impact_eur: Math.round(impact) });
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// Rules versioning (dynamic weights) — demo file store
const RULES_FILE = require('path').join(__dirname,'..','data','rules.json');
function readRules() { try { return JSON.parse(fs.readFileSync(RULES_FILE,'utf8')); } catch { return { version: 1, updatedAt: new Date().toISOString(), weights: {} }; } }
function writeRules(obj) { obj.updatedAt = new Date().toISOString(); fs.writeFileSync(RULES_FILE, JSON.stringify(obj,null,2)); }
app.get('/api/rules', (_req,res)=>{ res.json(readRules()); });
app.post('/api/rules', express.json({ limit: '1mb' }), requireApiKey, (req,res)=>{ try { const r = readRules(); r.version=(r.version||0)+1; r.weights = { ...(r.weights||{}), ...(req.body?.weights||{}) }; writeRules(r); audit('rules_update', { keys: Object.keys(req.body?.weights||{}) }); res.json(r); } catch(e){ res.status(500).json({ error: e?.message||String(e) }); } });
app.get('/api/openapi.json', (_req,res)=>{ res.json({ openapi:'3.0.0', info:{ title:'FraudShield API', version:'1.0.0' }, paths: { '/api/alerts':{get:{}}, '/api/alerts/{id}':{get:{}}, '/api/alerts/{id}/investigate':{get:{}}, '/api/reports':{get:{}}, '/api/stream/metrics':{get:{}}, '/api/transactions':{get:{}}, '/api/score':{post:{}}, '/api/copilot':{post:{}}, '/api/nlq':{post:{}}, '/api/graph/entity':{get:{}}, '/api/crypto/flows':{get:{}}, '/api/behavior/delta':{get:{}}, '/api/compliance/advice':{get:{}}, '/api/kpi':{get:{}}, '/api/simulate/stress':{get:{}}, '/api/rules':{get:{},post:{}}, '/api/kyc/verify':{post:{}}, '/api/sanctions/check':{get:{}}, '/api/reports/top-losses':{get:{}}, '/api/share/teams':{post:{}} } }); });

// Top losses over period
app.get('/api/reports/top-losses', (req,res) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days||7)));
    const since = Date.now() - days*24*3600*1000;
    const list = ALERTS.filter(a => new Date(a.created_at).getTime() >= since)
      .map(a => ({ id:a.id, entity:a.entity_name||a.entity, amount:a.details?.amount||0, score:a.score, date:a.created_at }))
      .sort((x,y)=> (y.amount*y.score) - (x.amount*x.score)).slice(0,10);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
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
