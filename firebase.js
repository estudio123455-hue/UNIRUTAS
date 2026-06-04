import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRXp_TSE4trf7HNP5dA6QjQp3o0LgD3bY",
  authDomain: "unirutas-1724e.firebaseapp.com",
  projectId: "unirutas-1724e",
  storageBucket: "unirutas-1724e.firebasestorage.app",
  messagingSenderId: "949060149395",
  appId: "1:949060149395:web:994e170ead7e1b8bd42d66"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged };