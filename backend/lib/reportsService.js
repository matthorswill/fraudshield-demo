// backend/lib/reportsService.js
const { deriveHitsFR, weightFR } = require('./ruleEngine.fr');

function dayStr(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth()+1).padStart(2,'0');
  const da = String(dt.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function riskBand(score) {
  if (score >= 85) return 'HIGH';
  if (score >= 70) return 'MEDIUM';
  return 'LOW';
}

function linearRegression(xs, ys) {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  let sumX=0,sumY=0,sumXY=0,sumXX=0;
  for (let i=0;i<n;i++){ const x=xs[i], y=ys[i]; sumX+=x; sumY+=y; sumXY+=x*y; sumXX+=x*x; }
  const denom = (n*sumXX - sumX*sumX) || 1;
  const b = (n*sumXY - sumX*sumY) / denom; // slope
  const a = (sumY - b*sumX) / n;            // intercept
  return { a, b };
}

function computeDailyCounts(alerts, transactions) {
  const daily = new Map();
  for (const a of alerts) {
    const k = dayStr(a.created_at || Date.now());
    const tx = transactions.find(t => t.tx_id === a.details?.tx_id);
    const amt = Number(tx?.amount || a.details?.amount || 0);
    const rec = daily.get(k) || { date: k, alerts: 0, amount: 0 };
    rec.alerts += 1; rec.amount += amt; daily.set(k, rec);
  }
  return Array.from(daily.values()).sort((x,y)=>x.date.localeCompare(y.date));
}

function computeChannels(transactions) {
  const m = new Map();
  for (const t of transactions) {
    const k = t.channel || 'OTHER';
    const rec = m.get(k) || { channel: k, count: 0, amount: 0 };
    rec.count += 1; rec.amount += Number(t.amount || 0);
    m.set(k, rec);
  }
  return Array.from(m.values()).sort((a,b)=>b.count-a.count);
}

function computeBands(alerts) {
  const res = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const a of alerts) res[riskBand(a.score)]++;
  return res;
}

function computeTopEntities(alerts, transactions, limit = 25) {
  const byEnt = new Map();
  for (const a of alerts) {
    const key = a.entity;
    const tx = transactions.find(t => t.tx_id === a.details?.tx_id);
    const amt = Number(tx?.amount || a.details?.amount || 0);
    const rec = byEnt.get(key) || { entity: key, entity_name: a.entity_name, alerts: 0, amount: 0, maxScore: 0, lastSeen: a.created_at };
    rec.alerts += 1; rec.amount += amt; rec.maxScore = Math.max(rec.maxScore, a.score || 0);
    if (!rec.entity_name && a.entity_name) rec.entity_name = a.entity_name;
    if (!rec.lastSeen || new Date(a.created_at) > new Date(rec.lastSeen)) rec.lastSeen = a.created_at;
    byEnt.set(key, rec);
  }
  const list = Array.from(byEnt.values()).map(r => ({
    ...r,
    priority: Math.round((r.amount/1000) + r.maxScore*2 + r.alerts*5)
  }));
  list.sort((a,b)=> b.priority - a.priority);
  return list.slice(0, limit);
}

function computePriorityAlerts(alerts, transactions, limit = 50) {
  const withAmt = alerts.map(a => {
    const tx = transactions.find(t => t.tx_id === a.details?.tx_id);
    const amount = Number(tx?.amount || a.details?.amount || 0);
    const currency = tx?.currency || a.details?.currency || 'EUR';
    const priority = Math.round(amount/100 + a.score*3);
    return { ...a, details: { ...a.details, amount, currency }, priority };
  });
  withAmt.sort((a,b)=> b.priority - a.priority);
  return withAmt.slice(0, limit);
}

function computeLegacyBaseline(transactions) {
  // Legacy heuristic: alerts raised only if SWIFT and amount >= 10000
  let count = 0, amount = 0;
  for (const t of transactions) {
    if (t.channel === 'SWIFT' && Number(t.amount) >= 10000) { count++; amount += Number(t.amount); }
  }
  return { count, amount };
}

function predictNextDays(daily, horizon = 7) {
  if (daily.length === 0) return [];
  const xs = daily.map((_,i)=>i);
  const ys = daily.map(d => d.alerts);
  const { a, b } = linearRegression(xs, ys);
  const res = [];
  const lastIdx = xs[xs.length-1];
  for (let i=1;i<=horizon;i++){
    const x = lastIdx + i;
    const y = Math.max(0, Math.round(a + b * x));
    const date = new Date(daily[daily.length-1].date + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate()+i);
    res.push({ date: dayStr(date), alerts: y });
  }
  return res;
}

async function buildReport(datasets, alerts, ai, opts = {}) {
  const { transactions } = datasets;
  const filterChannel = opts.channel || null;
  const alertsFiltered = filterChannel
    ? alerts.filter(a => {
        const tx = transactions.find(t => t.tx_id === a.details?.tx_id);
        const ch = tx?.channel || a.details?.channel;
        return ch === filterChannel;
      })
    : alerts;
  const totals = {
    transactions: transactions.length,
    amount_total: transactions.reduce((s,t)=>s+Number(t.amount||0),0),
    alerts: alertsFiltered.length
  };
  const daily = computeDailyCounts(alertsFiltered, transactions);
  const channels = computeChannels(transactions);
  const bands = computeBands(alertsFiltered);
  const topEntities = computeTopEntities(alertsFiltered, transactions, 25);
  const priorityAlerts = computePriorityAlerts(alertsFiltered, transactions, 50);
  const baseline = computeLegacyBaseline(transactions); // baseline reste global
  const predictions = predictNextDays(daily, 7);

  let suggestions = [];
  try {
    // Use top 3 priority alerts to get suggestions via AI agent
    const top = priorityAlerts.slice(0,3);
    for (const a of top) {
      const tx = transactions.find(t => t.tx_id === a.details?.tx_id);
      if (!ai || !tx) continue;
      const ans = await ai.explain({ transaction: tx, hits: a.details?.hits || [], baseScore: a.score });
      if (Array.isArray(ans?.suggested_actions)) suggestions.push(...ans.suggested_actions);
      else if (ans?.suggested_action) suggestions.push(ans.suggested_action);
    }
  } catch {}
  if (!suggestions.length) suggestions = [
    'Renforcer KYC pour entités à risque élevé',
    'Revoir seuils transactionnels dynamiques selon canaux',
    'Activer surveillance de connexions suspectes (IP ≠ pays d’origine)'
  ];

  // Comparative gain vs legacy baseline
  const additionalDetections = Math.max(0, alerts.length - baseline.count);
  const analysisSummary = `Le moteur détecte ${additionalDetections} cas supplémentaires vs un système legacy (SWIFT + >10k seulement). `+
    `Répartition: HIGH=${bands.HIGH}, MEDIUM=${bands.MEDIUM}, LOW=${bands.LOW}. Top canal: ${(channels[0]||{}).channel}.`;

  return {
    totals,
    timeseries: { daily, predictions },
    channels,
    bands,
    topEntities,
    priorityAlerts,
    suggestions: Array.from(new Set(suggestions)).slice(0,8),
    analysisSummary,
    baseline
  };
}

module.exports = { buildReport };
