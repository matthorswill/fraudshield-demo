import Link from "next/link";
import Layout from "../components/Layout";
import { API_BASE } from "../lib/config";
import { useMemo, useState } from "react";

export async function getServerSideProps({ query }) {
  const qs = new URLSearchParams({
    q: query.q || "",
    minScore: query.minScore || "",
    page: query.page || "1",
    pageSize: query.pageSize || "100",
  });
  const res = await fetch(`${API_BASE}/api/alerts?` + qs.toString());
  const data = await res.json();
  return { props: { data, queryInit: query } };
}

function RiskBadge({ score }) {
  const band = score >= 85 ? "HIGH" : score >= 70 ? "MEDIUM" : "LOW";
  const cls = band === 'HIGH' ? 'bg-danger' : band === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-success';
  return <span className={`badge ${cls}`}>{band} {score}</span>;
}

export default function Home({ data, queryInit }) {
  const [q, setQ] = useState(queryInit.q || "");
  const [minScore, setMinScore] = useState(queryInit.minScore || "");
  const [fKyc, setFKyc] = useState(false);
  const [fVir, setFVir] = useState(false);
  const [fPays, setFPays] = useState(false);

  const items = useMemo(() => {
    let arr = data.items || [];
    const has = (a, code) => Array.isArray(a.details?.hits) && a.details.hits.includes(code);
    if (fKyc) arr = arr.filter(a => has(a, 'KYC_OBSOLE'));
    if (fVir) arr = arr.filter(a => has(a, 'VIREMENT_IRREGULIER'));
    if (fPays) arr = arr.filter(a => has(a, 'FONDS_SEIN_PAYS_TIER'));
    return arr;
  }, [data, fKyc, fVir, fPays]);

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0">FraudShield AI — Dashboard</h1>
        <div>
          <Link href="/transactions" className="btn btn-outline-primary btn-sm">Transactions</Link>
        </div>
      </div>

      <form method="get" className="row g-2 mb-3">
        <div className="col-md">
          <input name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher (entity, type, texte)" className="form-control" />
        </div>
        <div className="col-auto">
          <input name="minScore" value={minScore} onChange={e=>setMinScore(e.target.value)} placeholder="Score min" className="form-control" />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary">Filtrer</button>
        </div>
      </form>

      <div className="d-flex gap-3 mb-2">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fKyc" checked={fKyc} onChange={e=>setFKyc(e.target.checked)} />
          <label className="form-check-label" htmlFor="fKyc">KYC outdated</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fVir" checked={fVir} onChange={e=>setFVir(e.target.checked)} />
          <label className="form-check-label" htmlFor="fVir">Virements irréguliers</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fPays" checked={fPays} onChange={e=>setFPays(e.target.checked)} />
          <label className="form-check-label" htmlFor="fPays">Pays tiers</label>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>ID</th><th>Risk</th><th>Entity</th><th>Description</th><th>Date</th><th>KYC outdated</th>
            </tr>
          </thead>
          <tbody>
            {items.map(a=> (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td><RiskBadge score={a.score} /></td>
                <td>{a.entity}</td>
                <td><Link href={`/alert/${a.id}`}>{a.desc}</Link></td>
                <td>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                <td>{Array.isArray(a.details?.hits) && a.details.hits.includes('KYC_OBSOLE') ? 'Oui' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted small mt-2">
        {data.total} alertes • Rebuild: {data.lastBuiltAt}
      </div>
    </Layout>
  );
}
