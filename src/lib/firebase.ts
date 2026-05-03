import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkWZFKpLXYs-_4AGIDmBiSivKq_m5XN-k",
  authDomain: "inventory-stok-1aceb.firebaseapp.com",
  projectId: "inventory-stok-1aceb",
  storageBucket: "inventory-stok-1aceb.firebasestorage.app",
  messagingSenderId: "84583417257",
  appId: "1:84583417257:web:a515f08d672266344eb0b8",
  measurementId: "G-X5CSM3GGYP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };