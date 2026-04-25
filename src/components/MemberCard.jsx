import defaultAvatar from '../assets/default-avatar.png';

export default function MemberCard({ member, topScore, color }) {
  const isTop = member.score === topScore;

  return (
    <div
      className={`member-card ${isTop ? 'gold-border' : ''}`}
    >
      <img
        src={member.photoURL || defaultAvatar}
        alt={member.displayName}
        className="member-avatar"
      />
      <div className="member-name">{member.displayName}</div>
      <div
        className="member-score"
        style={{ backgroundColor: getScoreColor(member.score, topScore) }}
      >
        {member.score} pts
      </div>
    </div>
  );
}

function getScoreColor(score, topScore) {
    const ratio = score / (topScore || 1);
    const red = Math.round(255 * (1 - ratio));
    const green = Math.round(255 * ratio);
    return `rgb(${red}, ${green}, 100)`;
}
  