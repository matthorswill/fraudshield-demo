export default function AlertChip({ level = 'low', children }) {
  const map = { high: 'red', medium: 'gold', low: 'green' };
  return <span className={`chip ${map[level] || ''}`}>{children}</span>;
}

