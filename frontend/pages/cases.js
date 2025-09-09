import { useMemo, useState } from 'react';

export default function Cases(){
  const [filter, setFilter] = useState('all');
  const init = useMemo(()=>({
    Open: [ { id: 101, summary:'Virement SWIFT montant élevé - justificatifs manquants', priority:'High' } ],
    Investigating: [ { id: 102, summary:'Flux CRYPTO non enregistré', priority:'Medium' } ],
    Resolved: [ { id: 99, summary:'Structuration proche seuil (< 10k)', priority:'Low' } ],
  }),[]);
  const cols = ['Open','Investigating','Resolved'];
  return (
    <>
      <h1 className="page-title">Cases</h1>
      <div className="row g-3">
        {cols.map(col => (
          <div key={col} className="col-12 col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>{col}</span>
                <button className="btn btn-sm btn-outline-secondary">+ Nouveau</button>
              </div>
              <div className="card-body" style={{minHeight:220}}>
                {(init[col]||[]).map(item => (
                  <div key={item.id} className="p-2 mb-2" style={{border:'1px solid #343843',borderRadius:8,background:'#1f1f1f'}}>
                    <div className="small text-muted">Case #{item.id} — {item.priority}</div>
                    <div>{item.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

