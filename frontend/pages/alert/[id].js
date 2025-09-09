import Link from "next/link";
import Layout from "../../components/Layout";
import { API_BASE } from "../../lib/config";
import { useEffect, useRef } from "react";

export async function getServerSideProps({ params }) {
  const res = await fetch(`${API_BASE}/api/alerts/${params.id}`);
  if (!res.ok) return { notFound: true };
  const alert = await res.json();
  return { props: { alert } };
}

export default function AlertDetail({ alert }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let chart;
    (async () => {
      try {
        const { default: Chart } = await import('chart.js/auto');
        const weights = getWeights();
        const hits = (alert.details?.hits || []);
        const data = hits.map(h => weights[h] ?? 5);
        const bg = data.map(v => v >= 25 ? 'rgba(220,53,69,0.6)' : v >= 15 ? 'rgba(255,193,7,0.6)' : 'rgba(25,135,84,0.6)');
        const border = data.map(v => v >= 25 ? 'rgba(220,53,69,1)' : v >= 15 ? 'rgba(255,193,7,1)' : 'rgba(25,135,84,1)');
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: hits,
            datasets: [{ label: 'Poids par règle', data, backgroundColor: bg, borderColor: border, borderWidth: 1 }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 35 } }
          }
        });
      } catch {}
    })();
    return () => { try { chart?.destroy(); } catch {} };
  }, [alert]);

  return (
    <Layout>
      <div className="row">
        <div className="col-12 col-lg-8">
          <h1 className="h3">{alert.type} — {alert.entity_name || alert.entity}</h1>
          <p className="text-muted">{alert.desc}</p>
          {!!alert.details?.previously_flagged_count && (
            <span className="badge bg-warning text-dark me-2">Déjà signalé {alert.details.previously_flagged_count} fois</span>
          )}
          {alert.suggested_action && (
            <div className="alert alert-info" role="alert">
              <strong>Action suggérée :</strong> {alert.suggested_action}
            </div>
          )}
          {Array.isArray(alert.suggested_actions) && alert.suggested_actions.length > 0 && (
            <div className="card mt-2">
              <div className="card-header">Autres actions suggérées</div>
              <ul className="list-group list-group-flush">
                {alert.suggested_actions.map((a,i)=>(<li key={i} className="list-group-item">{a}</li>))}
              </ul>
            </div>
          )}

          <div className="card mt-3">
            <div className="card-header">Détails</div>
            <div className="card-body">
              <ul className="mb-0">
                <li>Score : {alert.score}</li>
                <li>Canal : <span className="badge bg-secondary">{alert.details?.channel}</span></li>
                <li>Pays : <span className="badge bg-light text-dark">{alert.details?.src_country}</span> → <span className="badge bg-light text-dark">{alert.details?.dst_country}</span></li>
                <li>Règles :</li>
                <ul className="mt-2">
                  {(alert.details?.hits || []).map((h,i)=>{
                    const w = getWeights()[h] ?? 5;
                    const cls = w >= 25 ? 'bg-danger' : w >= 15 ? 'bg-warning text-dark' : 'bg-success';
                    return <li key={i}><span className={`badge ${cls} me-2`}>{h}</span> poids {w}</li>;
                  })}
                </ul>
                <li>Tx ID : {alert.details?.tx_id}</li>
              </ul>
            </div>
          </div>

      <div className="alert alert-secondary mt-3" role="alert">
        Conformité CNIL / RGPD : ce scoring est basé sur des données contractuelles minimales, 
        conservées 5 ans, et explicable aux équipes compliance.
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
    </Layout>
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
