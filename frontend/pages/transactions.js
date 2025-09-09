import Link from "next/link";
import Layout from "../components/Layout";
import { API_BASE } from "../lib/config";
import { useState } from "react";

export async function getServerSideProps({ query }) {
  const qs = new URLSearchParams({
    label: query.label || "",
    min_amount: query.min_amount || "",
    max_amount: query.max_amount || "",
    rule: query.rule || "",
    limit: query.limit || "200",
  });
  const url = `${API_BASE}/api/transactions?${qs.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { props: { tx: [], queryInit: query, error: `API error: ${res.status}` } };
    const tx = await res.json();
    return { props: { tx: Array.isArray(tx) ? tx : [], queryInit: query, error: null } };
  } catch (e) {
    return { props: { tx: [], queryInit: query, error: e?.message || 'Fetch failed' } };
  }
}

export default function Transactions({ tx, queryInit, error }) {
  const [label, setLabel] = useState(queryInit.label || "");
  const [minA, setMinA] = useState(queryInit.min_amount || "");
  const [maxA, setMaxA] = useState(queryInit.max_amount || "");
  const [rule, setRule] = useState(queryInit.rule || "");
  const [limit, setLimit] = useState(queryInit.limit || "200");

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0">Transactions</h1>
        <Link href="/" className="btn btn-link">← Retour</Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          Erreur chargement API: {error}
        </div>
      )}

      <form method="get" className="row g-2 mb-3">
        <div className="col-md-2">
          <input name="label" value={label} onChange={e=>setLabel(e.target.value)} placeholder="label" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="min_amount" value={minA} onChange={e=>setMinA(e.target.value)} placeholder="min_amount" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="max_amount" value={maxA} onChange={e=>setMaxA(e.target.value)} placeholder="max_amount" className="form-control" />
        </div>
        <div className="col-md-3">
          <input name="rule" value={rule} onChange={e=>setRule(e.target.value)} placeholder="rule (ex: HIGH_VALUE_TRANSFER)" className="form-control" />
        </div>
        <div className="col-md-2">
          <input name="limit" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="limit" className="form-control" />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary">Filtrer</button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>ID</th><th>Date</th><th>Amount</th><th>Cur</th><th>Channel</th>
              <th>Src</th><th>Dst</th><th>Hits</th><th>Score</th><th>Label</th>
            </tr>
          </thead>
          <tbody>
            {tx.map(t => (
              <tr key={t.tx_id}>
                <td>{t.tx_id}</td>
                <td>{t.timestamp}</td>
                <td>{t.amount}</td>
                <td>{t.currency}</td>
                <td>{t.channel}</td>
                <td>{t.src_type}:{t.src_id}</td>
                <td>{t.dst_type}:{t.dst_id}</td>
                <td>{Array.isArray(t.rule_hits) ? t.rule_hits.join(';') : t.rule_hits}</td>
                <td>{t.anomaly_score}</td>
                <td>{t.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

