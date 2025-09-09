// Seed PostgreSQL from CSV files in data/
const fs = require('fs');
const path = require('path');
const { Client } = (()=>{ try { return require('pg'); } catch { console.error('Missing dependency: pg'); process.exit(1); } })();
const parse = require('csv-parse').parse;

async function main(){
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fraudshield';
  const client = new Client({ connectionString: url });
  await client.connect();
  const schema = fs.readFileSync(path.join(__dirname,'sql','001_schema.sql'),'utf8');
  await client.query(schema);

  // Upsert entities from customers and companies
  async function loadEntities(csvPath, type){
    const content = fs.readFileSync(csvPath,'utf8');
    const rows = await new Promise((resolve, reject)=> parse(content, { columns:true, skip_empty_lines:true }, (err, recs)=> err?reject(err):resolve(recs)));
    for (const r of rows){
      await client.query('INSERT INTO entities(type,name,country,kyc_status,risk_score) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [type, r.name||r.entity||'', r.country||null, r.kyc_status||null, Number(r.risk_score||0)]);
    }
  }
  const dataDir = path.join(__dirname,'..','..','data');
  await loadEntities(path.join(dataDir,'customers.csv'),'customer');
  await loadEntities(path.join(dataDir,'companies.csv'),'company');

  // Map entity label to id
  const ents = await client.query('SELECT id, name FROM entities');
  const map = new Map(ents.rows.map(r=> [r.name, r.id]));

  // Transactions
  const tContent = fs.readFileSync(path.join(dataDir,'transactions.csv'),'utf8');
  const txRows = await new Promise((resolve, reject)=> parse(tContent, { columns:true, skip_empty_lines:true }, (err,recs)=> err?reject(err):resolve(recs)));
  for (const t of txRows){
    const srcName = `${t.src_type}:${t.src_id}`; const dstName = `${t.dst_type}:${t.dst_id}`;
    const srcId = map.get(srcName) || null; const dstId = map.get(dstName) || null;
    const hits = String(t.rule_hits||'').split(';').filter(Boolean);
    await client.query(
      'INSERT INTO transactions(ts,src_entity_id,dst_entity_id,amount,currency,channel,src_country,dst_country,rule_hits,anomaly_score,label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [ new Date(t.timestamp), srcId, dstId, Number(t.amount), t.currency, t.channel, t.src_country, t.dst_country, hits, Number(t.anomaly_score||0), t.label||null ]
    );
  }

  // Alerts (synth JSON)
  try {
    const alerts = JSON.parse(fs.readFileSync(path.join(dataDir,'alerts.json'),'utf8'));
    for (const a of alerts){
      const entId = map.get(a.entity) || null;
      await client.query('INSERT INTO alerts(entity_id, tx_id, score, band, desc, details, created_at, status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [ entId, a.details?.tx_id || null, a.score, a.band||null, a.desc||null, a.details||{}, a.created_at? new Date(a.created_at) : new Date(), a.status||null ]);
    }
  } catch {}

  console.log('Seed completed');
  await client.end();
}

main().catch(e=>{ console.error(e); process.exit(1); });

