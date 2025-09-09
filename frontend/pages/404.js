import Link from "next/link";

export default function Custom404() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif",
      padding: 24,
      background: "#f7f7f7"
    }}>
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 24, maxWidth: 640 }}>
        <h1 style={{ marginTop: 0 }}>404 — Page introuvable</h1>
        <p style={{ color: "#555" }}>
          La ressource demandée n’existe pas ou n’est plus disponible.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: "#0070f3" }}>← Retour au tableau de bord</Link>
        </div>
      </div>
    </div>
  );
}

