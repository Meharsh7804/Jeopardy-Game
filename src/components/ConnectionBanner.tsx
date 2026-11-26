import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { RefreshCw } from "lucide-react";

export const ConnectionBanner: React.FC = () => {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const infoRef = ref(db, ".info/connected");
      unsub = onValue(infoRef, (snap) => {
        setFirebaseConnected(snap.val() === true);
      });
    } catch {
      setFirebaseConnected(false);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const show = !online || !firebaseConnected;

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[110] h-12 w-full bg-[#FF3B1D] text-[#FFFFFF] border-b-2 border-[#111111] flex items-center justify-between gap-3 px-4 sm:px-6 font-mono text-[10px] sm:text-sm font-black tracking-wide uppercase"
    >
      <span className="min-w-0"> RECONNECTING TO GAME SERVER... YOUR BUZZ &amp; SCORE ARE SAFE.</span>
      <RefreshCw className="w-5 h-5 shrink-0 animate-spin" aria-label="Retrying connection" />
    </div>
  );
};

export default ConnectionBanner;