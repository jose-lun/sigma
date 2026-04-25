import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  collectionGroup,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase'; // adjust path as needed

export default function Survey({ user }) {
  const [rubric, setRubric] = useState([]);
  const [formData, setFormData] = useState({});
  const [score, setScore] = useState(0);

  const [date, setDate] = useState(() => {
    const now = new Date();
    const localHour = now.getHours();

    // If it's before 4am, treat it as "yesterday"
    if (localHour < 4) {
      now.setDate(now.getDate() - 1);
    }

    now.setHours(0, 0, 0, 0);
    return now.toISOString().split('T')[0];
  });


  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const loadRubric = async () => {
      try {
        const docRef = doc(db, 'rubrics', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRubric(docSnap.data().rubric || []);
        }
      } catch (err) {
        console.error('Failed to load rubric from Firestore:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRubric();
  }, [user]);

  useEffect(() => {
    if (rubric.length === 0) return;

    let total = 0;
    for (const item of rubric) {
      const val = formData[item.id];
      if (item.type === 'checklist') {
        if (val) total += item.points;
      } else if (item.type === 'numeric' && val !== undefined) {
        const input = parseFloat(val) || 0;
        const ratio = input / item.target;
        total += ratio * item.points;
      }
    }

    setScore(Math.round(total));
  }, [formData, rubric]);

  if (loading) return <p>Loading survey...</p>;
  if (rubric.length === 0) return <p>No rubric found. Go to the Rubric page to create one.</p>;

  const sigmas = rubric.filter(r => r.type === 'checklist' && r.polarity === 'sigma');
  const ligmas = rubric.filter(r => r.type === 'checklist' && r.polarity === 'ligma');
  const numerics = rubric.filter(r => r.type === 'numeric');

  const toggleChecklist = (id) => {
    setFormData((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateNumeric = (id, value) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    const key = 'surveyScores';
    const saved = JSON.parse(localStorage.getItem(key)) || {};

    const existing = saved[date];
    const newEntry = { score, data: formData };

    const hasChanged = JSON.stringify(existing?.data) !== JSON.stringify(newEntry.data);

    if (!existing || hasChanged) {
      saved[date] = newEntry;
      localStorage.setItem(key, JSON.stringify(saved));

      try {
        setSaveStatus('saving');
        const docRef = doc(db, 'history', user.uid, 'scores', date);
        const cleanedFormData = Object.fromEntries(
          Object.entries(formData).filter(([_, val]) => val !== undefined)
        );
        await setDoc(docRef, {
          score,
          data: cleanedFormData,
          submittedAt: new Date().toISOString()
        });

        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const groupIds = userSnap.data()?.groups || [];

          for (const gid of groupIds) {
            await setDoc(doc(db, 'groups', gid, 'members', user.uid), {
              [`scores.${date}`]: score
            }, { merge: true });
          }
        } catch (err) {
          console.error('Failed to save score to group member docs:', err);
        }

        setSubmitted(true);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save to Firestore:', err);
        setSaveStatus('error');
      }
    } else {
      setSaveStatus('unchanged');
    }

    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  let scoreColor = 'limegreen';
  if (score < 30) scoreColor = 'red';
  else if (score < 60) scoreColor = 'gold';

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: 'auto' }}>
      <h2>Daily Survey</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Select date:{' '}
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ fontSize: '1rem', padding: '4px' }}
          />
        </label>
      </div>

      {sigmas.length > 0 && (
        <div>
          <h3>Which delta activities did you do today?</h3>
          {sigmas.map(item => (
            <label key={item.id} style={{ display: 'block', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={!!formData[item.id]}
                onChange={() => toggleChecklist(item.id)}
              />{' '}
              {item.name}
              <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.9rem' }}>
                ({item.points} pts)
              </span>
            </label>
          ))}
        </div>
      )}

      {ligmas.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Which nabla activities did you do today?</h3>
          {ligmas.map(item => (
            <label key={item.id} style={{ display: 'block', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={!!formData[item.id]}
                onChange={() => toggleChecklist(item.id)}
              />{' '}
              {item.name}
              <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.9rem' }}>
                ({item.points} pts)
              </span>
            </label>
          ))}
        </div>
      )}

      {numerics.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Numeric entries</h3>
          {numerics.map(item => (
            <label key={item.id} style={{ display: 'block', marginBottom: '1rem' }}>
              {item.name} (Target: {item.target})
              <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.9rem' }}>
                ({item.points} pts)
              </span>
              <input
                type="number"
                value={formData[item.id] || ''}
                onChange={e => updateNumeric(item.id, Number(e.target.value))}
                style={{ marginLeft: '10px', width: '80px' }}
              />
            </label>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: '2rem' }}>
        Your score: <span style={{ color: scoreColor }}>{score}</span>
      </h3>

      <button
        onClick={handleSubmit}
        style={{
          marginTop: '2rem',
          padding: '10px 20px',
          fontSize: '1rem',
          fontWeight: 'bold',
          backgroundColor: saveStatus === 'saved' ? 'limegreen' :
            saveStatus === 'unchanged' ? '#555' : '#222',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
      >
        {saveStatus === 'saved'
          ? '✅ Saved!'
          : saveStatus === 'unchanged'
            ? 'No Changes'
            : 'Submit'}
      </button>
    </div>
  );
}
