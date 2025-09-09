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
  const rules = Array.isArray(query.rule)
    ? query.rule.flatMap(r => String(r).split(',')).map(s=>s.trim()).filter(Boolean)
    : (query.rule ? String(query.rule).split(',').map(s=>s.trim()).filter(Boolean) : []);
  for (const r of rules) qs.append('rule', r);
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
  const initRules = Array.isArray(queryInit.rule)
    ? queryInit.rule.flatMap(r => String(r).split(',')).map(s=>s.trim())
    : (queryInit.rule ? String(queryInit.rule).split(',').map(s=>s.trim()) : []);
  const kycChecked = initRules.includes('KYC_OBSOLE');
  const virChecked = initRules.includes('VIREMENT_IRREGULIER');
  const paysChecked = initRules.includes('FONDS_SEIN_PAYS_TIER');

  const currentPage = Number(queryInit.page || '1');
  const pageSize = Number(queryInit.pageSize || '100');
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (pageSize || 1)));

  const baseQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (minScore) qs.set('minScore', String(minScore));
    qs.set('pageSize', String(pageSize));
    for (const r of initRules) if (r) qs.append('rule', r);
    return qs;
  }, [q, minScore, pageSize, initRules]);

  const pageHref = (p) => {
    const qs = new URLSearchParams(baseQuery);
    qs.set('page', String(p));
    return `/?${qs.toString()}`;
  };

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
          <select name="pageSize" defaultValue={String(pageSize)} className="form-select">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div className="col-12"></div>
        <div className="col-auto form-check ms-2">
          <input className="form-check-input" type="checkbox" id="rKyc" name="rule" value="KYC_OBSOLE" defaultChecked={kycChecked} />
          <label className="form-check-label" htmlFor="rKyc">KYC outdated</label>
        </div>
        <div className="col-auto form-check">
          <input className="form-check-input" type="checkbox" id="rVir" name="rule" value="VIREMENT_IRREGULIER" defaultChecked={virChecked} />
          <label className="form-check-label" htmlFor="rVir">Virements irréguliers</label>
        </div>
        <div className="col-auto form-check">
          <input className="form-check-input" type="checkbox" id="rPays" name="rule" value="FONDS_SEIN_PAYS_TIER" defaultChecked={paysChecked} />
          <label className="form-check-label" htmlFor="rPays">Pays tiers</label>
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary">Filtrer</button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>ID</th><th>Risk</th><th>Entity</th><th>Description</th><th>Date</th><th>KYC outdated</th>
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map(a=> (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td><RiskBadge score={a.score} /></td>
                <td>{a.entity_name || a.entity}</td>
                <td><Link href={`/alert/${a.id}`}>{a.desc}</Link></td>
                <td>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                <td>{Array.isArray(a.details?.hits) && a.details.hits.includes('KYC_OBSOLE') ? 'Oui' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted small mt-2">
        {data.total} alertes â€¢ page {currentPage} / {totalPages} â€¢ Rebuild: {data.lastBuiltAt}
      </div>

      <nav className="mt-2">
        <ul className="pagination pagination-sm">
          <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
            <Link className="page-link" href={currentPage <= 1 ? '#' : pageHref(currentPage - 1)}>Précédent</Link>
          </li>
          <li className="page-item disabled"><span className="page-link">{currentPage}</span></li>
          <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
            <Link className="page-link" href={currentPage >= totalPages ? '#' : pageHref(currentPage + 1)}>Suivant</Link>
          </li>
        </ul>
      </nav>
    </Layout>
  );
}

