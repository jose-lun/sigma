import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Groups({ user }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchGroups() {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const groupIds = userSnap.data()?.groups || [];

        const groupNames = await Promise.all(
          groupIds.map(async (id) => {
            const groupSnap = await getDoc(doc(db, 'groups', id));
            const name = groupSnap.exists() ? groupSnap.data().name : id;
            return { id, name };
          })
        );

        setGroups(groupNames);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGroups();
  }, [user]);

  const handleSelectGroup = (groupId) => {
    navigate(`/leaderboard/${groupId}`);
  };

  if (loading) return <p>Loading your groups...</p>;

  if (groups.length === 0) return <p>You are not part of any groups yet.</p>;

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
      <h2>Your Groups</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {groups.map(group => (
          <li
            key={group.id}
            style={{
              padding: '10px',
              backgroundColor: '#222',
              borderRadius: '6px',
              marginBottom: '10px',
              cursor: 'pointer'
            }}
            onClick={() => handleSelectGroup(group.id)}
          >
            {group.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
