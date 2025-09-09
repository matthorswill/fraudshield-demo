import { API_BASE } from '../lib/config';
import { parse } from 'cookie';

export async function getServerSideProps({ req }) {
  try {
    const role = parse(req.headers.cookie || '').role || '';
    if (role !== 'admin' && role !== 'supervisor') {
      return { redirect: { destination: '/403', permanent: false } };
    }
    const r = await fetch(`${API_BASE}/api/rules`); const rules = await r.json(); return { props: { rules } };
  } catch { return { props: { rules: { version: 0, updatedAt: '', weights: {} } } }; }
}

export default function Rules({ rules }) {
  const entries = Object.entries(rules.weights || {});
  return (
    <>
      <h1 className="page-title">Règles</h1>
      <div className="mb-2 text-muted">Version {rules.version} — {rules.updatedAt}</div>
      <div className="table-responsive fs-table-wrapper">
        <table className="table table-sm fs-table mb-0"><thead><tr><th>Règle</th><th>Poids</th></tr></thead><tbody>
          {entries.map(([k,v]) => (<tr key={k}><td>{k}</td><td>{v}</td></tr>))}
        </tbody></table>
      </div>
      <div className="mt-3 text-muted small">Édition sécurisée (RBAC + API key) à activer en prod.</div>
    </>
  );
}
