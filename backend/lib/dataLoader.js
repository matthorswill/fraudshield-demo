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
function toBoolOrNull(x){ if (x === undefined || x === null || x === '') return null; return toBool(x); }

function loadAll() {
  const customers = csv('customers.csv').map(r => ({
    customer_id: toInt(r.customer_id),
    first_name: r.first_name, last_name: r.last_name,
    dob: r.dob, country: r.country, city: r.city, address: r.address,
    email: r.email, phone: r.phone, created_at: r.created_at,
    kyc_level: r.kyc_level, pep: toBool(r.pep),
    sanction_hit: toBool(r.sanction_hit),
    risk_score: toInt(r.risk_score),
    // enriched
    account_iban: r.account_iban,
    customer_segment: r.customer_segment,
    employment_status: r.employment_status,
    annual_income_eur: toInt(r.annual_income_eur),
    kyc_review_date: r.kyc_review_date,
    residency_status: r.residency_status,
    source_of_funds: r.source_of_funds,
    onboarding_channel: r.onboarding_channel,
    last_login_ip_country: r.last_login_ip_country,
  }));

  const companies = csv('companies.csv').map(r => ({
    company_id: toInt(r.company_id),
    name: r.name, country: r.country,
    registration_number: r.registration_number, vat_number: r.vat_number,
    sector: r.sector, created_at: r.created_at,
    beneficial_owner_pep: toBool(r.beneficial_owner_pep),
    risk_score: toInt(r.risk_score),
    // enriched
    swift_bic: r.swift_bic,
    iban: r.iban,
    lei_code: r.lei_code,
    regulator: r.regulator,
    license_number: r.license_number,
    kyc_review_date: r.kyc_review_date,
    aml_contact_email: r.aml_contact_email,
    website: r.website,
    ownership_structure: r.ownership_structure,
    transaction_volume_m12: toInt(r.transaction_volume_m12),
    avg_monthly_turnover: toInt(r.avg_monthly_turnover),
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
    device_id: r.device_id,
    auth_method: r.auth_method,
    mcc: toInt(r.mcc),
    purpose: r.purpose,
    reference: r.reference,
    beneficiary_bank_bic: r.beneficiary_bank_bic,
    beneficiary_iban: r.beneficiary_iban,
    originator_bank_bic: r.originator_bank_bic,
    originator_iban: r.originator_iban,
    fee_amount: toFloat(r.fee_amount),
    exchange_rate: toFloat(r.exchange_rate),
    crypto_institution_registered: toBoolOrNull(r.crypto_institution_registered),
    card_present: toBoolOrNull(r.card_present),
    recurring: toBoolOrNull(r.recurring),
    standing_order: toBoolOrNull(r.standing_order),
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

  // Fallback compute cross-border flag if missing
  for (const t of transactions) {
    if (t.is_cross_border == null && t.src_country && t.dst_country) {
      t.is_cross_border = String(t.src_country) !== String(t.dst_country);
    }
  }

  return { customers, companies, transactions };
}

module.exports = { loadAll };
