"use client";
import Link from "next/link";
import { useState } from "react";

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
function riskHitColor(code){
  const high = new Set(['KBK_HIGH_AMOUNT_NON_URGENT','PBR_ATTACHED','HIGH_RISK_JURISDICTION','HIGH_VALUE_TRANSFER']);
  const med = new Set(['VIREMENT_IRREGULIER','UTILISATION_CONNECTE','CASH_STRUCTURING_NEAR_THRESHOLD']);
  if (high.has(code)) return 'red';
  if (med.has(code)) return 'gold';
  return 'green';
}

export default function TransactionsPage({ tx, queryInit={}, error }){
  const [label, setLabel] = useState(queryInit.label || "");
  const [minA, setMinA] = useState(queryInit.min_amount || "");
  const [maxA, setMaxA] = useState(queryInit.max_amount || "");
  const [rule, setRule] = useState(queryInit.rule || "");
  const [limit, setLimit] = useState(queryInit.limit || "200");

  const go = (id) => { try { window.location.href = `/alert/${id}`; } catch {} };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0">Transactions</h1>
        <Link href="/" className="btn btn-link">↩ Retour</Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          Erreur chargement API: {error}
        </div>
      )}

      <form method="get" className="row g-2 mb-3 filters-bar">
        <div className="col-md-2">
          <input name="label" value={label} onChange={e=>setLabel(e.target.value)} placeholder="label" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="min_amount" value={minA} onChange={e=>setMinA(e.target.value)} placeholder="min_amount" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="max_amount" value={maxA} onChange={e=>setMaxA(e.target.value)} placeholder="max_amount" className="form-control" />
        </div>
        <div className="col-md-3">
          <input name="rule" value={rule} onChange={e=>setRule(e.target.value)} placeholder="rule (ex: HIGH_VALUE_TRANSFER)" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="limit" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="limit" className="form-control" />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary">Filtrer</button>
        </div>
      </form>

      <div className="table-responsive bg-white rounded-3 shadow fs-table-wrapper">
        <table className="table table-sm align-middle mb-0 fs-table">
          <thead>
            <tr>
              <th>Alerte</th><th>Date</th><th>Montant</th><th>Devise</th><th>Canal</th>
              <th>Src</th><th>Dst</th><th>Anomalies</th><th>KYC périmé</th><th>Score</th><th>Label</th>
            </tr>
          </thead>
          <tbody>
            {tx.map(t => (
              <tr key={t.tx_id} role="link" tabIndex={0} onClick={()=>go(t.alert_id||t.tx_id)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(t.alert_id||t.tx_id);}}} style={{cursor:'pointer'}}>
                <td>{t.alert_id || ''}</td>
                <td>{t.timestamp}</td>
                <td>{t.amount}</td>
                <td>{t.currency}</td>
                <td>{t.channel}</td>
                <td>{t.src_type}:{t.src_id}</td>
                <td>{t.dst_type}:{t.dst_id}</td>
                <td>
                  {(Array.isArray(t.rule_hits)? t.rule_hits : String(t.rule_hits||'').split(';').filter(Boolean)).map((h,i)=>(
                    <span key={i} className={`chip ${riskHitColor(h)}`}>{ruleLabel(h)}</span>
                  ))}
                </td>
                <td>{(Array.isArray(t.rule_hits) ? t.rule_hits : String(t.rule_hits||'').split(';')).includes('KYC_OBSOLE') ? 'Oui' : 'Non'}</td>
                <td>{t.anomaly_score}</td>
                <td>{t.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

