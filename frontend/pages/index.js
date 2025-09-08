import Link from "next/link";
import { API_BASE } from "../lib/config";

export async function getServerSideProps() {
  // Fetch alerts from your backend API
  const res = await fetch(`${API_BASE}/api/alerts`);
  const alerts = await res.json();
  return { props: { alerts } };
}

export default function Home({ alerts }) {
  const sorted = alerts.slice().sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>FraudShield AI — Dashboard</h1>
      <table border="1" cellPadding="8" style={{ width: "100%", marginTop: 12 }}>
        <thead>
          <tr style={{ backgroundColor: "#333", color: "#fff" }}>
            <th>ID</th>
            <th>Type</th>
            <th>Score</th>
            <th>Entity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{a.id}</td>
              <td>{a.type}</td>
              <td style={{ color: a.score > 80 ? "red" : "black" }}>{a.score}</td>
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
