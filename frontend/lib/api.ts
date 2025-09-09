export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';

export async function getAlerts(params: { q?: string; minScore?: string; rule?: string|string[]; page?: string; pageSize?: string }){
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', String(params.q));
  if (params?.minScore) qs.set('minScore', String(params.minScore));
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const rule = params?.rule;
  if (Array.isArray(rule)) for (const r of rule) qs.append('rule', r);
  else if (rule) qs.append('rule', String(rule));
  const res = await fetch(`${API_BASE}/api/alerts?${qs.toString()}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

