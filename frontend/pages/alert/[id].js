import Link from "next/link";
import { API_BASE } from "../../lib/config";

export async function getServerSideProps({ params }) {
  const id = Number(params.id);
  const res = await fetch(`${API_BASE}/api/alerts/${id}`);
  if (!res.ok) return { notFound: true };
  const alert = await res.json();
  return { props: { alert } };
}

export default function AlertDetail({ alert }) {
  const imgMap = {
    1: "/graph-alpha.png",
    2: "/graph-media.png",
    3: "/graph-beta.png",
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{alert.type} — {alert.entity}</h1>
        <RiskBadge score={alert.score} />
      </div>
      <p style={{ marginTop: 8, color: "#444" }}>{alert.desc}</p>

      <div style={{ marginTop: 24, background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Visualisation</h3>
        <img src={imgMap[alert.id]} alt="Visualisation" style={{ maxWidth: "100%", borderRadius: 6 }} />
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "#0070f3" }}>← Retour au tableau de bord</Link>
      </div>
    </div>
  );
}

function RiskBadge({ score }) {
  const { bg, color, label } = getRiskStyle(score);
  return (
    <span style={{
      background: bg,
      color,
      border: `1px solid ${color}`,
      padding: "6px 10px",
      borderRadius: 999,
      fontWeight: 700
    }}>
      {label} : {score}
    </span>
  );
}
function getRiskStyle(score) {
  if (score >= 85) return { bg: "#ffe5e5", color: "#cc0000", label: "ÉLEVÉ" };
  if (score >= 70) return { bg: "#fff6e0", color: "#b36b00", label: "MOYEN" };
  return { bg: "#e9f8ef", color: "#1c7c3a", label: "FAIBLE" };
}

