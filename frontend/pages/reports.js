import { API_BASE } from '../lib/config';
import { useEffect, useMemo, useRef, useState } from 'react';

export async function getServerSideProps({ query }) {
  const qs = new URLSearchParams();
  if (query.channel) qs.set('channel', String(query.channel));
  try {
    const r = await fetch(`${API_BASE}/api/reports${qs.toString() ? ('?' + qs.toString()) : ''}`);
    if (!r.ok) return { props: { report: null, error: `API ${r.status}` } };
    const { report } = await r.json();
    return { props: { report, error: null } };
  } catch (e) { return { props: { report: null, error: e?.message || 'Fetch failed' } }; }
}

export default function Reports({ report, error }) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(() => report?.timeseries?.daily?.[0]?.date || '');
  const [to, setTo] = useState(() => report?.timeseries?.daily?.slice(-1)?.[0]?.date || '');
  const [fChannel, setFChannel] = useState('');
  const [fSrc, setFSrc] = useState('');
  const [fDst, setFDst] = useState('');
  const [fMinScore, setFMinScore] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Charts refs
  const lineRef = useRef(null); const donutRef = useRef(null); const barRef = useRef(null); const rtRef = useRef(null);
  const lineChartRef = useRef(null); const donutChartRef = useRef(null); const barChartRef = useRef(null); const rtChartRef = useRef(null);

  // Build charts client-side
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!report) return;
      const { default: Chart } = await import('chart.js/auto');
      const inRange = (d) => (!from || d >= from) && (!to || d <= to);
      // Destroy previous instances
      try { lineChartRef.current?.destroy?.(); donutChartRef.current?.destroy?.(); barChartRef.current?.destroy?.(); } catch {}

      const days = (report.timeseries?.daily || []).filter(d=>inRange(d.date)).map(d=>d.date);
      const dailyCounts = (report.timeseries?.daily || []).filter(d=>inRange(d.date)).map(d=>d.alerts);
      const preds = (report.timeseries?.predictions || []).map(d=>d.alerts);

      const lctx = lineRef.current?.getContext('2d');
      if (lctx && mounted) {
        lineChartRef.current = new Chart(lctx, {
          type: 'line', data: { labels: days.concat(Array(preds.length).fill('')), datasets: [
            { label: 'Alertes', data: dailyCounts.concat(Array(preds.length).fill(null)), borderColor: '#4e79a7', backgroundColor: 'rgba(78,121,167,.2)', tension:.2 },
            { label: 'Prévision', data: Array(dailyCounts.length).fill(null).concat(preds), borderColor:'#f28e2b', borderDash:[6,6], tension:.2 }
          ]}, options: { plugins: { legend: { position:'bottom' } } }
        });
        // drill-down on click: set day range
        const canvas = lineRef.current;
        if (canvas) {
          canvas.onclick = (evt) => {
            const points = lineChartRef.current.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points && points.length) {
              const idx = points[0].index;
              const label = lineChartRef.current.data.labels[idx];
              if (typeof label === 'string' && /\d{4}-\d{2}-\d{2}/.test(label)) {
                setFrom(label); setTo(label);
                const pr = document.getElementById('priorities-table');
                if (pr) pr.scrollIntoView({ behavior:'smooth', block:'start' });
              }
            }
          };
        }
      }

      const dctx = donutRef.current?.getContext('2d');
      if (dctx && mounted) {
        const { HIGH=0, MEDIUM=0, LOW=0 } = report.bands || {};
        donutChartRef.current = new Chart(dctx, { type:'doughnut', data: { labels:['ÉLEVÉ','MOYEN','FAIBLE'], datasets:[{ data:[HIGH,MEDIUM,LOW], backgroundColor:['#db0011','#e2c170','#1f8a5b']} ] }, options:{ plugins:{ legend:{ position:'bottom' } } } });
      }

      const bctx = barRef.current?.getContext('2d');
      if (bctx && mounted) {
        const labels = (report.channels||[]).map(c=>c.channel); const counts = (report.channels||[]).map(c=>c.count);
        barChartRef.current = new Chart(bctx, { type:'bar', data:{ labels, datasets:[{ label:'Transactions', data:counts, backgroundColor:'#4e79a7' }] }, options:{ plugins:{ legend:{ display:false } } } });
        // click bar to filter channel
        const c = barRef.current; if (c) {
          c.onclick = (evt) => {
            const pts = barChartRef.current.getElementsAtEventForMode(evt, 'nearest', { intersect:true }, true);
            if (pts && pts.length) {
              const idx = pts[0].index; const label = barChartRef.current.data.labels[idx];
              if (label) setFChannel(String(label));
            }
          };
        }
      }

      const lrctx = rtRef.current?.getContext('2d');
      if (lrctx && mounted) {
        rtChartRef.current?.destroy?.();
        rtChartRef.current = new Chart(lrctx, { type:'line', data:{ labels:[], datasets:[{ label:'Alertes/min (live)', data:[], borderColor:'#7a5195', tension:.25 }] }, options:{ animation:false, plugins:{ legend:{ display:false } }, scales:{ x:{ display:false } } } });
      }
    })();
    return () => { mounted = false; try { lineChartRef.current?.destroy?.(); donutChartRef.current?.destroy?.(); barChartRef.current?.destroy?.(); } catch {} };
  }, [report, from, to]);

  // SSE mini line
  useEffect(() => {
    let es; try { es = new EventSource(`${API_BASE}/api/stream/metrics`); } catch { return; }
    es.addEventListener('metrics', (e)=>{
      try {
        const data = JSON.parse(e.data);
        const chart = rtChartRef.current; if (!chart) return;
        chart.data.labels.push(''); chart.data.datasets[0].data.push(Number(data.alerts_per_min||0));
        if (chart.data.datasets[0].data.length>60){ chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
        chart.update('none');
      } catch {}
    });
    es.onerror = () => {};
    return () => { try { es.close(); } catch {} };
  }, []);

  const countrySet = useMemo(() => {
    const s = new Set();
    for (const a of (report?.priorityAlerts||[])) {
      if (a?.details?.src_country) s.add(a.details.src_country);
      if (a?.details?.dst_country) s.add(a.details.dst_country);
    }
    return Array.from(s).sort();
  }, [report]);

  const priorities = useMemo(() => (report?.priorityAlerts||[])
    .filter(a => {
      const d = a.created_at ? a.created_at.slice(0,10) : '';
      return (!from || d >= from) && (!to || d <= to);
    })
    .filter(a => (!q || String(a.entity_name||a.entity||'').toLowerCase().includes(q.toLowerCase()) || String(a.details?.hits||'').toLowerCase().includes(q.toLowerCase())))
    .filter(a => (!fChannel || String(a.details?.channel||'')===fChannel))
    .filter(a => (!fSrc || String(a.details?.src_country||'')===fSrc))
    .filter(a => (!fDst || String(a.details?.dst_country||'')===fDst))
    .filter(a => (!fMinScore || Number(a.score||0) >= Number(fMinScore)))
    .slice(0,100), [report, q, from, to, fChannel, fSrc, fDst, fMinScore]);

  async function shareTeams(){
    try {
      const { HIGH=0, MEDIUM=0, LOW=0 } = report?.bands || {};
      const top = priorities.slice(0,5).map(a => `#${a.id} ${a.entity_name||a.entity} ${(a.details?.amount||0)} ${(a.details?.currency||'')} (score ${a.score})`).join('\n');
      const text = `Rapport FraudShield\nBilan: HIGH=${HIGH}, MEDIUM=${MEDIUM}, LOW=${LOW}\nTop priorités:\n${top}`;
      const resp = await fetch(`${API_BASE}/api/share/teams`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      alert('Partagé sur Teams (webhook).');
    } catch (e) { alert('Partage Teams échoué: ' + (e?.message||e)); }
  }

  async function exportExcel() {
    try {
      const XLSX = (await import('xlsx')).default; const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(priorities.map(p => ({ id:p.id, score:p.score, amount:p.details?.amount, currency:p.details?.currency, entity:p.entity_name||p.entity, hits:(p.details?.hits||[]).join(';'), date:p.created_at })));
      XLSX.utils.book_append_sheet(wb, ws1, 'Priorities');
      const ws2 = XLSX.utils.json_to_sheet((report?.timeseries?.daily||[]).map(d=>({date:d.date, alerts:d.alerts})));
      XLSX.utils.book_append_sheet(wb, ws2, 'Daily');
      const ws3 = XLSX.utils.json_to_sheet((report?.channels||[])); XLSX.utils.book_append_sheet(wb, ws3, 'Channels');
      XLSX.writeFile(wb, `fraudshield-report-${fChannel||'all'}-${from||'start'}_${to||'end'}.xlsx`);
    } catch (e) { alert('Export Excel échoué: ' + (e?.message||e)); }
  }

  async function exportPDF() {
    try {
      const { jsPDF } = await import('jspdf'); const html2canvas = (await import('html2canvas')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const el = document.getElementById('report-root');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png'); const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40; const imgHeight = canvas.height * imgWidth / canvas.width;
      doc.addImage(img, 'PNG', 20, 20, imgWidth, Math.min(imgHeight, pageHeight-40));
      doc.save(`fraudshield-report-${fChannel||'all'}-${from||'start'}_${to||'end'}.pdf`);
    } catch (e) { alert('Export PDF échoué: ' + (e?.message||e)); }
  }

  // Auto-refresh snapshot every 60s
  useEffect(() => {
    if (!autoRefresh) return; const t = setInterval(() => { try { location.reload(); } catch {} }, 60000); return () => clearInterval(t);
  }, [autoRefresh]);

  return (
    <>
      <h1 className="page-title">Rapports & Analyses</h1>
      {error && <div className="alert alert-danger">Erreur: {error}</div>}
      {!report && !error && <div className="alert alert-info">Chargement…</div>}
      {report && (
        <>
          <div className="filters-bar mb-3" id="report-root">
            <div className="row g-2 align-items-center">
              <div className="col-lg-4">
                <div className="input-group">
                  <span className="input-group-text" style={{borderRadius:10}}>🔎</span>
                  <input className="form-control" placeholder="Rechercher (entité, règles, action)" value={q} onChange={e=>setQ(e.target.value)} />
                  <button className="btn btn-outline-secondary" type="button" onClick={async ()=>{
                    try{ const r=await fetch(`${API_BASE}/api/nlq`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q})}); const js=await r.json(); const f=js.filters||{}; if(f.channel) setFChannel(f.channel); if(f.country){ setFSrc(f.country); setFDst(''); } if(f.minScore) setFMinScore(String(f.minScore)); }catch{}
                  }}>Interpréter NL</button>
                </div>
              </div>
              <div className="col-auto">
                <select className="form-select" value={fChannel} onChange={e=>setFChannel(e.target.value)}>
                  <option value="">Tous canaux</option>
                  {(report?.channels||[]).map(c=> (<option key={c.channel} value={c.channel}>{c.channel}</option>))}
                </select>
              </div>
              <div className="col-auto">
                <input type="date" className="form-control" value={from||''} onChange={e=>setFrom(e.target.value)} />
              </div>
              <div className="col-auto">→</div>
              <div className="col-auto">
                <input type="date" className="form-control" value={to||''} onChange={e=>setTo(e.target.value)} />
              </div>
              <div className="col-auto">
                <select className="form-select" value={fSrc} onChange={e=>setFSrc(e.target.value)}>
                  <option value="">Pays source</option>
                  {countrySet.map(c=> (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="col-auto">
                <select className="form-select" value={fDst} onChange={e=>setFDst(e.target.value)}>
                  <option value="">Pays destination</option>
                  {countrySet.map(c=> (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="col-auto">
                <select className="form-select" value={fMinScore} onChange={e=>setFMinScore(e.target.value)}>
                  <option value="">Score min</option>
                  <option value="70">70</option>
                  <option value="85">85</option>
                  <option value="95">95</option>
                </select>
              </div>
              <div className="col-auto ms-auto">
                <div className="d-flex" style={{gap:8}}>
                  <button className="btn btn-outline-secondary" onClick={exportPDF}>Exporter PDF</button>
                  <button className="btn btn-outline-secondary" onClick={exportExcel}>Exporter Excel</button>
                  <button className="btn btn-gold" onClick={shareTeams}>Partager Teams</button>
                </div>
              </div>
            </div>
            <div className="row g-2 mt-2 align-items-center">
              <div className="col-auto form-check form-switch">
                <input id="autoRefresh" className="form-check-input" type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} />
                <label className="form-check-label" htmlFor="autoRefresh">Auto-refresh 60s</label>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-6">
              <div className="card shadow-sm"><div className="card-header">Alertes & prévisions</div><div className="card-body"><canvas ref={lineRef} height="150" /></div></div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card shadow-sm"><div className="card-header">Risque par bande</div><div className="card-body"><canvas ref={donutRef} height="220" /></div></div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="card shadow-sm"><div className="card-header">Temps réel</div><div className="card-body"><canvas ref={rtRef} height="100" /></div></div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm"><div className="card-header">Transactions par canal</div><div className="card-body"><canvas ref={barRef} height="150" /></div></div>
            </div>
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm"><div className="card-header">Synthèse</div><div className="card-body">
                <div>Transactions: <strong>{report.totals?.transactions}</strong></div>
                <div>Alertes: <strong>{report.totals?.alerts}</strong></div>
              </div></div>
            </div>
          </div>

          <div className="card shadow-sm" id="priorities-table">
            <div className="card-header">Priorités de fraude à traiter</div>
            <div className="table-responsive">
              <table className="table table-sm fs-table mb-0">
                <thead><tr><th>ID</th><th>Entité</th><th>Montant</th><th>Devise</th><th>Score</th><th>Date</th></tr></thead>
                <tbody>
                  {priorities.map(a => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.entity_name || a.entity}</td>
                      <td>{(a.details?.amount||0).toLocaleString()}</td>
                      <td>{a.details?.currency||''}</td>
                      <td>{a.score}</td>
                      <td>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
