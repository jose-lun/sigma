// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD7tKqlYgcPg3cADhw4TQMePr6GGdozEJk",
  authDomain: "sigma-bc106.firebaseapp.com",
  projectId: "sigma-bc106",
  storageBucket: "sigma-bc106.firebasestorage.app",
  messagingSenderId: "474546819507",
  appId: "1:474546819507:web:ab75f35220ffb337043bc6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
