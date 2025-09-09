import { ReactNode } from 'react';

export default function Badge({ children, className='' }:{ children: ReactNode; className?: string }){
  return (
    <span className={["inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", className].join(' ')}>{children}</span>
  );
}

export function RiskBadge({ level }:{ level:'HIGH'|'MEDIUM'|'LOW' }){
  const map:any = {
    HIGH:   'bg-red-100 text-red-700 border border-red-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border border-amber-200',
    LOW:    'bg-emerald-100 text-emerald-700 border border-emerald-200'
  };
  return <Badge className={map[level]||''}>{level}</Badge>;
}

export function KYCBadge({ ok }:{ ok:boolean }){
  return ok
    ? <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">KYC OK</Badge>
    : <Badge className="bg-red-100 text-red-700 border border-red-200">KYC périmé</Badge>;
}

