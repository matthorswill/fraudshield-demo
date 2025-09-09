import Link from "next/link";
import { API_BASE } from "../../lib/config";
import { useEffect, useRef, useState } from "react";

export async function getServerSideProps({ params }) {
  const url = `${API_BASE}/api/alerts/${params.id}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { props: { alert: null, error: `API error: ${res.status}` } };
    const alert = await res.json();
    return { props: { alert, error: null } };
  } catch (e) {
    return { props: { alert: null, error: e?.message || 'Fetch failed' } };
  }
}

export default function AlertDetail({ alert, error }) {
  const canvasRef = useRef(null);
  const [investigation, setInvestigation] = useState('');
  const [actionsLLM, setActions] = useState([]);
  const [compliance, setCompliance] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    let chart;
    (async () => {
      try {
        const { default: Chart } = await import('chart.js/auto');
        const weights = getWeights();
        const hits = (alert?.details?.hits || []);
        const data = hits.map(h => weights[h] ?? 5);
        const bg = data.map(v => v >= 25 ? 'rgba(220,53,69,0.6)' : v >= 15 ? 'rgba(255,193,7,0.6)' : 'rgba(25,135,84,0.6)');
        const border = data.map(v => v >= 25 ? 'rgba(220,53,69,1)' : v >= 15 ? 'rgba(255,193,7,1)' : 'rgba(25,135,84,1)');
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        chart = new Chart(ctx, {
          type: 'bar',
          data: { labels: hits, datasets: [{ label: 'Poids par règle', data, backgroundColor: bg, borderColor: border, borderWidth: 1 }] },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 35 } } }
        });
      } catch {}
    })();
    return () => { try { chart?.destroy(); } catch {} };
  }, [alert]);

  async function loadInvestigation() {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alert?.id}/investigate`);
      const js = await res.json();
      setInvestigation(js?.reportText || '');
      setActions(Array.isArray(js?.actions) ? js.actions : []);
    } catch {}
  }

  async function loadCompliance() {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/advice?alertId=${alert?.id}`);
      const js = await res.json();
      setCompliance(js?.advice || '');
    } catch {}
  }

  function generatePDF(){
    try { if (alert?.id) window.open(`${API_BASE}/v1/reports/${alert.id}.pdf`, '_blank'); } catch {}
  }
  async function shareLink(){
    try {
      const r = await fetch(`${API_BASE}/v1/reports/share`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ alertId: alert?.id, expireSeconds: 24*3600 }) });
      const js = await r.json();
      if (js?.url) { setShareUrl(js.url); try{ await navigator.clipboard.writeText(js.url); }catch{} }
      else { setShareUrl(js?.error || 'Erreur'); }
    } catch (e) { setShareUrl(e?.message || 'Erreur'); }
  }

  if (error) {
    return (
      <>
        <div className="alert alert-danger mt-3" role="alert">
          Erreur API: {error}. Vérifie que l'API tourne sur {API_BASE}.
        </div>
        <Link href="/" className="btn btn-link mt-2">← Retour</Link>
      </>
    );
  }

  if (!alert) {
    return (
      <>
        <div className="alert alert-warning mt-3" role="alert">Alerte introuvable.</div>
        <Link href="/" className="btn btn-link mt-2">← Retour</Link>
      </>
    );
  }

  return (
    <>
      <div className="row">
        <div className="col-12 col-lg-8">
          <h1 className="h3">{alert?.type} — {alert?.entity_name || alert?.entity}</h1>
          <div className="d-flex align-items-center justify-content-end mb-2" style={{gap:8}}>
            <button className="btn btn-sm btn-outline-secondary" onClick={generatePDF}>Générer rapport Tracfin (PDF)</button>
            <button className="btn btn-sm btn-outline-secondary" onClick={shareLink}>Partager (lien 24h)</button>
          </div>
          {!!shareUrl && (<div className="small text-muted mb-2">Lien: <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a></div>)}
          <p className="text-muted" style={{whiteSpace:'pre-wrap'}}>{alert?.desc}</p>
          {!!alert?.details?.previously_flagged_count && (
            <span className="badge bg-warning text-dark me-2">Déjà signalé {alert?.details?.previously_flagged_count} fois</span>
          )}
          {alert?.suggested_action && (
            <div className="alert alert-info" role="alert">
              <strong>Action suggérée :</strong> {alert?.suggested_action}
            </div>
          )}
          {Array.isArray(alert?.suggested_actions) && alert?.suggested_actions.length > 0 && (
            <div className="card mt-2">
              <div className="card-header">Autres actions suggérées</div>
              <ul className="list-group list-group-flush">
                {alert?.suggested_actions.map((a,i)=>(<li key={i} className="list-group-item">{a}</li>))}
              </ul>
            </div>
          )}

          <div className="card mt-2">
            <div className="card-header">Contacts utiles</div>
            <div className="card-body">
              <ul className="mb-0">
                <li><a href="https://www.economie.gouv.fr/tracfin" target="_blank" rel="noreferrer">TRACFIN (déclarations – goAML)</a></li>
                <li><a href="https://acpr.banque-france.fr/" target="_blank" rel="noreferrer">ACPR – Banque de France</a></li>
                <li><a href="https://www.amf-france.org/" target="_blank" rel="noreferrer">AMF – Autorité des marchés financiers</a></li>
              </ul>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">Détails</div>
            <div className="card-body">
              <ul className="mb-0">
                <li>Score : {alert?.score}</li>
                <li>Canal : <span className="badge bg-secondary">{alert?.details?.channel}</span></li>
                <li>Pays : <span className="badge bg-light text-dark">{alert?.details?.src_country}</span> → <span className="badge bg-light text-dark">{alert?.details?.dst_country}</span></li>
                <li className="mb-1">Anomalies :</li>
                <div className="mb-2">
                  {(alert?.details?.hits || []).map((h,i)=>{
                    const label = ruleLabel(h);
                    const color = ruleColor(h);
                    return <span key={i} className={`chip ${color}`}>{label}</span>;
                  })}
                </div>
                <li>Tx ID : {alert?.details?.tx_id}</li>
              </ul>
            </div>
          </div>

          <div className="card mt-2">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Rapport d'enquête (LLM)</span>
              <div>
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={loadInvestigation}>Générer</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={()=>{try{const u=new SpeechSynthesisUtterance(investigation);u.lang='fr-FR';speechSynthesis.speak(u);}catch{}}}>Lire</button>
              </div>
            </div>
            <div className="card-body" style={{whiteSpace:'pre-wrap'}}>
              {investigation || '—'}
              {!!actionsLLM?.length && (
                <div className="mt-2"><strong>Actions proposées:</strong><ul>{actionsLLM.map((x,i)=>(<li key={i}>{x}</li>))}</ul></div>
              )}
            </div>
          </div>

          <div className="card mt-2">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Conseil conformité</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={loadCompliance}>Générer</button>
            </div>
            <div className="card-body" style={{whiteSpace:'pre-wrap'}}>{compliance || '—'}</div>
          </div>

          <div className="alert alert-secondary mt-3" role="alert">
            Conformité CNIL / RGPD : ce scoring est basé sur des données contractuelles minimales, conservées 5 ans, et explicable aux équipes compliance.
          </div>

          <div className="mt-3">
            <Link href="/" className="btn btn-link">← Retour dashboard</Link>
          </div>
        </div>
        <div className="col-12 col-lg-4 mt-3 mt-lg-0">
          <div className="card">
            <div className="card-header">Visualisation</div>
            <div className="card-body">
              <canvas ref={canvasRef} height="200" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getWeights() {
  return {
    KBK_HIGH_AMOUNT_NON_URGENT: 30,
    FONDS_SEIN_PAYS_TIER: 20,
    VIREMENT_IRREGULIER: 25,
    UTILISATION_CONNECTE: 20,
    KYC_OBSOLE: 15,
    PBR_ATTACHED: 30,
    HIGH_VALUE_TRANSFER: 15,
    CASH_STRUCTURING_NEAR_THRESHOLD: 20,
    CROSS_BORDER: 10,
    HIGH_RISK_JURISDICTION: 15,
    ODD_HOUR_ACTIVITY: 10,
    ROUND_NUMBER_PATTERN: 8,
    HIGH_RISK_ENTITY: 12,
  };
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

function ruleColor(code){
  const high = new Set(['KBK_HIGH_AMOUNT_NON_URGENT','PBR_ATTACHED','HIGH_RISK_JURISDICTION','HIGH_VALUE_TRANSFER']);
  const med = new Set(['VIREMENT_IRREGULIER','UTILISATION_CONNECTE','CASH_STRUCTURING_NEAR_THRESHOLD']);
  if (high.has(code)) return 'red';
  if (med.has(code)) return 'gold';
  return 'green';
}
