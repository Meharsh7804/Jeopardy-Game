import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, TrendingUp, Flame, Target , Globe, Medal } from "lucide-react";
import { loadProfile, loadMatchHistory, loadSeasons, seasonKeyOf, levelInfo, xpOf } from "../utils/profile";
import { db, isFirebaseConfigValid } from "../firebase";
import { ref, onValue, set } from "firebase/database";

interface Props { open: boolean; onClose: () => void; myId: string; }

type LeaderRow = { id: string; name: string; elo: number; wins: number; games: number };

export const ProfileModal: React.FC<Props> = ({ open, onClose, myId }) => {
  const [tab, setTab] = useState<"profile" | "seasons" | "global">("profile");
  const [globalRows, setGlobalRows] = useState<LeaderRow[]>([]);
  const profile = loadProfile();
  const history = loadMatchHistory();
  const seasons = loadSeasons();
  const xp = xpOf(profile);
  const level = levelInfo(xp);
  const currentSeason = seasons[seasonKeyOf()] ?? { points: 0, games: 0, wins: 0 };

  useEffect(() => {
    if (!open) return;
    if (isFirebaseConfigValid()) {
      const payload = { id: myId, name: profile.name || "Player", elo: profile.elo ?? 1000, wins: profile.gamesWon, games: profile.gamesPlayed, updatedAt: Date.now() };
      set(ref(db, `leaderboard/${myId}`), payload).catch(() => {});
      const unsub = onValue(ref(db, "leaderboard"), (snap) => {
        const val = snap.val() || {};
        const rows = Object.values(val) as LeaderRow[];
        rows.sort((a,b) => (b.elo ?? 1000) - (a.elo ?? 1000) || (b.wins ?? 0) - (a.wins ?? 0));
        setGlobalRows(rows.slice(0, 20));
      }, () => setGlobalRows([]));
      return () => unsub();
    }
  }, [open, myId, profile.name, profile.elo, profile.gamesWon, profile.gamesPlayed]);

  const seasonEntries = useMemo(() => Object.entries(seasons).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 12), [seasons]);
  const maxSeasonPts = Math.max(1, ...seasonEntries.map(([,s]) => s.points));

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60 " onClick={onClose}>
          <motion.div initial={{ scale: 0.96, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-[#FFFFFF] rounded-none p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar border-2 border-[#111111] shadow-[6px_6px_0_#111111] space-y-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Career Profile</p>
                <h2 className="text-3xl font-display font-black text-[#111111]">{profile.name || "Player"}</h2>
              </div>
              <button onClick={onClose} className="p-2 bg-[#F4EFE6] border-2 border-[#111111] hover:bg-[#FFD60A] shadow-[2px_2px_0_#111111]"><X className="w-4 h-4 text-[#111111]"/></button>
            </div>

            <div className="flex gap-2">
              {(["profile","seasons","global"] as const).map(t => (
                <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-none text-sm font-bold border-2 ${tab===t?"bg-[#FF3B1D] border-[#111111] text-white":"bg-[#F4EFE6] border-2 border-[#111111]/15 text-[#111111]"}`}>{t==="profile"?"Profile":t==="seasons"?"Seasons":"Global"}</button>
              ))}
            </div>

            {tab === "profile" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat icon={<Trophy className="w-4 h-4 text-warning-accent"/>} label="ELO" value={String(profile.elo ?? 1000)} />
                  <Stat icon={<TrendingUp className="w-4 h-4 text-success-accent"/>} label="Level" value={`Lv ${level.level}`} sub={`${xp} XP`} />
                  <Stat icon={<Target className="w-4 h-4 text-primary-accent"/>} label="Games" value={`${profile.gamesWon}/${profile.gamesPlayed}`} sub="Wins/Played" />
                  <Stat icon={<Flame className="w-4 h-4 text-orange-400"/>} label="Best Streak" value={String(profile.bestStreak)} />
                </div>
                <div className="bg-[#FFFFFF] rounded-none p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Recent Matches</p>
                  <div className="space-y-2">
                    {history.length === 0 ? <p className="text-sm text-text-muted">No matches yet.</p> : history.slice(0,8).map((m,i)=>(
                      <div key={i} className="flex items-center justify-between bg-[#F4EFE6] border border-[#111111]/10 px-3 py-2 text-sm">
                        <span className="text-text-muted">{new Date(m.date).toLocaleDateString()}</span>
                        <span className={m.won ? "text-success-accent font-bold" : "text-text-main font-bold"}>{m.won ? "Win" : `#${m.rank}`}</span>
                        <span className="text-[#111111] font-bold">${m.myScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "seasons" && (
              <div className="space-y-4">
                <div className="bg-[#FFFFFF] rounded-none p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Current Season ({seasonKeyOf()})</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="font-display font-black text-2xl text-[#111111]">{currentSeason.points}</p><p className="text-[10px] text-text-muted uppercase">Points</p></div>
                    <div><p className="font-display font-black text-2xl text-[#111111]">{currentSeason.games}</p><p className="text-[10px] text-text-muted uppercase">Games</p></div>
                    <div><p className="font-display font-black text-2xl text-warning-accent">{currentSeason.wins}</p><p className="text-[10px] text-text-muted uppercase">Wins</p></div>
                  </div>
                </div>
                <div className="bg-[#FFFFFF] rounded-none p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-3">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Season History</p>
                  {seasonEntries.map(([k,s]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs text-text-muted mb-1"><span>{k}</span><span>{s.points} pts · {s.wins}W/{s.games}G</span></div>
                      <div className="h-2 bg-[#E5DEC9] border border-[#111111] overflow-hidden"><div className="h-full bg-primary-accent rounded-full" style={{width:`${(s.points/maxSeasonPts)*100}%`}}/></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "global" && (
              <div className="bg-[#FFFFFF] rounded-none p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-2">
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2"><Globe className="w-3.5 h-3.5"/> Global Leaderboard (best-effort)</p>
                {globalRows.length === 0 ? <p className="text-sm text-text-muted">No leaderboard data yet.</p> : globalRows.map((r, i) => (
                  <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-xl ${r.id===myId?"bg-primary-accent/15 border border-primary-accent/30":"bg-[#F4EFE6]"}`}>
                    <div className="flex items-center gap-3"><span className="w-6 text-xs font-bold text-text-muted">#{i+1}</span><span className="font-bold text-[#111111]">{r.name}</span>{i===0 && <Medal className="w-4 h-4 text-warning-accent"/>}</div>
                    <div className="flex items-center gap-4 text-sm"><span className="text-success-accent font-bold">{r.elo ?? 1000} ELO</span><span className="text-text-muted">{r.wins}/{r.games}</span></div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Stat: React.FC<{icon:React.ReactNode; label:string; value:string; sub?:string}> = ({icon,label,value,sub}) => (
  <div className="bg-[#FFFFFF] rounded-none p-3 border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
    <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{icon}{label}</div>
    <div className="font-display font-black text-xl text-[#111111]">{value}</div>
    {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
  </div>
);