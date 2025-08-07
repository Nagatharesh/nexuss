import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAWadabbhltuGhlhRGjO9Vrk-HAXWtdsr8",
  authDomain: "safestep-68581.firebaseapp.com",
  databaseURL: "https://safestep-68581-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "safestep-68581",
  storageBucket: "safestep-68581.appspot.com",
  messagingSenderId: "946843733821",
  appId: "1:946843733821:web:520f84b3f4f0b1996dff54"
};

let app = null;
let database = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Don't throw error to prevent app crash, use fallback
  console.warn("Firebase unavailable, app will run in offline mode");
}

// Ensure exports are always defined to prevent import errors
export { database, auth };
export default app;