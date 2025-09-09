// scripts/enrich-datasets.js
// Enriches CSV datasets with additional banking fields while keeping compatibility
// Run: node scripts/enrich-datasets.js

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const APPEND = Number(process.env.APPEND || process.argv[2] || 0) || 0; // rows to append per CSV

function readCsv(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return parse(raw.replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, trim: true });
}

function csvStringify(rows, headers) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [];
  lines.push(headers.join(','));
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','));
  return lines.join('\n') + '\n';
}

// Helpers to produce deterministic but varied mock values
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function pick(rand, arr){ return arr[Math.floor(rand()*arr.length)]; }

function genIban(rand, country, id){
  const cc = country || 'FR';
  const base = String(100000000000 + (id%100000000000)).padStart(12,'0');
  const bb = String(Math.floor(rand()*89999)+10000);
  return `${cc}76${bb}${base}01`;
}

function genBic(rand, country){
  const bank = pick(rand, ['BNPA','SOGE','CCBP','AGRIF','PSST','BARC','DEUT','CITI','HSBC']);
  const cc = country || pick(rand, ['FR','GB','DE','ES','IT','BE','LU','NL']);
  const loc = pick(rand, ['PP','PA','MM','LX','LL']);
  return `${bank}${cc}${loc}`.slice(0,8) + pick(rand,['XXX','0XX','2A1']);
}

