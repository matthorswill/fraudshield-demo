"use client";
import Link from 'next/link';
import AlertChip from '../../components/AlertChip';
import KYCStatusPill from '../../components/KYCStatusPill';
import RiskScoreBar from '../../components/RiskScoreBar';
import { API_BASE } from '../../lib/config';
import { useRouter } from 'next/navigation';

export default function AlertsPage({ alerts }){
  const router = useRouter();
  const openPdf = (id) => { try { window.open(`${API_BASE}/v1/reports/${id}.pdf`, '_blank'); } catch {} };
  return (
    <>
      <h1 className="page-title">Alertes</h1>
      <div className="table-responsive bg-white rounded-3 shadow fs-table-wrapper">
        <table className="table table-sm align-middle mb-0 fs-table">
          <thead>
            <tr>
              <th>ID</th><th>Entité</th><th>Score</th><th>Risque</th><th>Anomalies</th><th>KYC</th><th>Date</th><th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {(alerts||[]).map(a => {
              const hits = a.details?.hits || [];
              const kyc = hits.includes('KYC_OBSOLE');
              const level = a.score >= 85 ? 'high' : a.score >= 70 ? 'medium' : 'low';
              const go = () => router.push(`/alert/${a.id}`);
              const onKey = (e) => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); go(); } };
              return (
                <tr key={a.id} role="link" tabIndex={0} onClick={go} onKeyDown={onKey} style={{cursor:'pointer'}}>
                  <td><Link href={`/alert/${a.id}`}>{a.id}</Link></td>
                  <td>{a.entity_name || a.entity}</td>
                  <td style={{minWidth:120}}><RiskScoreBar score={a.score} /></td>
                  <td><AlertChip level={level}>{level.toUpperCase()}</AlertChip></td>
                  <td>{hits.join(', ')}</td>
                  <td><KYCStatusPill expired={kyc} /></td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                  <td><button className="btn btn-sm btn-outline-secondary" onClick={(e)=>{e.stopPropagation(); openPdf(a.id);}}>PDF</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

