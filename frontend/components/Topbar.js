"use client";
import { useState } from 'react';
import { API_BASE } from '../lib/config';

export default function Topbar(){
  const [q, setQ] = useState("");

  async function onSubmit(e){
    e?.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/v1/ai/nl-search`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q }) });
      const js = await r.json();
      const sp = new URLSearchParams();
      if (js?.filters?.minScore) sp.set('minScore', String(js.filters.minScore));
      // route vers alerts avec minScore si détecté
      const url = '/alerts' + (sp.toString()? ('?'+sp.toString()):'');
      try { window.location.href = url; } catch { }
    } catch {}
  }

  return (
    <div className="fs-topbar" role="region" aria-label="Actions rapides">
      <form onSubmit={onSubmit} className="fs-topbar-search" role="search">
        <input aria-label="Recherche en langage naturel" value={q} onChange={e=>setQ(e.target.value)} placeholder="Recherche NL (ex: score > 85 pays FR)" />
        <button type="submit">Rechercher</button>
      </form>
      <div className="fs-topbar-actions">
        <label className="switch" title="Thème">
          <input type="checkbox" onChange={()=>{ try{ document.documentElement.classList.toggle('light'); }catch{} }} />
          <span>Thème</span>
        </label>
      </div>
    </div>
  );
}
