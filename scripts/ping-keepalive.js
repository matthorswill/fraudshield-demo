const https = require('https');
const http = require('http');

const url = process.env.KEEPALIVE_URL || process.env.NEXT_PUBLIC_API_BASE || '';
if (!url) {
  console.error('KEEPALIVE_URL or NEXT_PUBLIC_API_BASE is not set.');
  process.exit(1);
}

const parsed = new URL(url);
const client = parsed.protocol === 'https:' ? https : http;

function pingOnce() {
  const target = new URL(parsed.origin + '/');
  const start = Date.now();
  const req = client.get(target, (res) => {
    const ms = Date.now() - start;
    console.log(`[keepalive] ${target.href} -> ${res.statusCode} in ${ms}ms`);
    res.resume();
  });
  req.on('error', (err) => console.error('[keepalive] error:', err.message));
}

// ping immediately, then every 14 minutes (Render free tier idle ~15m)
pingOnce();
setInterval(pingOnce, 14 * 60 * 1000);

