import { useState } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { arrayUnion } from 'firebase/firestore';

export default function JoinGroup({ user, onJoin }) {
  const [groupCode, setGroupCode] = useState('');
  const [status, setStatus] = useState('idle');

  const handleJoin = async () => {
    if (!groupCode.trim()) return;

    setStatus('joining');
    try {
      const groupRef = doc(db, 'groups', groupCode);

      // Check if group already exists
      const existingGroup = await getDoc(groupRef);

      if (!existingGroup.exists()) {
        // If new group, set name and createdAt timestamp
        await setDoc(groupRef, {
          name: groupCode,
          createdAt: serverTimestamp() // ✅ add timestamp here
        });
      }

      // Add user to group members
      await setDoc(doc(db, 'groups', groupCode, 'members', user.uid), {
        displayName: user.displayName || user.email || 'Anonymous',
        photoURL: user.photoURL || '',
      }, { merge: true });

      // Add group to user record
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: user.displayName || user.email || 'Anonymous',
        groups: arrayUnion(groupCode),
      }, { merge: true });

      setStatus('joined');
      localStorage.setItem('groupId', groupCode);
      onJoin(groupCode);
    } catch (err) {
      console.error('Failed to join group:', err);
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Join or Create a Group</h2>
      <input
        value={groupCode}
        onChange={(e) => setGroupCode(e.target.value)}
        placeholder="Enter group code"
        style={{ fontSize: '1rem', padding: '6px', marginRight: '1rem' }}
      />
      <button onClick={handleJoin}>Join Group</button>

      {status === 'joined' && <p style={{ color: 'green' }}>Successfully joined!</p>}
      {status === 'error' && <p style={{ color: 'red' }}>Failed to join. Try again.</p>}
    </div>
  );
}
