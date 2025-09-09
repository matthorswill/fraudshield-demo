import TransactionsPage from '../../components/pages/TransactionsPage';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }){
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  const sp = new URLSearchParams();
  if (searchParams?.label) sp.set('q', String(searchParams.label));
  if (searchParams?.rule) sp.set('rule', String(searchParams.rule));
  if (searchParams?.min_amount) sp.set('min_amount', String(searchParams.min_amount));
  if (searchParams?.max_amount) sp.set('max_amount', String(searchParams.max_amount));
  sp.set('limit', String(searchParams?.limit || '200'));
  let tx = [], error = null;
  try {
    const res = await fetch(`${API_BASE}/v1/transactions?${sp.toString()}`, { cache: 'no-store' });
    if (res.ok) tx = await res.json(); else error = `API ${res.status}`;
  } catch (e) { error = e?.message || 'Fetch failed'; }
  return <TransactionsPage tx={tx} queryInit={searchParams||{}} error={error} />;
}

