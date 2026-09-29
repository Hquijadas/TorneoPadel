import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJsVmlia9Pzm6RaFQ7IJXiQ5GC-mjJ6Ts",
  authDomain: "musete-f80fb.firebaseapp.com",
  projectId: "musete-f80fb",
  storageBucket: "musete-f80fb.firebasestorage.app",
  messagingSenderId: "649759210302",
  appId: "1:649759210302:web:6233b060bb8d903b928a6f",
  measurementId: "G-YVCN4R09HK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const CATEGORIAS = [
  'Masculino Oro',
  'Femenino Oro',
  'Masculino Plata',
  'Femenino Plata'
];
