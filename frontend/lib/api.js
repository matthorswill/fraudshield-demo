export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function apiSend(path, { method='POST', json, headers }={}){
  const h = { 'Content-Type': 'application/json', ...(headers||{}) };
  const res = await fetch(`${API_BASE}${path}`, { method, headers: h, body: json ? JSON.stringify(json) : undefined });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// Convenience helper used by SSR dashboard
export async function getAlerts(params = {}){
  const qs = new URLSearchParams();
  const { q, minScore, rule, page, pageSize } = params || {};
  if (q) qs.set('q', String(q));
  if (minScore) qs.set('minScore', String(minScore));
  if (page) qs.set('page', String(page));
  if (pageSize) qs.set('pageSize', String(pageSize));
  if (Array.isArray(rule)) for (const r of rule) qs.append('rule', r);
  else if (rule) qs.append('rule', String(rule));
  const res = await fetch(`${API_BASE}/api/alerts?${qs.toString()}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
