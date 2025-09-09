import ClientHome from '../ClientHome.jsx';

export const dynamic = 'force-dynamic';

export default async function Page(){
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  let data = { total: 0, page: 1, pageSize: 100, lastBuiltAt: null, items: [] };
  let error = null;
  try {
    const res = await fetch(`${API_BASE}/v1/alerts?page=1&pageSize=100`, { cache: 'no-store' });
    if (res.ok) data = await res.json(); else error = `API ${res.status}`;
  } catch (e) { error = e?.message || 'Fetch failed'; }
  return <ClientHome data={data} queryInit={{}} error={error} />;
}

