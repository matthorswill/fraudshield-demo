// backend/lib/ruleEngine.js
const HIGH_RISK = new Set(['RU','CN']);

function deriveHits(t, entityRisk) {
  const hits = new Set(t.rule_hits || []);
  if ((t.channel === 'SEPA' || t.channel === 'SWIFT') && t.amount >= 10000) hits.add('HIGH_VALUE_TRANSFER');
  if (t.channel === 'CASH' && t.amount >= 9500 && t.amount < 10000) hits.add('CASH_STRUCTURING_NEAR_THRESHOLD');
  if (t.src_country !== t.dst_country) hits.add('CROSS_BORDER');
  if (HIGH_RISK.has(t.src_country) || HIGH_RISK.has(t.dst_country)) hits.add('HIGH_RISK_JURISDICTION');

  // odd hour 00:00-04:59
  try {
    const hour = new Date(t.timestamp).getUTCHours();
    if (hour >=0 && hour <=4 && t.amount > 2000) hits.add('ODD_HOUR_ACTIVITY');
  } catch {}

  if (Math.round(t.amount) % 1000 === 0) hits.add('ROUND_NUMBER_PATTERN');
  if (entityRisk >= 80) hits.add('HIGH_RISK_ENTITY');

  return Array.from(hits);
}

function weight(hit) {
  return ({
    HIGH_VALUE_TRANSFER: 25,
    CASH_STRUCTURING_NEAR_THRESHOLD: 35,
    CROSS_BORDER: 10,
    HIGH_RISK_JURISDICTION: 20,
    ODD_HOUR_ACTIVITY: 10,
    ROUND_NUMBER_PATTERN: 8,
    HIGH_RISK_ENTITY: 12
  })[hit] || 5;
}

function scoreFromHits(hits) {
  let s = 20;
  for (const h of hits) s += weight(h);
  // slight noise
  s += (Math.random() * 6 - 3);
  if (s < 0) s = 0;
  if (s > 99) s = 99;
  return Math.round(s);
}

function riskBand(score) {
  if (score >= 85) return 'HIGH';
  if (score >= 70) return 'MEDIUM';
  return 'LOW';
}

module.exports = { deriveHits, scoreFromHits, riskBand };

