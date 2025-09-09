import Link from "next/link";
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
  const url = `${API_BASE}/api/alerts?` + qs.toString();
  try {
    const res = await fetch(url);
    if (!res.ok) return { props: { data: { total: 0, page: 1, pageSize: 100, lastBuiltAt: null, items: [] }, queryInit: query, error: `API error: ${res.status}` } };
    const data = await res.json();
    return { props: { data, queryInit: query, error: null } };
  } catch (e) {
    return { props: { data: { total: 0, page: 1, pageSize: 100, lastBuiltAt: null, items: [] }, queryInit: query, error: e?.message || 'Fetch failed' } };
  }
}

function RiskBadge({ score }) {
  const band = score >= 85 ? "ÉLEVÉ" : score >= 70 ? "MOYEN" : "FAIBLE";
  const cls = score >= 85 ? 'risk-badge-pill risk-high' : score >= 70 ? 'risk-badge-pill risk-medium' : 'risk-badge-pill risk-low';
  return <span className={cls}>{band}</span>;
}

function riskHitColor(code){
  const high = new Set(['KBK_HIGH_AMOUNT_NON_URGENT','PBR_ATTACHED','HIGH_RISK_JURISDICTION','HIGH_VALUE_TRANSFER']);
  const med = new Set(['VIREMENT_IRREGULIER','UTILISATION_CONNECTE','CASH_STRUCTURING_NEAR_THRESHOLD']);
  if (high.has(code)) return 'red';
  if (med.has(code)) return 'gold';
  return 'green';
}
function ruleLabel(code){
  const map = {
    KBK_HIGH_AMOUNT_NON_URGENT: 'Montant élevé non urgent',
    FONDS_SEIN_PAYS_TIER: 'Fonds vers pays tiers',
    VIREMENT_IRREGULIER: 'Virements irréguliers',
    UTILISATION_CONNECTE: 'Connexion incohérente (IP ≠ pays)',
    KYC_OBSOLE: 'KYC périmé',
    PBR_ATTACHED: 'Crypto non enregistré',
    HIGH_VALUE_TRANSFER: 'Virement haute valeur',
    CASH_STRUCTURING_NEAR_THRESHOLD: 'Structuration proche seuil',
    CROSS_BORDER: 'Transfrontalier',
    HIGH_RISK_JURISDICTION: 'Juridiction à risque',
    ODD_HOUR_ACTIVITY: 'Heures inhabituelles',
    ROUND_NUMBER_PATTERN: 'Montants ronds',
    HIGH_RISK_ENTITY: 'Entité à risque',
  };
  return map[code] || code;
}

function RiskSummary({ items }) {
  const { high, medium, low } = useMemo(() => {
    let h=0,m=0,l=0;
    for (const it of (items || [])) {
      const s = Number(it.score || 0);
      if (s >= 85) h++; else if (s >= 70) m++; else l++;
    }
    return { high:h, medium:m, low:l };
  }, [items]);

  return (
    <div className="risk-cards">
      <div className="risk-card">
        <span className="risk-badge-pill risk-high">ÉLEVÉ</span>
        <span className="label">ÉLEVÉ ({high})</span>
      </div>
      <div className="risk-card">
        <span className="risk-badge-pill risk-medium">MOYEN</span>
        <span className="label">MOYEN ({medium})</span>
      </div>
      <div className="risk-card">
        <span className="risk-badge-pill risk-low">FAIBLE</span>
        <span className="label">FAIBLE ({low})</span>
      </div>
    </div>
  );
}

export default function Home({ data, queryInit, error }) {
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
    <>
      <h1 className="page-title">Tableau de bord</h1>

      {/* Résumé risques */}
      <RiskSummary items={data.items || []} />

      {error && (
        <div className="alert alert-danger" role="alert">
          Erreur API: {error}. Vérifie que l'API tourne sur {API_BASE}.
        </div>
      )}

      {/* Barre de filtres */}
      <div className="filters-bar">
        <form method="get" className="row g-2 align-items-center">
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <div className="col-lg-4">
            <div className="input-group">
              <span className="input-group-text" style={{borderRadius:10}}>🔎</span>
              <input name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher" className="form-control" />
            </div>
          </div>
          <div className="col-auto form-check ms-1">
            <input className="form-check-input" type="checkbox" id="rKyc" name="rule" value="KYC_OBSOLE" defaultChecked={kycChecked} />
            <label className="form-check-label" htmlFor="rKyc">KYC périmé</label>
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
            <select name="minScore" value={minScore} onChange={(e)=>setMinScore(e.target.value)} className="form-select">
              <option value="">Score min</option>
              <option value="50">50</option>
              <option value="70">70</option>
              <option value="85">85</option>
            </select>
          </div>
          <div className="col-auto">
            <button type="submit" className="btn btn-gold">Filtrer</button>
          </div>
        </form>
      </div>

      <div className="table-responsive bg-white rounded-3 shadow fs-table-wrapper">
        <table className="table table-sm align-middle mb-0 fs-table">
          <thead>
            <tr>
              <th>ID</th><th>Risque</th><th>Entité</th><th>Description</th><th>Date</th><th>KYC périmé</th>
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map(a=> {
              const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
              const kyc = hits.includes('KYC_OBSOLE');
              const short = (a.desc || '').slice(0, 180);
              const go = () => { try{ window.location.href = `/alert/${a.id}`; }catch{} };
              const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
              return (
                <tr key={a.id} role="link" tabIndex={0} onClick={go} onKeyDown={onKey} style={{cursor:'pointer'}}>
                  <td><Link href={`/alert/${a.id}`}>{a.id}</Link></td>
                  <td><RiskBadge score={a.score} /></td>
                  <td>{a.entity_name || a.entity}</td>
                  <td className="desc">
                    <div><strong>Anomalies:</strong> {hits.map((h,i)=> (<span key={i} className={`chip ${riskHitColor(h)}`}>{ruleLabel(h)}</span>))}</div>
                    <div className="text-muted small mt-1"><Link href={`/alert/${a.id}`}>{short}{a.desc && a.desc.length>short.length?'…':''}</Link></div>
                  </td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</td>
                  <td>{kyc ? 'Oui' : 'Non'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="muted-on-dark small mt-2">
        {data.total} alertes • page {currentPage} / {totalPages}
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
    </>
  );
}
