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

