"use client";
import Link from 'next/link';
import { useMemo } from 'react';

function RiskBadge({ score }){
  const band = score >= 85 ? 'ÉLEVÉ' : score >= 70 ? 'MOYEN' : 'FAIBLE';
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

export default function ClientHome({ data, queryInit, error }){
  const items = Array.isArray(data?.items) ? data.items : [];
  const summary = useMemo(() => {
    let h=0,m=0,l=0; for (const it of items){ const s=Number(it.score||0); if (s>=85) h++; else if (s>=70) m++; else l++; } return {h,m,l};
  }, [items]);

  return (
    <>
      <h1 className="page-title">Tableau de bord</h1>

      <div className="risk-cards">
        <div className="risk-card"><span className="risk-badge-pill risk-high">ÉLEVÉ</span><span className="label">ÉLEVÉ ({summary.h})</span></div>
        <div className="risk-card"><span className="risk-badge-pill risk-medium">MOYEN</span><span className="label">MOYEN ({summary.m})</span></div>
        <div className="risk-card"><span className="risk-badge-pill risk-low">FAIBLE</span><span className="label">FAIBLE ({summary.l})</span></div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">Erreur API: {error}</div>
      )}

      <div className="table-responsive bg-white rounded-3 shadow fs-table-wrapper">
        <table className="table table-sm align-middle mb-0 fs-table">
          <thead>
            <tr>
              <th>ID</th><th>Risque</th><th>Entité</th><th>Description</th><th>Date</th><th>KYC périmé</th>
            </tr>
          </thead>
          <tbody>
            {items.map(a => {
              const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
              const kyc = hits.includes('KYC_OBSOLE');
              const short = (a.desc || '').slice(0, 180);
              const go = (e) => { if(e) e.preventDefault(); try{ window.location.href=`/alert/${a.id}` }catch{} };
              return (
                <tr key={a.id} role="link" tabIndex={0} onClick={go} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } }} style={{cursor:'pointer'}}>
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
    </>
  );
}

