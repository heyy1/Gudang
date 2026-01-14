
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// SILAHKAN ISI DENGAN KONFIGURASI FIREBASE ANDA
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db: any;

try {
  // Cek jika user sudah mengganti dummy text
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } else {
    console.warn("Firebase belum dikonfigurasi. Aplikasi berjalan dalam mode demo (Local Storage).");
    db = null; 
  }
} catch (e) {
  console.error("Firebase initialization error:", e);
  db = null;
}

export { db };
