// backend/lib/ruleEngine.fr.js
const HIGH_RISK_COUNTRIES = new Set(["RU", "CN", "IR", "KP", "SY"]);
const NB_SUSPICIOUS = 5;

function deriveHitsFR(t, entityRisk = 0, entityHistory = []) {
  const hits = new Set(Array.isArray(t.rule_hits) ? t.rule_hits : String(t.rule_hits || "").split(/[;,\s]+/).filter(Boolean));

  if ((t.channel === 'SEPA' || t.channel === 'SWIFT') && Number(t.amount) >= 15000)
    hits.add('KBK_HIGH_AMOUNT_NON_URGENT');

  const EU_OK = new Set(["FR","DE","IT","ES","BE","LU","NL","PT"]);
  if (t.dst_country && !EU_OK.has(String(t.dst_country)))
    hits.add('FONDS_SEIN_PAYS_TIER');

  const monthAgo = new Date(Date.now() - 30*24*3600*1000);
  const recent = (entityHistory || []).filter(x => x && x.date && x.date >= monthAgo && String(x.dst_id) !== String(t.dst_id));
  if (recent.length >= NB_SUSPICIOUS)
    hits.add('VIREMENT_IRREGULIER');

  if (t.channel === 'PSU-PSD2' && t.ip_country && t.src_country && t.ip_country !== t.src_country)
    hits.add('UTILISATION_CONNECTE');

  if (Number(t.kyc_age_days) > 18*30) hits.add('KYC_OBSOLE');

  if (t.channel === 'CRYPTO' && String(t.crypto_institution_registered) !== 'true')
    hits.add('PBR_ATTACHED');

  if ((t.channel === 'SEPA' || t.channel === 'SWIFT') && Number(t.amount) >= 10000)
    hits.add('HIGH_VALUE_TRANSFER');
  if (t.channel === 'CASH' && Number(t.amount) >= 9500 && Number(t.amount) < 10000)
    hits.add('CASH_STRUCTURING_NEAR_THRESHOLD');
  if (t.src_country && t.dst_country && t.src_country !== t.dst_country) hits.add('CROSS_BORDER');
  if (t.src_country && HIGH_RISK_COUNTRIES.has(t.src_country) || (t.dst_country && HIGH_RISK_COUNTRIES.has(t.dst_country)))
    hits.add('HIGH_RISK_JURISDICTION');

  const ts = new Date(t.timestamp || Date.now());
  const hour = ts.getUTCHours();
  if (hour >= 0 && hour <= 4 && Number(t.amount) > 2000) hits.add('ODD_HOUR_ACTIVITY');
  if (Math.round(Number(t.amount)) % 1000 === 0) hits.add('ROUND_NUMBER_PATTERN');
  if (Number(entityRisk) >= 80) hits.add('HIGH_RISK_ENTITY');

  return Array.from(hits);
}

function weightFR(hit) {
  return ({
    KBK_HIGH_AMOUNT_NON_URGENT: 30,
    FONDS_SEIN_PAYS_TIER: 20,
    VIREMENT_IRREGULIER: 25,
    UTILISATION_CONNECTE: 20,
    KYC_OBSOLE: 15,
    PBR_ATTACHED: 30,
    HIGH_VALUE_TRANSFER: 15,
    CASH_STRUCTURING_NEAR_THRESHOLD: 20,
    CROSS_BORDER: 10,
    HIGH_RISK_JURISDICTION: 15,
    ODD_HOUR_ACTIVITY: 10,
    ROUND_NUMBER_PATTERN: 8,
    HIGH_RISK_ENTITY: 12,
  })[hit] || 5;
}

module.exports = { deriveHitsFR, weightFR };
