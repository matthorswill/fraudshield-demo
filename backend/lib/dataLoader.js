// backend/lib/dataLoader.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function csv(file) {
  const p = path.join(__dirname, '..', '..', 'data', file);
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

function toInt(x) { const n = parseInt(x, 10); return Number.isFinite(n) ? n : null; }
function toFloat(x){ const n = parseFloat(x);    return Number.isFinite(n) ? n : null; }
function toBool(x){ return String(x).toLowerCase() === 'true'; }

function loadAll() {
  const customers = csv('customers.csv').map(r => ({
    customer_id: toInt(r.customer_id),
    first_name: r.first_name, last_name: r.last_name,
    dob: r.dob, country: r.country, city: r.city, address: r.address,
    email: r.email, phone: r.phone, created_at: r.created_at,
    kyc_level: r.kyc_level, pep: toBool(r.pep),
    sanction_hit: toBool(r.sanction_hit),
    risk_score: toInt(r.risk_score)
  }));

  const companies = csv('companies.csv').map(r => ({
    company_id: toInt(r.company_id),
    name: r.name, country: r.country,
    registration_number: r.registration_number, vat_number: r.vat_number,
    sector: r.sector, created_at: r.created_at,
    beneficial_owner_pep: toBool(r.beneficial_owner_pep),
    risk_score: toInt(r.risk_score)
  }));

  const transactions = csv('transactions.csv').map(r => ({
    tx_id: toInt(r.tx_id),
    timestamp: r.timestamp,
    src_type: r.src_type, src_id: toInt(r.src_id),
    dst_type: r.dst_type, dst_id: toInt(r.dst_id),
    amount: toFloat(r.amount),
    currency: r.currency, channel: r.channel,
    src_country: r.src_country, dst_country: r.dst_country,
    ip_country: r.ip_country,
    crypto_institution_registered: String(r.crypto_institution_registered || '').toLowerCase() === 'true',
    is_cross_border: String(r.is_cross_border).toLowerCase() === 'true',
    rule_hits: r.rule_hits ? r.rule_hits.split(';').filter(Boolean) : [],
    anomaly_score: toInt(r.anomaly_score),
    label: r.label
  }));

  // derive kyc_age_days from created_at (fallback if no explicit kyc date)
  const now = Date.now();
  const kycAgeDaysCustomer = new Map(customers.map(c => [c.customer_id, c.created_at ? Math.max(0, Math.floor((now - Date.parse(c.created_at))/86400000)) : null]));
  const kycAgeDaysCompany = new Map(companies.map(c => [c.company_id, c.created_at ? Math.max(0, Math.floor((now - Date.parse(c.created_at))/86400000)) : null]));

  for (const t of transactions) {
    if (String(t.src_type).toLowerCase() === 'customer' && kycAgeDaysCustomer.has(t.src_id)) {
      t.kyc_age_days = kycAgeDaysCustomer.get(t.src_id) ?? null;
    } else if (String(t.src_type).toLowerCase() === 'company' && kycAgeDaysCompany.has(t.src_id)) {
      t.kyc_age_days = kycAgeDaysCompany.get(t.src_id) ?? null;
    }
  }

  return { customers, companies, transactions };
}

module.exports = { loadAll };
