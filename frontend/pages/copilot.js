import { useState } from 'react';
import { API_BASE } from '../lib/config';

export default function Copilot() {
  const [q, setQ] = useState('Explique-moi pourquoi ce client est à risque.');
  const [a, setA] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(e) {
    e?.preventDefault(); setLoading(true); setA('');
    try {
      const res = await fetch(`${API_BASE}/api/copilot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question: q }) });
      const js = await res.json(); setA(js.answer || '');
    } catch (e) { setA('Erreur: ' + (e?.message||e)); }
    setLoading(false);
  }

  function speak() {
    try { const u = new SpeechSynthesisUtterance(a || ''); u.lang='fr-FR'; window.speechSynthesis.speak(u); } catch {}
  }

  return (
    <>
      <h1 className="page-title">Copilot AML</h1>
      <form onSubmit={ask} className="filters-bar mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-lg-9"><input className="form-control" value={q} onChange={e=>setQ(e.target.value)} placeholder="Pose une question en langage naturel" /></div>
          <div className="col-auto"><button className="btn btn-gold" disabled={loading}>{loading?'…':'Poser la question'}</button></div>
          <div className="col-auto"><button type="button" className="btn btn-outline-secondary" onClick={speak}>Lire la réponse</button></div>
        </div>
      </form>
      <div className="card">
        <div className="card-header">Réponse</div>
        <div className="card-body" style={{whiteSpace:'pre-wrap'}}>{a || '—'}</div>
      </div>
    </>
  );
}
