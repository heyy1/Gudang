
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// SILAHKAN ISI DENGAN KONFIGURASI FIREBASE ANDA
const firebaseConfig = {
  apiKey: "AIzaSyDn0j1V23-z6h7tXRtk1_lejGrdlSIqP3M",
  authDomain: "gudang-saya-c388c.firebaseapp.com",
  projectId: "gudang-saya-c388c",
  storageBucket: "gudang-saya-c388c.firebasestorage.app",
  messagingSenderId: "759654206138",
  appId: "1:759654206138:web:df29b2488bfe41718b9083",
  measurementId: "G-GVBKEBPN97"
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
