export default function RiskScoreBar({ score = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(score)));
  return (
    <div className="riskbar" title={`Score ${pct}`}>
      <span style={{ width: `${pct}%` }}></span>
    </div>
  );
}

