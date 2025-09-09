import SystemLoadMeter from '../components/SystemLoadMeter';
import { parse } from 'cookie';

export async function getServerSideProps({ req }) {
  try {
    const role = parse(req.headers.cookie || '').role || '';
    if (role !== 'admin') {
      return { redirect: { destination: '/403', permanent: false } };
    }
    return { props: {} };
  } catch { return { redirect: { destination: '/403', permanent: false } }; }
}

export default function Supervision() {
  return (
    <>
      <h1 className="page-title">Supervision Système</h1>
      <SystemLoadMeter />
      <div className="alert alert-secondary mt-3">RBAC Admin-only à activer (MFA/2FA recommandé).</div>
    </>
  );
}
