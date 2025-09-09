"use client";
import { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api';
import { motion } from 'framer-motion';

export default function DetailPanel({ id, onClose }){
  const [data,setData]=useState(null);
  const [timeline,setTimeline]=useState([]);
  useEffect(()=>{ (async()=>{ if(!id) return; try{ const r=await fetch(`${API_BASE}/v1/cases/${id}`); setData(await r.json()); const t=await fetch(`${API_BASE}/v1/cases/${id}/timeline`); const js=await t.json(); setTimeline(js.items||[]);}catch{} })(); },[id]);
  if (!id) return null;
  return (
    <motion.div initial={{ x:40, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:40, opacity:0 }} className="position-fixed top-0 end-0 h-100 bg-dark text-light" style={{width:420, zIndex:50}}>
      <div className="d-flex justify-content-between align-items-center p-2 border-bottom border-secondary">
        <div>Détails - Case #{id}</div>
        <button className="btn btn-sm btn-outline-light" onClick={onClose}>Fermer</button>
      </div>
      <div className="p-2" style={{overflowY:'auto', height:'calc(100% - 48px)'}}>
        <div className="mb-2"><strong>Titre:</strong> {data?.case?.title||''}</div>
        <div className="mb-2"><strong>Statut:</strong> {data?.case?.status||''}</div>
        <div className="mb-2"><strong>Priorité:</strong> {data?.case?.priority||''}</div>
        <div className="mb-2"><strong>Montant:</strong> {data?.case?.amount?.toLocaleString?.()||data?.case?.amount} {data?.case?.currency}</div>
        <div className="mb-2"><strong>Entité:</strong> {data?.entity?.name||data?.case?.entity_id}</div>
        <div className="mt-3"><strong>Timeline</strong></div>
        <div className="small text-muted">
          {(timeline||[]).map((e,i)=>(<div key={i} className="border-bottom border-secondary py-1"><div>{e.ts} — {e.event}</div><div className="text-wrap">{JSON.stringify(e)}</div></div>))}
        </div>
      </div>
    </motion.div>
  );
}

