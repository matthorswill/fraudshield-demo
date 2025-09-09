import Link from "next/link";
import { useMemo, useState } from "react";
import { API_BASE } from "../lib/config";

export async function getServerSideProps() {
  const res = await fetch(`${API_BASE}/api/alerts`);
  const alerts = await res.json();
  return { props: { alerts } };
}

export default function Home({ alerts }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = alerts.slice().sort((a, b) => b.score - a.score);
    if (!query) return arr;
    return arr.filter((a) =>
      String(a.id).includes(query) ||
      a.type.toLowerCase().includes(query) ||
      a.entity.toLowerCase().includes(query) ||
      a.desc.toLowerCase().includes(query)
    );
  }, [alerts, q]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>FraudShield AI — Tableau de bord</h1>

      <div style={{ marginTop: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher ID, type, entité, description…"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
      </div>

      <table border="1" cellPadding="8" style={{ width: "100%", marginTop: 12 }}>
        <thead>
          <tr style={{ backgroundColor: "#333", color: "#fff" }}>
            <th>ID</th>
            <th>Type</th>
            <th>Score</th>
            <th>Entité</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{a.id}</td>
              <td>{a.type}</td>
              <td>
                <RiskBadge score={a.score} />
              </td>
              <td>{a.entity}</td>
              <td>
                <Link href={`/alert/${a.id}`}>{a.desc}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ score }) {
  const { bg, color, label } = getRiskStyle(score);
  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${color}`,
        padding: "2px 8px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {label} {score}
    </span>
  );
}

function getRiskStyle(score) {
  if (score >= 85) return { bg: "#ffe5e5", color: "#cc0000", label: "ÉLEVÉ" };
  if (score >= 70) return { bg: "#fff6e0", color: "#b36b00", label: "MOYEN" };
  return { bg: "#e9f8ef", color: "#1c7c3a", label: "FAIBLE" };
}

