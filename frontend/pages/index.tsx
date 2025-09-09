import { GetServerSideProps } from 'next';
import { getAlerts, API_BASE } from '../lib/api';
import PageHeader from '../components/PageHeader';
import FiltersBar from '../components/FiltersBar';
import AlertsTable from '../components/AlertsTable';
import { motion } from 'framer-motion';

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  try {
    const data = await getAlerts({
      q: typeof query.q==='string'? query.q: '',
      minScore: typeof query.minScore==='string'? query.minScore: '',
      rule: query.rule as any,
      page: typeof query.page==='string'? query.page: '1',
      pageSize: typeof query.pageSize==='string'? query.pageSize: '100',
    });
    return { props: { data, query: JSON.parse(JSON.stringify(query||{})), api: API_BASE } };
  } catch (e:any) {
    return { props: { data: { items: [], total:0, page:1, pageSize:100 }, query: JSON.parse(JSON.stringify(query||{})), api: API_BASE, error: e?.message||'Fetch failed' } };
  }
};

export default function Home({ data, query, error }:{ data:any; query:any; error?:string }){
  const items = Array.isArray(data?.items)? data.items : [];
  const counts = items.reduce((acc:any, it:any)=>{ const s=Number(it.score||0); if(s>=85) acc.h++; else if(s>=70) acc.m++; else acc.l++; return acc; }, {h:0,m:0,l:0});
  const segments = [ {label:'ÉLEVÉ', count: counts.h}, {label:'MOYEN', count: counts.m}, {label:'FAIBLE', count: counts.l} ];
  return (
    <motion.main initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.22, ease:[0.22,0.61,0.36,1]}} className="space-y-3">
      <PageHeader title="Tableau de bord" segments={segments} />
      {error && (<div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-lg px-4 py-2">Erreur API: {error}</div>)}
      <FiltersBar init={query} />
      <AlertsTable items={items} />
    </motion.main>
  );
}

