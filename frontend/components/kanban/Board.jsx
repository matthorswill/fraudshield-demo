"use client";
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import Column from './Column';
import Filters from './Filters';
import DetailPanel from './DetailPanel';
import { API_BASE } from '../../lib/api';

export default function Board(){
  const [cases,setCases]=useState([]);
  const [metrics,setMetrics]=useState(null);
  const [filters,setFilters]=useState({});
  const [sel,setSel]=useState(null);
  const sensors = useSensors(useSensor(PointerSensor));
  async function load(){
    const sp = new URLSearchParams();
    for (const [k,v] of Object.entries(filters)) if (v!=null && v!=='') sp.set(k, String(v));
    const r = await fetch(`${API_BASE}/v1/cases?${sp.toString()}`, { cache: 'no-store' });
    const js = await r.json(); setCases(js.items||[]);
    const m = await fetch(`${API_BASE}/v1/cases/metrics`, { cache: 'no-store' }); setMetrics(await m.json());
  }
  useEffect(()=>{ load().catch(()=>{}); },[JSON.stringify(filters)]);

  const cols = useMemo(()=>({
    Open: cases.filter(c=>c.status==='Open'),
    Investigating: cases.filter(c=>c.status==='Investigating'),
    Resolved: cases.filter(c=>c.status==='Resolved'),
    OnHold: cases.filter(c=>c.status==='OnHold'),
  }),[cases]);

  async function onDragEnd(e){
    const to = e.over?.id; const id = e.active?.id?.replace?.('case-','');
    if (!to || !id) return;
    try {
      await fetch(`${API_BASE}/v1/cases/${id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', 'Idempotency-Key': cryptoRandom() }, body: JSON.stringify({ status: to }) });
      setCases(prev => prev.map(c=> c.id==id? { ...c, status: to } : c));
    } catch {}
  }

  function cryptoRandom(){ try{ return crypto.randomUUID(); }catch{ return String(Math.random()); } }

  function applyFilters(f){
    if (f.export){
      const sp = new URLSearchParams();
      for (const [k,v] of Object.entries(f)) if (v && k!=='export') sp.set(k, String(v));
      window.open(`${API_BASE}/v1/cases/export.csv?${sp.toString()}`, '_blank');
      return;
    }
    setFilters(f);
  }

  return (
    <div className="d-flex flex-column" style={{gap:12}}>
      <Filters init={filters} onApply={applyFilters} />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="row g-3">
          <div className="col-12 col-lg-3"><Column title={`Open`} status="Open" items={cols.Open} onOpen={(c)=>setSel(c.id)} /></div>
          <div className="col-12 col-lg-3"><Column title={`Investigating`} status="Investigating" items={cols.Investigating} onOpen={(c)=>setSel(c.id)} /></div>
          <div className="col-12 col-lg-3"><Column title={`Resolved`} status="Resolved" items={cols.Resolved} onOpen={(c)=>setSel(c.id)} /></div>
          <div className="col-12 col-lg-3"><Column title={`On hold`} status="OnHold" items={cols.OnHold} onOpen={(c)=>setSel(c.id)} /></div>
        </div>
      </DndContext>
      <AnimatePresence>
        {sel && (<DetailPanel id={sel} onClose={()=>setSel(null)} />)}
      </AnimatePresence>
    </div>
  );
}