function enrichCustomers(file){
  const rows = readCsv(file);
  const out = [];
  for (const r of rows){
    const id = Number(r.customer_id);
    const rand = mulberry32(1000 + id);
    const country = r.country || 'FR';
    const segment = id%17===0? 'Private' : id%7===0? 'Premium' : 'Retail';
    const employment = pick(rand, ['Salaried','Self-Employed','Student','Retired','Unemployed']);
    const income = Math.round((rand()*120 + 20) * 1000); // 20k - 140k
    const kycReview = new Date(Date.now() - Math.floor(rand()*900)*24*3600*1000).toISOString().slice(0,10);
    const residency = country === 'FR' ? 'Resident' : 'Non-Resident';
    const sof = pick(rand, ['Salary','Business income','Savings','Pension','Investments']);
    const channel = pick(rand, ['Online','Branch','Introduced by RM']);
    const ip = pick(rand, ['FR','FR','FR','DE','ES','GB','BE']);
    const iban = genIban(rand, 'FR', id);

    out.push({
      ...r,
      account_iban: iban,
      customer_segment: segment,
      employment_status: employment,
      annual_income_eur: income,
      kyc_review_date: kycReview,
      residency_status: residency,
      source_of_funds: sof,
      onboarding_channel: channel,
      last_login_ip_country: ip
    });
  }
  // Append synthetic rows if requested
  if (APPEND > 0) {
    let maxId = 0; for (const r of rows) { const n = Number(r.customer_id||0); if (Number.isFinite(n)) maxId = Math.max(maxId, n); }
    for (let i = 1; i <= APPEND; i++) {
      const id = maxId + i;
      const rand = mulberry32(1000 + id);
      const fn = pick(rand, ['Alice','Bob','Chloé','David','Emma','Farid','Hugo','Jules','Khadija','Léa','Nina','Paul','Quentin','Rania','Sarah','Yasmine']);
      const ln = pick(rand, ['Martin','Bernard','Thomas','Petit','Robert','Richard','Durand','Leroy','Moreau','Simon','Laurent','Michel','Garcia','Nguyen']);
      const country = pick(rand, ['FR','FR','FR','DE','ES','IT','BE','LU']);
      const city = pick(rand, ['Paris','Lyon','Marseille','Lille','Nice','Nantes','Rennes','Bordeaux']);
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${id}@example.com`;
      const phone = `+33${Math.floor(rand()*900000000+100000000)}`;
      out.push({
        customer_id: id,
        first_name: fn, last_name: ln,
        dob: `19${Math.floor(60+rand()*40)}-${String(Math.floor(rand()*12)+1).padStart(2,'0')}-${String(Math.floor(rand()*28)+1).padStart(2,'0')}`,
        country, city, address: `${Math.floor(rand()*220)+1} rue des Fleurs`,
        email, phone, created_at: new Date(Date.now()-Math.floor(rand()*1000)*86400000).toISOString().slice(0,10),
        kyc_level: pick(rand,['BASIC','STANDARD','ENHANCED']), pep: String(pick(rand,[false,false,false,true])), sanction_hit: String(false), risk_score: Math.floor(rand()*100),
        account_iban: genIban(rand,'FR',id), customer_segment: pick(rand,['Retail','Premium','Private']),
        employment_status: pick(rand,['Salaried','Self-Employed','Student','Retired']), annual_income_eur: Math.round((rand()*120+20)*1000),
        kyc_review_date: new Date(Date.now()-Math.floor(rand()*900)*86400000).toISOString().slice(0,10),
        residency_status: country==='FR'?'Resident':'Non-Resident', source_of_funds: pick(rand,['Salary','Business income','Savings']), onboarding_channel: pick(rand,['Online','Branch']),
        last_login_ip_country: pick(rand,['FR','DE','ES','GB'])
      });
    }
  }

  const headers = [
    ...Object.keys(rows[0]||{}),
    'account_iban','customer_segment','employment_status','annual_income_eur','kyc_review_date','residency_status','source_of_funds','onboarding_channel','last_login_ip_country'
  ];
  fs.writeFileSync(file, csvStringify(out, headers));
  console.log(`Enriched customers: ${out.length}`);
}

function enrichCompanies(file){
  const rows = readCsv(file);
  const out = [];
  for (const r of rows){
    const id = Number(r.company_id);
    const rand = mulberry32(5000 + id);
    const country = r.country || 'FR';
    const bic = genBic(rand, country);
    const iban = genIban(rand, country==='LU'?'LU':'FR', id);
    const lei = Array.from({length:20},()=>pick(rand,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))).join('');
    const regulator = pick(rand, ['ACPR','AMF','FCA','BaFin','CSSF','FSMA']);
    const license = `${pick(rand,['PSP','EMI','BROK'])}-${String(10000+Math.floor(rand()*90000))}`;
    const kycReview = new Date(Date.now() - Math.floor(rand()*1200)*24*3600*1000).toISOString().slice(0,10);
    const ownership = pick(rand,['Private','Public','Subsidiary']);
    const txVol = Math.round(rand()*50_000_000 + 1_000_000);
    const monthly = Math.round(txVol/12);
    out.push({
      ...r,
      swift_bic: bic,
      iban,
      lei_code: lei,
      regulator,
      license_number: license,
      kyc_review_date: kycReview,
      aml_contact_email: `aml+${id}@example.com`,
      website: `https://company${id}.example.com`,
      ownership_structure: ownership,
      transaction_volume_m12: txVol,
      avg_monthly_turnover: monthly,
    });
  }
  if (APPEND > 0) {
    let maxId = 0; for (const r of rows) { const n = Number(r.company_id||0); if (Number.isFinite(n)) maxId = Math.max(maxId, n); }
    for (let i=1;i<=APPEND;i++){
      const id = maxId + i;
      const rand = mulberry32(5000 + id);
      const country = pick(rand,['FR','DE','ES','IT','BE','LU','GB','IE','NL']);
      const name = `${pick(rand,['Alpha','Beta','Gamma','Delta','Eden','Orion','Quartz','Zenith','Helios','Nimbus'])} ${Math.floor(rand()*900)+100} ${pick(rand,['SAS','SARL','SA','SASU','EURL'])}`;
      out.push({
        company_id:id, name, country,
        registration_number:`RCS${Math.floor(rand()*900000000)+100000000}`, vat_number:`FR${Math.random().toString(36).slice(2,14).toUpperCase()}`,
        sector: pick(rand,['FinTech','Import/Export','Logistique','Conseil','Crypto','Énergie','Tourisme','Santé']), created_at:new Date(Date.now()-Math.floor(rand()*2000)*86400000).toISOString().slice(0,10),
        beneficial_owner_pep:String(pick(rand,[false,false,false,true])), risk_score:Math.floor(rand()*100),
        swift_bic: genBic(rand,country), iban: genIban(rand, country==='LU'?'LU':'FR', id), lei_code: Array.from({length:20},()=>pick(rand,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))).join(''),
        regulator: pick(rand,['ACPR','AMF','FCA','BaFin','CSSF','FSMA']), license_number:`${pick(rand,['PSP','EMI','BROK'])}-${Math.floor(rand()*90000)+10000}`,
        kyc_review_date:new Date(Date.now()-Math.floor(rand()*1200)*86400000).toISOString().slice(0,10), aml_contact_email:`aml+${id}@example.com`, website:`https://company${id}.example.com`,
        ownership_structure: pick(rand,['Private','Public','Subsidiary']), transaction_volume_m12: Math.round(rand()*50_000_000 + 1_000_000), avg_monthly_turnover: Math.round(rand()*4_000_000+200_000)
      });
    }
  }

  const headers = [
    ...Object.keys(rows[0]||{}),
    'swift_bic','iban','lei_code','regulator','license_number','kyc_review_date','aml_contact_email','website','ownership_structure','transaction_volume_m12','avg_monthly_turnover'
  ];
  fs.writeFileSync(file, csvStringify(out, headers));
  console.log(`Enriched companies: ${out.length}`);
}

