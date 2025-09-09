import Link from 'next/link';

export default function Layout({ children }) {
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <Link className="navbar-brand" href="/">FraudShield</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarsExample" aria-controls="navbarsExample" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarsExample">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link" href="/">Dashboard</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" href="/transactions">Transactions</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <main className="container py-4">
        {children}
      </main>
    </div>
  );
}

