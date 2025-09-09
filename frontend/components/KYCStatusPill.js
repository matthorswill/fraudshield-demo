export default function KYCStatusPill({ expired }) {
  return <span className={`pill ${expired ? 'bad' : 'ok'}`}>{expired ? 'KYC périmé' : 'KYC OK'}</span>;
}