function enrichTransactions(file){
  const rows = readCsv(file);
  const out = [];
  for (const r of rows){
    const id = Number(r.tx_id);
    const rand = mulberry32(9000 + id);
    const channel = r.channel || 'SEPA';
    const currency = r.currency || 'EUR';
    const srcCountry = r.src_country || 'FR';
    const dstCountry = r.dst_country || 'FR';
    const ipCountry = channel === 'PSU-PSD2' ? pick(rand,['FR','FR','DE','ES','GB']) : '';
    const deviceId = `dev-${String(100000 + Math.floor(rand()*900000))}`;
    const auth = channel === 'CARD' ? pick(rand,['3DS','PIN','SCA']) : pick(rand,['SCA','OTP']);
    const mcc = channel === 'CARD' ? pick(rand,[5411,5732,5999,6011,4829]) : '';
    const purpose = pick(rand,['Invoice','Salary','Rent','Gift','Trade','Crypto']);
    const ref = `${purpose.substring(0,3).toUpperCase()}-${String(100000+Math.floor(rand()*900000))}`;
    const fee = (Math.round((rand()*3 + (channel==='SWIFT'?8:0)) * 100) / 100).toFixed(2);
    const rate = currency === 'EUR' ? 1 : (Math.round((0.8 + rand()*0.6)*10000)/10000);
    const isCB = String(r.is_cross_border||'').toLowerCase() === 'true' || srcCountry !== dstCountry;
    const cryptoReg = channel === 'CRYPTO' ? (['NG','RU','CN'].includes(dstCountry) ? false : true) : '';
    const benBic = genBic(rand, dstCountry);
    const orgBic = genBic(rand, srcCountry);
    const benIban = genIban(rand, dstCountry==='LU'?'LU':'FR', id);
    const orgIban = genIban(rand, srcCountry==='LU'?'LU':'FR', id+1);
    const cardPresent = channel === 'CARD' ? pick(rand,[true,false,false]) : '';
    const recurring = channel === 'SEPA' && purpose === 'Invoice' ? pick(rand,[true,false]) : false;
    const standing = recurring && pick(rand,[true,false]);

    out.push({
      ...r,
      ip_country: ipCountry,
      device_id: deviceId,
      auth_method: auth,
      mcc,
      purpose,
      reference: ref,
      beneficiary_bank_bic: benBic,
      beneficiary_iban: benIban,
      originator_bank_bic: orgBic,
      originator_iban: orgIban,
      fee_amount: fee,
      exchange_rate: rate,
      crypto_institution_registered: cryptoReg,
      card_present: cardPresent,
      recurring,
      standing_order: standing,
      is_cross_border: isCB
    });
  }
  if (APPEND > 0) {
    let maxId = 0; for (const r of rows) { const n = Number(r.tx_id||0); if (Number.isFinite(n)) maxId = Math.max(maxId, n); }
    // Collect some known entity ids
    const customers = new Set(); const companies = new Set();
    try {
      const cust = readCsv(path.join(path.dirname(file),'customers.csv')); cust.forEach(c=>customers.add(Number(c.customer_id)));
    } catch {}
    try {
      const comp = readCsv(path.join(path.dirname(file),'companies.csv')); comp.forEach(c=>companies.add(Number(c.company_id)));
    } catch {}
    const custIds = Array.from(customers); const compIds = Array.from(companies);
    for (let i=1;i<=APPEND;i++){
      const id = maxId + i;
      const rand = mulberry32(9000 + id);
      const srcType = pick(rand,['customer','company']);
      const dstType = pick(rand,['customer','company']);
      const src_id = srcType==='customer' ? pick(rand, custIds.length?custIds:[1]) : pick(rand, compIds.length?compIds:[1]);
      const dst_id = dstType==='customer' ? pick(rand, custIds.length?custIds:[1]) : pick(rand, compIds.length?compIds:[1]);
      const amount = Math.round((rand()*9000+50)*100)/100;
      const currency = pick(rand,['EUR','EUR','EUR','USD','GBP','CHF']);
      const channel = pick(rand,['SEPA','SWIFT','CARD','CASH','PSU-PSD2','CRYPTO']);
      const src_country = pick(rand,['FR','FR','DE','ES','IT','BE','LU','GB','CH','NG','AE','US','CN']);
      const dst_country = pick(rand,['FR','DE','ES','IT','BE','LU','GB','CH','NG','AE','US','CN']);
      const is_cross_border = src_country !== dst_country;
      const ip_country = channel==='PSU-PSD2' ? pick(rand,['FR','DE','ES','GB']) : '';
      const crypto_reg = channel==='CRYPTO' ? pick(rand,[true,true,false]) : '';
      const rule_hits = [];
      if ((channel==='SEPA'||channel==='SWIFT') && amount>=15000) rule_hits.push('KBK_HIGH_AMOUNT_NON_URGENT');
      if (dst_country && !['FR','DE','IT','ES','BE','LU','NL','PT'].includes(dst_country)) rule_hits.push('FONDS_SEIN_PAYS_TIER');
      if (channel==='PSU-PSD2' && ip_country && ip_country!==src_country) rule_hits.push('UTILISATION_CONNECTE');
      if (crypto_reg===false) rule_hits.push('PBR_ATTACHED');
      const hitsStr = rule_hits.join(';');
      out.push({
        tx_id:id, timestamp: new Date(Date.now()-Math.floor(rand()*90)*86400000).toISOString(), src_type:srcType, src_id, dst_type:dstType, dst_id,
        amount, currency, channel, src_country, dst_country, is_cross_border, rule_hits:hitsStr,
        label: pick(rand,['normal','suspect','review']), anomaly_score: Math.round(rand()*100),
        ip_country, device_id:`dev-${Math.floor(rand()*900000+100000)}`, auth_method: channel==='CARD'?'3DS':'SCA', mcc: channel==='CARD'? pick(rand,[5411,5732,5999,6011,4829]) : '',
        purpose: pick(rand,['Invoice','Salary','Rent','Gift','Trade','Crypto']), reference:`REF-${Math.floor(rand()*900000+100000)}`,
        beneficiary_bank_bic: genBic(rand, dst_country), beneficiary_iban: genIban(rand, dst_country==='LU'?'LU':'FR', id),
        originator_bank_bic: genBic(rand, src_country), originator_iban: genIban(rand, src_country==='LU'?'LU':'FR', id+1),
        fee_amount: (Math.round((rand()*3)*100)/100).toFixed(2), exchange_rate: currency==='EUR'?1:(Math.round((0.8+rand()*0.6)*10000)/10000),
        crypto_institution_registered: crypto_reg, card_present: channel==='CARD'? pick(rand,[true,false,false]):'', recurring: channel==='SEPA' && pick(rand,[true,false]), standing_order: false
      });
    }
  }

  const headers = [
    ...Object.keys(rows[0]||{}),
    'ip_country','device_id','auth_method','mcc','purpose','reference','beneficiary_bank_bic','beneficiary_iban','originator_bank_bic','originator_iban','fee_amount','exchange_rate','crypto_institution_registered','card_present','recurring','standing_order','is_cross_border'
  ];
  fs.writeFileSync(file, csvStringify(out, headers));
  console.log(`Enriched transactions: ${out.length}`);
}

function main(){
  const dataDir = path.join(__dirname, '..', 'data');
  enrichCustomers(path.join(dataDir, 'customers.csv'));
  enrichCompanies(path.join(dataDir, 'companies.csv'));
  enrichTransactions(path.join(dataDir, 'transactions.csv'));
  const fr = path.join(dataDir, 'synth-fr');
  if (fs.existsSync(fr)) {
    try {
      enrichCustomers(path.join(fr, 'customers.csv'));
      enrichCompanies(path.join(fr, 'companies.csv'));
      enrichTransactions(path.join(fr, 'transactions.csv'));
    } catch (e) {
      console.warn('synth-fr enrichment warning:', e?.message || e);
    }
  }
}

if (require.main === module) {
  main();
}
