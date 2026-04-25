export default function CustomTooltip({ active, payload, label, colorMap }) {
  if (!active || !payload || !payload.length) return null;

  const getScoreColor = (score) => {
    if (score < 35) return '#e74c3c';
    if (score < 60) return '#f1c40f';
    return '#2ecc71';
  };

  return (
    <div className="tooltip-container">
      <div className="tooltip-label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i}>
          <span
            className="tooltip-name"
            style={{ color: colorMap?.[entry.dataKey] || '#ccc' }}
          >
            {entry.name}:
          </span>
          <span
            className="tooltip-score"
            style={{ color: 'white' }}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
