import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, onValue } from "firebase/database";
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

async function tryGet(path, label) {
  const start = Date.now();
  try {
    const snap = await get(ref(db, path), { timeout: 15000 });
    console.log(`GET ${label}: OK, exists=${snap.exists()}, size=${JSON.stringify(snap.val()).length}, ms=${Date.now()-start}`);
  } catch (e) {
    console.log(`GET ${label}: ERROR ${e.code} | ${e.message} | ms=${Date.now()-start}`);
  }
}

await tryGet("quizLibrary/quiz-xbumei2", "single quiz");
await tryGet("quizLibrary", "FULL library");

// listener on small read
let done=false;
onValue(ref(db, "quizLibrary/quiz-xbumei2"), (s)=>{ if(!done){done=true; console.log("LISTENER single quiz: exists=",s.exists(),"ms=",Date.now()-startX);} }, (e)=>console.error("LISTENER single ERR", e.code, e.message));
const startX = Date.now();
setTimeout(async ()=>{
  console.log("---------------- done primary checks");
  process.exit(0);
}, 15000);
