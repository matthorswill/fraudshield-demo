import { API_BASE } from '../lib/config';

export async function getServerSideProps() {
  try {
    const res = await fetch(`${API_BASE}/api/alerts?pageSize=500`);
    const data = await res.json();
    const map = new Map();
    for (const a of (data.items||[])) {
      const key = a.entity;
      const rec = map.get(key) || { entity: key, name: a.entity_name || a.entity, scoreMax: 0, alerts: 0 };
      rec.alerts++; rec.scoreMax = Math.max(rec.scoreMax, a.score || 0); map.set(key, rec);
    }
    return { props: { entities: Array.from(map.values()) } };
  } catch { return { props: { entities: [] } }; }
}

export default function Entities({ entities }) {
  return (
    <>
      <h1 className="page-title">Entités</h1>
      <div className="table-responsive fs-table-wrapper">
        <table className="table table-sm fs-table mb-0">
          <thead><tr><th>Entité</th><th>Nom</th><th>Alertes</th><th>Score max</th></tr></thead>
          <tbody>
            {entities.map(e => (<tr key={e.entity}><td>{e.entity}</td><td>{e.name}</td><td>{e.alerts}</td><td>{e.scoreMax}</td></tr>))}
          </tbody>
        </table>
      </div>
    </>
  );
}
