import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import './History.css';

import { collection, getDocs, deleteDoc, doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

function parseLocalDate(isoDateStr) {
  const [year, month, day] = isoDateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const score = payload[0].value;
  const getColor = (score) => {
    if (score < 35) return '#e74c3c';
    if (score < 60) return '#f1c40f';
    return '#2ecc71';
  };

  return (
    <div style={{
      backgroundColor: '#222',
      color: getColor(score),
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid #444',
      fontSize: '0.9rem'
    }}>
      <div><strong>{label}</strong></div>
      <div style={{ color: getColor(score) }}>Score: {score}</div>
    </div>
  );
}

export default function History({ user }) {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user?.uid) return;

    const loadScores = async () => {
      const scoresCol = collection(db, 'history', user.uid, 'scores');
      const snapshot = await getDocs(scoresCol);
      const entries = snapshot.docs.map(doc => ({
        date: doc.id,
        ...doc.data()
      }));

      const now = new Date();

      const filtered = entries.filter(({ date }) => {
        if (filter === 'all') return true;
        const d = parseLocalDate(date);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= parseInt(filter);
      });

      const sorted = filtered.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
      setHistory(sorted);
    };

    loadScores();
  }, [filter, user]);

  async function clearAllHistory() {
    const confirmClear = window.confirm("Are you sure you want to delete all of your history? This cannot be undone.");
    if (!confirmClear) return;

    try {
      const scoresCol = collection(db, 'history', user.uid, 'scores');
      const snapshot = await getDocs(scoresCol);
      const deletePromises = snapshot.docs.map(docSnap =>
        deleteDoc(doc(db, 'history', user.uid, 'scores', docSnap.id))
      );

      // Remove from all groups
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const groupIds = userSnap.data()?.groups || [];
      for (const groupId of groupIds) {
        const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
        const deleteFields = {};
        snapshot.docs.forEach(docSnap => {
          deleteFields[`scores.${docSnap.id}`] = deleteField();
        });
        await setDoc(memberRef, deleteFields, { merge: true });
      }

      await Promise.all(deletePromises);
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  async function deleteDay(dateToDelete) {
    try {
      await deleteDoc(doc(db, 'history', user.uid, 'scores', dateToDelete));
      setHistory(prev => prev.filter(({ date }) => date !== dateToDelete));

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const groupIds = userSnap.data()?.groups || [];
      for (const groupId of groupIds) {
        const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
        await setDoc(memberRef, {
          [`scores.${dateToDelete}`]: deleteField()
        }, { merge: true });
      }
    } catch (err) {
      console.error(`Failed to delete ${dateToDelete}:`, err);
    }
  }

  return (
    <div className="history-container">
      <h2>Score History</h2>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setFilter('7')}>Last 7 Days</button>{' '}
        <button onClick={() => setFilter('30')}>Last 30 Days</button>{' '}
        <button onClick={() => setFilter('all')}>All Time</button>
      </div>
      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map(({ date, score }) => (
              <tr key={date}>
                <td>{date}</td>
                <td>{score}</td>
                <td>
                  <button
                    onClick={() => deleteDay(date)}
                    className="delete-day-button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ecc71" />
              <stop offset="50%" stopColor="#f1c40f" />
              <stop offset="100%" stopColor="#e74c3c" />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="score"
            stroke="url(#scoreGradient)"
            strokeWidth={2}
            dot={{ r: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <button
        onClick={clearAllHistory}
        className="clear-history-button"
      >
        Clear All History
      </button>
    </div>
  );
}
