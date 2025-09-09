import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/config';

export default function KPI() {
  const [kpi, setKpi] = useState(null);
  const [top, setTop] = useState([]);
  useEffect(() => { (async()=>{ try{ const r=await fetch(`${API_BASE}/api/kpi`); setKpi(await r.json()); }catch{} })(); (async()=>{ try{ const r=await fetch(`${API_BASE}/api/reports/top-losses?days=7`); setTop(await r.json()); }catch{} })(); }, []);
  return (
    <>
      <h1 className="page-title">KPI Anti-Fraude</h1>
      {!kpi && <div className="alert alert-info">Chargement…</div>}
      {kpi && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-4">
              <div className="card shadow-sm"><div className="card-body"><div className="h6 text-muted">Fraude évitée (est.)</div><div className="h3">€ {kpi.avoided_fraud_eur.toLocaleString()}</div></div></div>
            </div>
            <div className="col-6 col-lg-4">
              <div className="card shadow-sm"><div className="card-body"><div className="h6 text-muted">Faux positifs (est.)</div><div className="h3">{Math.round(kpi.false_positive_rate*100)}%</div></div></div>
            </div>
            <div className="col-6 col-lg-4">
              <div className="card shadow-sm"><div className="card-body"><div className="h6 text-muted">ROI compliance</div><div className="h3">{kpi.roi.toFixed(2)}x</div></div></div>
            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header">Top pertes (7 jours)</div>
            <div className="table-responsive">
              <table className="table table-sm mb-0"><thead className="table-light"><tr><th>ID alerte</th><th>Entité</th><th>Montant</th><th>Score</th><th>Date</th></tr></thead><tbody>
                {top.map(t => (<tr key={t.id}><td>{t.id}</td><td>{t.entity}</td><td>{t.amount.toLocaleString()}</td><td>{t.score}</td><td>{t.date ? new Date(t.date).toLocaleString() : ''}</td></tr>))}
              </tbody></table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
