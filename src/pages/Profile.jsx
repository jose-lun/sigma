import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase'; // assuming you’ve initialized Firebase Storage
import { updateProfile } from 'firebase/auth';
import './Profile.css';

export default function Profile({ user }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [memberSince, setMemberSince] = useState('');
  const [uploading, setUploading] = useState(false);
  const [historyStats, setHistoryStats] = useState({
    daysTracked: 0,
    totalPoints: 0,
    longestStreak: 0
  });
  const [saveMessage, setSaveMessage] = useState('');


  useEffect(() => {
    const loadHistoryStats = async () => {
      const scoresRef = collection(db, 'history', user.uid, 'scores');
      const snapshot = await getDocs(scoresRef);
      const entries = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.score !== undefined) {
          entries.push({
            date: doc.id,
            score: data.score
          });
        }
      });
  
      const sorted = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      let daysTracked = sorted.length;
      let totalPoints = sorted.reduce((sum, entry) => sum + entry.score, 0);
  
      // Compute longest streak
      let longestStreak = 0;
      let currentStreak = 0;
      let lastDate = null;
  
      for (let entry of sorted) {
        const currentDate = new Date(entry.date);
        if (lastDate) {
          const diff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);
          if (diff === 1) {
            currentStreak += 1;
          } else if (diff === 0) {
            continue; // same day, skip
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
  
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
  
        lastDate = currentDate;
      }
  
      setHistoryStats({ daysTracked, totalPoints, longestStreak });
    };
  
    loadHistoryStats();
  }, [user]);

  useEffect(() => {
    // Get creation time from Firebase Auth
    const creation = user.metadata?.creationTime;
    if (creation) {
      setMemberSince(new Date(creation).toLocaleDateString());
    }

    // Optionally pull a custom display name or photo from Firestore
    const loadProfile = async () => {
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.displayName) setDisplayName(data.displayName);
        if (data.photoURL) setPhotoURL(data.photoURL);
      }
    };

    loadProfile();
  }, [user]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const storageRef = ref(storage, `avatars/${user.uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    setPhotoURL(url);
    await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
    setUploading(false);
  };

  const handleNameSave = async () => {
    try {
      // 1. Update Firebase Auth profile
      await updateProfile(auth.currentUser, { displayName });
  
      // 2. Update users collection
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { displayName }, { merge: true });
  
      // 3. Get user's group memberships
      const userSnap = await getDoc(userRef);
      const groupIds = userSnap.data()?.groups || [];
  
      // 4. Update name in each group member document
      for (const groupId of groupIds) {
        const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
        await setDoc(memberRef, {
          displayName,
          photoURL: photoURL || '',  // use current state value
          uid: user.uid
        }, { merge: true });
      }
  
      setSaveMessage('✅ Display name updated!');
      setTimeout(() => setSaveMessage(''), 3000); // clear after 3 seconds
    } catch (err) {
      console.error('Failed to update display name:', err);
      setSaveMessage('⚠️ Failed to update. Try again.');
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };
  
  return (
    <div className="profile-container">
      <div className="profile-box">
        <h2>{displayName}</h2>
        <div className="profile-pic-wrapper">
          <label htmlFor="upload">
            <img src={photoURL || '/default-avatar.png'} className="profile-pic" alt="Avatar" />
          </label>
          <input
            type="file"
            id="upload"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div className="profile-fields">
          <label>
            Display Name:
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button onClick={handleNameSave}>Update</button>
            {saveMessage && <p className="save-message">{saveMessage}</p>}
          </label>
          <p className="member-since">Member since: {memberSince}</p>
        </div>
        <div className="profile-stats">
          <h3>Your Stats</h3>
          <div className="stat-circle-row">
            <div className="stat-wrapper">
              <div className="stat-circle">
                <div className="stat-number">{historyStats.daysTracked}</div>
              </div>
              <div className="stat-label">Days Tracked</div>
            </div>

            <div className="stat-wrapper">
              <div className="stat-circle">
                <div className="stat-number">{historyStats.totalPoints}</div>
              </div>
              <div className="stat-label">Total Points</div>
            </div>

            <div className="stat-wrapper">
              <div className="stat-circle">
                <div className="stat-number">{historyStats.longestStreak}</div>
              </div>
              <div className="stat-label">Longest Streak</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
