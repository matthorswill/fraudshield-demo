// backend/lib/alertsService.js
const { deriveHitsFR, weightFR } = require('./ruleEngine.fr');
const { explain } = require('./aiAgent');

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function buildHistoryMap(transactions) {
  const historyMap = new Map();
  for (const tx of transactions) {
    const key = `${tx.src_type}:${tx.src_id}`;
    const arr = historyMap.get(key) || [];
    arr.push({ tx_type: tx.src_type, dst_id: tx.dst_id, date: new Date(tx.timestamp) });
    historyMap.set(key, arr);
  }
  return historyMap;
}

function riskBand(score) {
  if (score >= 85) return 'HIGH';
  if (score >= 70) return 'MEDIUM';
  return 'LOW';
}

function indexEntities({ customers, companies }) {
  const cust = new Map(customers.map(c => [c.customer_id, c]));
  const comp = new Map(companies.map(c => [c.company_id, c]));
  return { cust, comp };
}

async function buildAlerts(datasets, { threshold = 75 } = {}) {
  const { customers, companies, transactions } = datasets;
  const idx = indexEntities(datasets);
  const history = buildHistoryMap(transactions);

  const alerts = [];
  const flagCounts = new Map(); // key = entityKey, value = count so far
  let idCounter = 1;
  for (const t of transactions) {
    const isCustomer = String(t.src_type).toLowerCase() === 'customer';
    const entity = isCustomer
      ? idx.cust.get(t.src_id)
      : idx.comp.get(t.src_id);
    const entityRisk = entity?.risk_score ?? 0;

    const hits = deriveHitsFR(t, entityRisk, history.get(`${t.src_type}:${t.src_id}`) || []);
    const score = clamp(hits.reduce((s, h) => s + (weightFR(h) || 0), 0), 0, 100);
    if (score < threshold) continue;

    const ai = await explain({ transaction: t, hits, baseScore: score });
    const entityKey = `${t.src_type}:${t.src_id}`;
    const prev = flagCounts.get(entityKey) || 0;
    flagCounts.set(entityKey, prev + 1);
    const entityName = isCustomer
      ? `${entity?.first_name || 'Client'} ${entity?.last_name || t.src_id}`.trim()
      : (entity?.name || `${t.src_type} ${t.src_id}`);

    alerts.push({
      id: idCounter++,
      type: "Transaction Anomaly",
      score,
      band: riskBand(score),
      entity: `${t.src_type}:${t.src_id}`,
      entity_name: entityName,
      desc: ai.explanation || `Hits: ${hits.join(', ')}`,
      suggested_action: ai.suggested_action || undefined,
      suggested_actions: ai.suggested_actions || undefined,
      created_at: t.timestamp,
      details: {
        tx_id: t.tx_id,
        src_country: t.src_country,
        dst_country: t.dst_country,
        channel: t.channel,
        hits,
        previously_flagged_count: prev
      }
    });

    try {
      console.log("ALERT", alerts[alerts.length-1].id, entityName, hits);
    } catch {}
  }

  alerts.sort((a,b) => b.score - a.score);
  return alerts;
}

module.exports = { buildAlerts };
