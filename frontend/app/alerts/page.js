import AlertsPage from '../../components/pages/AlertsPage';

export const dynamic = 'force-dynamic';

export default async function Page(){
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  let alerts = [];
  try {
    const res = await fetch(`${API_BASE}/v1/alerts?pageSize=200`, { cache: 'no-store' });
    if (res.ok) { const js = await res.json(); alerts = js.items || []; }
  } catch {}
  return <AlertsPage alerts={alerts} />;
}

