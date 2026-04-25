import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Leaderboard.css';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import CustomTooltip from '../components/CustomTooltip';
import MemberCard from '../components/MemberCard';

const lineColors = [
  '#1abc9c', '#3498db', '#9b59b6', '#e67e22', '#e74c3c',
  '#2ecc71', '#f39c12', '#16a085', '#2980b9', '#8e44ad'
];

function parseLocalDate(isoDateStr) {
    const [year, month, day] = isoDateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // local midnight
  }
  

function getWeekNumber(startDate, currentDate) {
    const start = getStartOfWeek(startDate, 0);
    const diff = currentDate - start;
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.floor(diff / msInWeek) + 1;
  }  

function getStartOfWeek(startDate, weekIndex) {
    const d = new Date(startDate);
    const day = d.getDay(); // Sunday = 0, Monday = 1, ...
    const diffToMonday = (day + 6) % 7; // days to subtract to reach Monday
    d.setDate(d.getDate() - diffToMonday + (weekIndex * 7));
    d.setHours(0, 0, 0, 0); // normalize to midnight
    return d;
}  

export default function Leaderboard({ user }) {
  //const [groupId, setGroupId] = useState('');
  const { groupId } = useParams();
  const [groupName, setGroupName] = useState('');
  const [groupCreated, setGroupCreated] = useState(null);
  const [members, setMembers] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [chartRange, setChartRange] = useState('7');
  const [chartData, setChartData] = useState([]);
  const [scoreTableData, setScoreTableData] = useState([]);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);

  const weekDropdownRef = useRef();
  const rangeDropdownRef = useRef();
  const weeklyTableRef = useRef();

  const topTableScore = 80; // Example threshold for top scores
  const topScore = 250; // Example threshold for top scores

  useEffect(() => {
    function handleClickOutside(event) {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target)) {
        setWeekDropdownOpen(false);
      }
      if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(event.target)) {
        setRangeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

   useEffect(() => {
    const fetchGroupName = async () => {
      if (!groupId) return;
      const groupSnap = await getDoc(doc(db, 'groups', groupId));
      const groupData = groupSnap.data();
      setGroupName(groupData?.name || groupId);
      const created = groupData?.createdAt?.toDate?.() || new Date();
      setGroupCreated(created);
      const current = getWeekNumber(created, new Date());
      setWeekIndex(current - 1);
    };
    fetchGroupName();
  }, [groupId]);

  useEffect(() => {
    if (weeklyTableRef.current) {
      const container = weeklyTableRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [weeklyHistory]);
  

  useEffect(() => {
    if (!groupId || !groupCreated) return;

    const loadMembers = async () => {
      const memberSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
      const now = new Date();
      const chartCutoff = new Date();
      chartCutoff.setDate(now.getDate() - (chartRange === 'all' ? 9999 : parseInt(chartRange)));
      const currentWeek = getWeekNumber(groupCreated, now);

      const members = memberSnap.docs.map(docSnap => {
        const data = docSnap.data();
        const rawScores = Object.entries(data)
          .filter(([key]) => key.startsWith('scores.'))
          .reduce((acc, [key, val]) => {
            const date = key.split('.')[1];
            acc[date] = val;
            return acc;
          }, {});

        const weeklyTotals = Array.from({ length: currentWeek }, (_, i) => {
          const start = getStartOfWeek(groupCreated, i);
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          const total = Object.entries(rawScores)
            .filter(([date]) => {
              const d = parseLocalDate(date);
              return d >= start && d < end;
            })
            .reduce((sum, [_, val]) => sum + val, 0);
          return total;
        });

        const weekStart = getStartOfWeek(groupCreated, weekIndex);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weeklyScores = Object.fromEntries(
            Object.entries(rawScores).filter(([dateStr]) => {
                const d = parseLocalDate(dateStr);
                return d >= weekStart && d < weekEnd;
            })
          );

          const chartScores = Object.fromEntries(
            Object.entries(rawScores).filter(([dateStr]) => {
              const d = parseLocalDate(dateStr);
              return d >= chartCutoff;
            })
          );

        return {
          uid: docSnap.id,
          displayName: data.displayName || 'Unknown',
          photoURL: data.photoURL || '',
          weeklyScores,
          chartScores,
          weeklyTotals,
          score: Object.values(weeklyScores).reduce((a, b) => a + b, 0)
        };
      });

      setMembers(members);

      const dateSet = new Set();
      members.forEach(m => Object.keys(m.chartScores).forEach(date => dateSet.add(date)));
      const sortedDates = Array.from(dateSet).sort();

      const chart = sortedDates.map(date => {
        const row = { date };
        members.forEach(m => {
          row[m.uid] = m.chartScores[date] || 0;
        });
        return row;
      });

        const weekStart = getStartOfWeek(groupCreated, weekIndex);
        const fullWeekDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d.toISOString().split('T')[0]; // format YYYY-MM-DD
        });

        const table = fullWeekDates.map(date => {
            const row = { date };
            members.forEach(m => {
                row[m.uid] = m.weeklyScores[date] || 0;
            });
            return row;
        });


      const weeklyHistory = Array.from({ length: currentWeek }, (_, i) => {
        const row = { week: `Week ${i + 1}` };
        members.forEach(m => {
          row[m.uid] = m.weeklyTotals[i] || 0;
        });
        return row;
      });

      setChartData(chart);
      setScoreTableData(table);
      setWeeklyHistory(weeklyHistory);
    };

    loadMembers();
  }, [groupId, groupCreated, weekIndex, chartRange]);

//   const topScore = Math.max(...members.map(m => m.score));
  const colorMap = {};
  members.forEach((m, i) => {
    colorMap[m.uid] = lineColors[i % lineColors.length];
  });

  function getScoreColor(score, topScore) {
    const ratio = score / (topScore || 1);
    const red = Math.round(255 * (1 - ratio));
    const green = Math.round(255 * ratio);
    return `rgb(${red}, ${green}, 100)`;
  }

  const currentWeek = getWeekNumber(groupCreated, new Date());
  const weekOptions = Array.from({ length: currentWeek }, (_, i) => `${i + 1}`);

  return (
    <div className="leaderboard-wrapper">
      <h2 className="group-title">{groupName} Leaderboard</h2>

      <div className="leaderboard-header">
        <h3>
          <span className="timeframe-label">
            Week {weekOptions[weekIndex]}
            <span
              className="dropdown-toggle"
              onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
            >
              ▼
            </span>
            <div className="dropdown-wrapper" ref={weekDropdownRef}>
              <ul className={`timeframe-options ${!weekDropdownOpen ? 'hidden' : ''}`}>
                {weekOptions.map((label, i) => (
                  <li key={i} onClick={() => {
                    setWeekIndex(i);
                    setWeekDropdownOpen(false);
                  }}>{label}</li>
                ))}
              </ul>
            </div>
          </span>
        </h3>
      </div>

      <div className="member-grid">
        {members.map((m, index) => (
          <MemberCard
            key={m.uid}
            member={m}
            topScore={topScore}
            color={colorMap[m.uid]}
          />
        ))}
      </div>

      <div className="table-section">
        <table className="score-table">
          <thead>
            <tr>
              <th>Date</th>
              {members.map(m => (
                <th key={m.uid}>{m.displayName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoreTableData.map(row => (
              <tr key={row.date}>
                <td>{row.date}</td>
                {members.map(m => (
                  <td
                    key={m.uid}
                    style={{
                      backgroundColor: getScoreColor(row[m.uid] ?? 0, topTableScore),
                      color: '#000',
                      fontWeight: 'bold'
                    }}
                  >
                    {row[m.uid] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="leaderboard-header">
        <h3>
          <span className="timeframe-label">
            Score History for {chartRange === 'all' ? 'All Time' : `Past ${chartRange} Days`}
            <span
              className="dropdown-toggle"
              onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
            >
              ▼
            </span>
            <div className="dropdown-wrapper" ref={rangeDropdownRef}>
              <ul className={`timeframe-options ${!rangeDropdownOpen ? 'hidden' : ''}`}>
                {['7', '30', '365', 'all'].map(option => (
                  <li key={option} onClick={() => {
                    setChartRange(option);
                    setRangeDropdownOpen(false);
                  }}>
                    {option === 'all' ? 'All Time' : `Past ${option} Days`}
                  </li>
                ))}
              </ul>
            </div>
          </span>
        </h3>
      </div>

      <div className="chart-section">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip content={<CustomTooltip colorMap={colorMap} />} />
            <Legend />
            {members.map((m, index) => (
              <Line
                key={m.uid}
                dataKey={m.uid}
                name={m.displayName}
                stroke={lineColors[index % lineColors.length]}
                strokeWidth={2}
                dot={{ r: 0 }}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ marginTop: '2rem' }}>Weekly History</h3>

      <div className="table-section"
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #ccc',
              paddingRight: '4px'
            }}
            ref={weeklyTableRef}>
        <table className="score-table">
          <thead>
            <tr>
              <th>Week</th>
              {members.map(m => (
                <th key={m.uid}>{m.displayName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeklyHistory.map((row, i) => (
              <tr key={i}>
                <td>{row.week}</td>
                {members.map(m => (
                  <td
                    key={m.uid}
                    style={{
                      backgroundColor: getScoreColor(row[m.uid] ?? 0, topScore),
                      color: '#000',
                      fontWeight: 'bold'
                    }}
                  >
                    {row[m.uid] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
