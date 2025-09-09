import { useEffect, useState } from 'react';

export default function SystemLoadMeter() {
  const [m, setM] = useState({ tx_per_sec: 0, alerts_per_min: 0, high_share: 0 });
  useEffect(() => {
    const es = new EventSource('/api/stream/metrics');
    es.addEventListener('metrics', (e)=>{ try { setM(JSON.parse(e.data)); } catch {} });
    es.onerror = () => {};
    return () => { try { es.close(); } catch {} };
  }, []);
  return (
    <div className="card shadow-sm">
      <div className="card-header">Monitoring</div>
      <div className="card-body">
        <div className="mb-2">Tx/s: <strong>{m.tx_per_sec}</strong></div>
        <div className="mb-2">Alertes/min: <strong>{m.alerts_per_min}</strong></div>
        <div>Part HIGH: <strong>{Math.round(m.high_share*100)}%</strong></div>
      </div>
    </div>
  );
}

