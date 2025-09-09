
export default function Login(){
  return (
    <>
      <h1 className="page-title">Connexion</h1>
      <form className="filters-bar" style={{maxWidth:420}}>
        <div className="mb-2"><input type="email" className="form-control" placeholder="Email" /></div>
        <div className="mb-2"><input type="password" className="form-control" placeholder="Mot de passe" /></div>
        <div className="mb-2"><input type="text" className="form-control" placeholder="Code MFA (TOTP)" /></div>
        <button className="btn btn-accent">Se connecter</button>
      </form>
      <div className="text-muted small">Demo: authentification mock à brancher sur votre SSO/MFA.</div>
    </>
  );
}
