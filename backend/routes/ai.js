// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const { chat } = require('../lib/aiProvider');
const { maskAlertTx } = require('../lib/maskForAI');
const { audit } = require('../lib/audit');
const { withSpan, getTraceId } = (()=>{ try { return require('../lib/tracing'); } catch { return { withSpan: async (_n,_a,fn)=>fn(), getTraceId: ()=>null }; } })();
let pino = null; try { pino = require('pino'); } catch {}
const logger = pino ? pino({ level: process.env.LOG_LEVEL || 'info' }) : console;
const data = require('../lib/dataContext');

router.post('/explain-alert', express.json({ limit:'1mb' }), async (req,res)=>{
  const tx_id = Number(req.body?.tx_id);
  if (!tx_id) return res.status(400).json({ error:'tx_id required' });
  await withSpan('ai.explain_alert', { 'ai.mode': String(process.env.AI_MODE||'LOCAL'), 'ai.endpoint':'explain-alert' }, async ()=>{
    try {
      const datasets = data.getDatasets(); const alerts = data.getAlerts();
      const tx = (datasets?.transactions || []).find(t => Number(t.tx_id) === tx_id);
      const alert = alerts.find(a => Number(a.details?.tx_id) === tx_id);
      if (!tx || !alert) return res.status(404).json({ error:'not found' });
      const masked = maskAlertTx(alert, tx);
      const prompt = [
        { role:'system', content:'Copilote AML FR concis. Donne 1 explication + 3 actions graduées.' },
        { role:'user', content: JSON.stringify(masked) }
      ];
      const text = await chat(prompt);
      audit('ai_explain_masked', { tx_id, mode: process.env.AI_MODE || 'LOCAL', masked, traceId: getTraceId() });
      logger.info({ traceId: getTraceId(), ai_mode: process.env.AI_MODE||'LOCAL' }, 'ai.explain_alert');
      res.json({ explanation: text });
    } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

router.post('/copilot', express.json({ limit:'2mb' }), async (req,res)=>{
  const q = String(req.body?.question || '');
  if (!q) return res.status(400).json({ error:'question required' });
  await withSpan('ai.copilot', { 'ai.mode': String(process.env.AI_MODE||'LOCAL'), 'ai.endpoint':'copilot' }, async ()=>{
    try {
      const last = data.getLastReport();
      const context = last ? { totals: last.totals, bands: last.bands } : {};
      const messages = [
        { role:'system', content:'Copilote AML FR. Réponds de façon concise et non décisionnelle.' },
        { role:'user', content: JSON.stringify({ question: q.slice(0,500), context }) }
      ];
      const ans = await chat(messages);
      audit('ai_copilot_q', { q: q.slice(0,120), traceId: getTraceId() });
      logger.info({ traceId: getTraceId(), ai_mode: process.env.AI_MODE||'LOCAL' }, 'ai.copilot');
      res.json({ answer: ans });
    } catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
  });
});

module.exports = router;

