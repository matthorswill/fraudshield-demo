"use client";
import Link from 'next/link';
import { RiskBadge, KYCBadge } from './Badge';

function riskLevel(score:number): 'HIGH'|'MEDIUM'|'LOW'{
  if (score>=85) return 'HIGH'; if (score>=70) return 'MEDIUM'; return 'LOW';
}

export default function AlertsTable({ items }:{ items: any[] }){
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 overflow-hidden mt-3">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0">
            <tr className="bg-[#0B1E3A] text-white/90 text-left">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Risque</th>
              <th className="px-4 py-2">Entité</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 hidden lg:table-cell">Date</th>
              <th className="px-4 py-2">KYC périmé</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {(items||[]).map((a,i)=>{
              const hits = Array.isArray(a.details?.hits) ? a.details.hits : [];
              const kyc = hits.includes('KYC_OBSOLE');
              const short = String(a.desc||'').slice(0, 180);
              const lvl = riskLevel(Number(a.score||0));
              return (
                <tr key={a.id} className={(i%2? 'bg-slate-50':'bg-white') + ' hover:bg-slate-100 transition-colors'}>
                  <td className="px-4 py-2"><Link className="text-blue-700 hover:underline" href={`/alert/${a.id}`}>{a.id}</Link></td>
                  <td className="px-4 py-2"><RiskBadge level={lvl} /></td>
                  <td className="px-4 py-2">{a.entity_name || a.entity}</td>
                  <td className="px-4 py-2 align-top">
                    <div><strong>Anomalies:</strong> {hits.join(', ')}</div>
                    <div className="text-slate-500 mt-1">{short}{a.desc && a.desc.length>short.length?'…':''}</div>
                  </td>
                  <td className="px-4 py-2 hidden lg:table-cell">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</td>
                  <td className="px-4 py-2"><KYCBadge ok={!kyc} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

