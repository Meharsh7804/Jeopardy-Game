const { initializeApp } = require("firebase/app");
const { getDatabase, ref, onValue } = require("firebase/database");
const config = {
  apiKey: "AIzaSyA0Af35qyxugsaWukeDU8LVLJWcTBmHDKE",
  authDomain: "buzzingwithquizzing.firebaseapp.com",
  projectId: "buzzingwithquizzing",
  storageBucket: "buzzingwithquizzing.firebasestorage.app",
  messagingSenderId: "804798421646",
  appId: "1:804798421646:web:86a131d76f782dceca87df",
  databaseURL: "https://buzzingwithquizzing-default-rtdb.firebaseio.com",
};
const app = initializeApp(config);
const db = getDatabase(app);
let gotValue = false;
onValue(ref(db, ".info/connected"), (s) => console.log("INFO/CONNECTED:", s.val()), (e)=>console.error("INFO ERR", e.code, e.message));
onValue(ref(db, "quizLibrary"), (snap) => {
  gotValue = true;
  const keys = Object.keys(snap.val() || {});
  console.log("ONVALUE SUCCESS: quizzes count =", keys.length);
  process.exit(0);
}, (err) => {
  console.error("ONVALUE ERROR:", err.code, "|", err.message);
  process.exit(2);
});
setTimeout(() => {
  console.log("TIMEOUT after 20s. gotValue =", gotValue);
  process.exit(gotValue?0:2);
}, 20000);
