export default function Forbidden(){
  return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#f5f7fa',background:'#0b0c10'}}>
      <div>
        <h1>403 — Accès interdit</h1>
        <p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
        <a href="/" style={{color:'#db0011'}}>Retourner au dashboard</a>
      </div>
    </div>
  );
}

