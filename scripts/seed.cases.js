const { Client } = require('pg');

function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

async function main(){
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fraudshield';
  const c = new Client({ connectionString: url }); await c.connect();

  const users = (await c.query("SELECT id FROM users")).rows;
  const ents = (await c.query("SELECT id,name FROM entities")).rows;
  const alerts = (await c.query("SELECT id, score, band FROM alerts ORDER BY random() LIMIT 300")).rows;
  const N = randInt(60, 120);
  const statuses = ['Open','Investigating','Resolved','OnHold'];
  const prios = ['High','Medium','Low'];
  const bands = ['HIGH','MEDIUM','LOW'];

  for (let i=0;i<N;i++){
    const title = `Case #${Date.now()%100000}-${i}`;
    const priority = rnd(prios);
    const status = rnd(statuses);
    const risk_band = rnd(bands);
    const amount = randInt(200, 50000);
    const currency = 'EUR';
    const ent = rnd(ents)||{};
    const cnt = randInt(0,3);
    const alert_ids = Array.from({length: cnt}, ()=> rnd(alerts)?.id).filter(Boolean);
    const assignee = rnd(users)||{};
    const dueOffset = randInt(-48, 72); // hours
    const sla_due_at = new Date(Date.now() + dueOffset*3600*1000);
    await c.query(
      'INSERT INTO cases(title, priority, status, sla_due_at, assignee_id, risk_band, amount, currency, entity_id, alert_ids, evidence_count, attachment_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [ title, priority, status, sla_due_at, assignee.id||null, risk_band, amount, currency, ent.id||null, alert_ids, randInt(0,5), randInt(0,3) ]
    );
  }

  console.log(`Seeded ${N} cases`);
  await c.end();
}

main().catch(e=>{ console.error(e); process.exit(1); });

