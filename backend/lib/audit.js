// backend/lib/audit.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT_LOG = path.join(__dirname,'..','..','data','audit.log');
const AUDIT_CHAIN = path.join(__dirname,'..','..','data','audit.chain');

function audit(event, payload){
  try {
    const entry = { ts:new Date().toISOString(), event, ...payload };
    const line = JSON.stringify(entry);
    fs.appendFileSync(AUDIT_LOG, line + "\n");
    let prev = '';
    try { const parts = fs.readFileSync(AUDIT_CHAIN,'utf8').trim().split('\n'); prev = parts[parts.length-1]?.split(' ')[0] || ''; } catch {}
    const hash = crypto.createHash('sha256').update(prev + line).digest('hex');
    fs.appendFileSync(AUDIT_CHAIN, `${hash} ${entry.ts} ${event}\n`);
  } catch {}
}

module.exports = { audit };

