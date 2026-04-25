// Auth.jsx
import { useState } from 'react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import './Auth.css';

export default function Auth({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState(null);

  const provider = new GoogleAuthProvider();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const userCredential = isSignup
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      onAuth(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      onAuth(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <h1>The Sigma Factor</h1>
        <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="primary-button">
            {isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>
  
        <div className="divider">or</div>
  
        <button onClick={handleGoogleLogin} className="google-button">
          Sign in with Google
        </button>
  
        <p className="switch-text">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsSignup(!isSignup)} className="link-button">
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
  
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );  
}
