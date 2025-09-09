const { Client } = require('pg');

function pgClient(){
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const c = new Client({ connectionString: url });
  return c;
}

async function listCases(filters){
  const c = pgClient(); await c.connect();
  const where = []; const args = []; let i=1;
  if (filters.q) { where.push(`(title ILIKE $${i} OR $${i} = '')`); args.push(`%${filters.q}%`); i++; }
  if (filters.status && filters.status.length){ where.push(`status = ANY($${i}::text[])`); args.push(filters.status); i++; }
  if (filters.assignee_id) { where.push(`assignee_id = $${i}`); args.push(filters.assignee_id); i++; }
  if (filters.risk_band && filters.risk_band.length){ where.push(`risk_band = ANY($${i}::text[])`); args.push(filters.risk_band); i++; }
  if (filters.min_amount) { where.push(`amount >= $${i}`); args.push(filters.min_amount); i++; }
  if (filters.max_amount) { where.push(`amount <= $${i}`); args.push(filters.max_amount); i++; }
  if (filters.over_sla) { where.push(`sla_due_at IS NOT NULL AND sla_due_at < now()`); }
  const page = Math.max(1, parseInt(filters.page||'1',10));
  const pageSize = Math.min(100, Math.max(1, parseInt(filters.pageSize||'50',10)));
  const sortBy = ({ sla: 'sla_due_at', priority: 'priority', amount: 'amount' }[filters.sortBy||'sla']) || 'sla_due_at';
  const sortDir = (String(filters.sortDir||'asc').toLowerCase()==='desc')? 'DESC':'ASC';
  const whereSql = where.length? ('WHERE ' + where.join(' AND ')) : '';
  const total = (await c.query(`SELECT count(*) FROM cases ${whereSql}`, args)).rows[0].count;
  const sql = `SELECT * FROM cases ${whereSql} ORDER BY ${sortBy} ${sortDir} OFFSET ${(page-1)*pageSize} LIMIT ${pageSize}`;
  const rows = (await c.query(sql, args)).rows;
  await c.end();
  return { total: Number(total), page, pageSize, items: rows };
}

async function getCase(id){
  const c = pgClient(); await c.connect();
  const cs = (await c.query('SELECT * FROM cases WHERE id=$1', [id])).rows[0];
  let entity = null; let alerts = [];
  if (cs?.entity_id) entity = (await c.query('SELECT * FROM entities WHERE id=$1', [cs.entity_id])).rows[0];
  if (cs?.alert_ids?.length) alerts = (await c.query('SELECT * FROM alerts WHERE id = ANY($1::int[])', [cs.alert_ids])).rows;
  await c.end();
  return { case: cs, entity, alerts };
}

async function patchCase(id, patch){
  const c = pgClient(); await c.connect();
  const fields = []; const args = []; let i=1;
  for (const [k,v] of Object.entries(patch)) { fields.push(`${k}=$${i++}`); args.push(v); }
  args.push(id);
  const sql = `UPDATE cases SET ${fields.join(', ')}, updated_at=now() WHERE id=$${i} RETURNING *`;
  const row = (await c.query(sql, args)).rows[0];
  await c.end();
  return row;
}

async function metrics(filters){
  const c = pgClient(); await c.connect();
  const byStatus = (await c.query('SELECT status, count(*) FROM cases GROUP BY status')).rows;
  const byPriority = (await c.query('SELECT priority, count(*) FROM cases GROUP BY priority')).rows;
  const overSLA = (await c.query('SELECT count(*) FROM cases WHERE sla_due_at IS NOT NULL AND sla_due_at < now()')).rows[0].count;
  const riskSumByColumn = (await c.query("SELECT status, COALESCE(sum(amount),0) as amount FROM cases GROUP BY status")).rows;
  await c.end();
  return { total: Number(byStatus.reduce((s,r)=>s+Number(r.count||0),0)), byStatus, byPriority, overSLA: Number(overSLA), riskSumByColumn };
}

async function exportCsv(filters){
  const { items } = await listCases(filters);
  const lines = ['id,title,priority,status,sla_due_at,assignee_id,risk_band,amount,currency,entity_id,alerts_count,evidence_count,attachment_count,created_at,updated_at'];
  for (const c of items){ lines.push(`${c.id},"${(c.title||'').replace(/"/g,'\"')}",${c.priority},${c.status},${c.sla_due_at||''},${c.assignee_id||''},${c.risk_band||''},${c.amount||''},${c.currency||''},${c.entity_id||''},${(c.alert_ids||[]).length},${c.evidence_count||0},${c.attachment_count||0},${c.created_at||''},${c.updated_at||''}`); }
  return lines.join('\n');
}

module.exports = { listCases, getCase, patchCase, metrics, exportCsv };

