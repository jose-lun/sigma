import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';
import Rubric from './pages/Rubric.jsx';
import Survey from './pages/Survey.jsx';
import History from './pages/History.jsx';
import Auth from './pages/Auth.jsx';
import JoinGroup from './pages/JoinGroup.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

function PrivateRoute({ user, children }) {
  return user ? children : <Navigate to="/login" />;
}

function App() {
  const [user, setUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data() || {};
        const groupIds = userSnap.data()?.groups || [];

        setUserGroups(groupIds);

        for (const groupId of groupIds) {
          try {
            const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
            await setDoc(memberRef, {
              displayName: userData.displayName || user.displayName || '',
              photoURL: userData.photoURL || user.photoURL || '',
              uid: user.uid
            }, { merge: true });
          } catch (err) {
            console.error('Failed to sync member for group', groupId, err);
          }
        }
      }
    });
  }, []);

  return (
    <div>
      {user && (
        <nav style={{ position: 'relative', zIndex: 1000 }}>
          <Link to="/profile">Profile</Link>
          <Link to="/rubric">Rubric</Link>
          <Link to="/survey">Survey</Link>
          <Link to="/history">History</Link>
          <Link to="/group">Join Group</Link>

          <div className="nav-dropdown" style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)}>
              Group Leaderboards ▼
            </button>
            {dropdownOpen && (
              <ul
                className="nav-dropdown-list"
                style={{
                  position: 'absolute',
                  background: '#222',
                  listStyle: 'none',
                  padding: '0.5rem',
                  margin: 0,
                  border: '1px solid #444',
                  borderRadius: '6px',
                  top: '100%',
                  left: 0,
                  zIndex: 1001,
                  minWidth: '150px'
                }}
              >
                {userGroups.map(gid => (
                  <li key={gid}>
                    <Link
                      to={`/leaderboard/${gid}`}
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        color: 'white',
                        display: 'block',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      {gid}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={() => signOut(auth)}>Log Out</button>
        </nav>
      )}

      <div className="page-wrapper">
        <Routes>
          <Route path="/" element={
            user ? <Navigate to="/rubric" /> : <Navigate to="/login" />
          } />
          <Route path="/profile" element={
            <PrivateRoute user={user}>
              <Profile user={user} />
            </PrivateRoute>
          } />
          <Route path="/leaderboard/:groupId" element={
            <PrivateRoute user={user}>
              <Leaderboard user={user} />
            </PrivateRoute>
          } />
          <Route path="/login" element={
            user ? <Navigate to="/profile" /> : <Auth onAuth={setUser} />
          } />
          <Route path="/rubric" element={
            <PrivateRoute user={user}>
              <Rubric user={user} />
            </PrivateRoute>
          } />
          <Route path="/survey" element={
            <PrivateRoute user={user}>
              <Survey user={user} />
            </PrivateRoute>
          } />
          <Route path="/history" element={
            <PrivateRoute user={user}>
              <History user={user} />
            </PrivateRoute>
          } />
          <Route path="/group" element={
            <PrivateRoute user={user}>
              <JoinGroup
                user={user}
                onJoin={async (groupId) => {
                  const userRef = doc(db, 'users', user.uid);
                  const userSnap = await getDoc(userRef);
                  const groupIds = userSnap.data()?.groups || [];
                  setUserGroups(groupIds); // refresh the dropdown
                }}
              />
            </PrivateRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}

function NotFound() {
  return <h2>Page not found</h2>;
}

export default App;
