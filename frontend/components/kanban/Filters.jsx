"use client";
import { useState } from 'react';

export default function Filters({ init={}, onApply }){
  const [q,setQ]=useState(init.q||'');
  const [status,setStatus]=useState(init.status||'');
  const [band,setBand]=useState(init.risk_band||'');
  const [minA,setMinA]=useState(init.min_amount||'');
  const [maxA,setMaxA]=useState(init.max_amount||'');
  const [over,setOver]=useState(!!init.over_sla);
  function apply(){ onApply?.({ q, status, risk_band: band, min_amount:minA, max_amount:maxA, over_sla: over }); }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="form-control" placeholder="Recherche (ex: FR score>85)" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:240}} />
      <select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="">Tous statuts</option>
        <option>Open</option><option>Investigating</option><option>Resolved</option><option>OnHold</option>
      </select>
      <select className="form-select" value={band} onChange={e=>setBand(e.target.value)}>
        <option value="">Bande</option>
        <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
      </select>
      <input className="form-control" placeholder="min €" value={minA} onChange={e=>setMinA(e.target.value)} style={{width:100}} />
      <input className="form-control" placeholder="max €" value={maxA} onChange={e=>setMaxA(e.target.value)} style={{width:100}} />
      <label className="form-check-label d-flex align-items-center gap-1"><input className="form-check-input" type="checkbox" checked={over} onChange={e=>setOver(e.target.checked)} />Over-SLA</label>
      <button className="btn btn-gold" onClick={apply}>Appliquer</button>
      <a className="btn btn-outline-secondary" href="#" onClick={(e)=>{e.preventDefault(); onApply?.({ export:true, q, status, risk_band: band, min_amount:minA, max_amount:maxA, over_sla: over });}}>Exporter CSV</a>
    </div>
  );
}

