import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trophy, TrendingUp, Globe, Star } from "lucide-react";
import {
  achievementHint,
  achievementKey,
  achievementProgress,
  loadProfile,
  loadMatchHistory,
  loadSeasons,
  seasonKeyOf,
  levelInfo,
  xpOf,
  ACHIEVEMENT_IDS,
  type AchievementId,
} from "../utils/profile";
import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";
import { db, isFirebaseConfigValid } from "../firebase";
import { ref, onValue, set } from "firebase/database";
import { useRoom } from "../context/RoomContext";
import { useSettings } from "../context/SettingsContext";

interface Props { onBack: () => void; }
type LeaderRow = { id: string; name: string; elo: number; wins: number; games: number; updatedAt?: number };
type AchievementFilter = "all" | "unlocked" | "locked";
const PROGRESS_ACHIEVEMENTS = new Set<AchievementId>([
  "onFire",
  "sharpshooter",
  "regular",
  "lightning",
  "highRoller",
  "collector",
  "theProfessor",
  "speedDemon",
]);
const ACHIEVEMENT_HINT_OVERRIDES: Partial<Record<AchievementId, string>> = {
  buttonMasher: "Tap the buzzer at least 5 times within 3 seconds.",
  eggHunter: "Join or create a room whose code contains a hidden word such as CAT, DOG, EGG, or WIN.",
  buzzWhisperer: "Buzz first within 120 milliseconds of a question opening.",
  riskTaker: "Correctly answer a high-value tile worth at least 400 points.",
};

export const ProfilePage: React.FC<Props> = ({ onBack }) => {
  const { myId } = useRoom();
  const { t } = useSettings();
  const profile = loadProfile();
  const history = loadMatchHistory();
  const seasons = loadSeasons();
  const xp = xpOf(profile);
  const level = levelInfo(xp);
  const [globalRows, setGlobalRows] = useState<LeaderRow[]>([]);
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("all");
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementId>("firstWin");

  useEffect(() => {
    if (!isFirebaseConfigValid()) return;
    const payload = { id: myId, name: profile.name || "Player", elo: profile.elo ?? 1000, wins: profile.gamesWon, games: profile.gamesPlayed, updatedAt: Date.now() };
    set(ref(db, `leaderboard/${myId}`), payload).catch(() => {});
    const unsub = onValue(ref(db, "leaderboard"), (snap) => {
      const val = snap.val() || {};
      const rows = Object.entries(val).flatMap(([key, value]) => {
        if (!value || typeof value !== "object") return [];
        const row = value as LeaderRow;
        return [{ ...row, id: row.id || key }];
      });
      const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
      uniqueRows.sort((a, b) => (b.elo ?? 1000) - (a.elo ?? 1000) || (b.wins ?? 0) - (a.wins ?? 0));
      setGlobalRows(uniqueRows.slice(0, 25));
    }, () => setGlobalRows([]));
    return () => unsub();
  }, [myId, profile.name, profile.elo, profile.gamesWon, profile.gamesPlayed]);

  const seasonEntries = useMemo(() => Object.entries(seasons).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8), [seasons]);
  const maxPts = Math.max(1, ...seasonEntries.map(([, s]) => s.points));
  const currentSeason = seasons[seasonKeyOf()] ?? { points: 0, games: 0, wins: 0 };
  const unlocked = ACHIEVEMENT_IDS.filter((id) => profile.achievements[id]);
  const achievementCounts = achievementProgress(profile);
  const winRate = profile.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const avatar = getAvatarByIdOrSeed(profile.avatar, myId || profile.name || "player");
  const unlockHintFor = (id: AchievementId) => {
    const explicitHint = ACHIEVEMENT_HINT_OVERRIDES[id];
    if (explicitHint) return explicitHint;
    const hint = achievementHint(id, profile);
    const translatedHint = t(hint.key, hint.params);
    return translatedHint === hint.key ? t(`${achievementKey(id)}Desc`) : translatedHint;
  };
  const visibleAchievements = ACHIEVEMENT_IDS.filter((id) => (
    achievementFilter === "all" ||
    (achievementFilter === "unlocked" ? Boolean(profile.achievements[id]) : !profile.achievements[id])
  ));
  const selectedId = visibleAchievements.includes(selectedAchievement)
    ? selectedAchievement
    : visibleAchievements[0] ?? ACHIEVEMENT_IDS[0];
  const selectedHintText = unlockHintFor(selectedId);

  return (
    <div
      className="min-h-screen bg-[#F4EFE6] text-[#111111]"
      style={{
        backgroundImage: "linear-gradient(rgba(17,17,17,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.05) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <header className="h-14 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-3 bg-[#FFD60A] hover:bg-[#111111] text-[#111111] hover:text-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs font-black flex items-center gap-1.5 uppercase rounded-none shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> BACK
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-[#111111] text-[#FFD60A] px-3 py-1 font-mono text-[11px] font-bold tracking-wider uppercase">
            <span className="text-[#FF3B1D]">●</span> CONTESTANT DOSSIER // CAREER ARCHIVE
          </div>
        </div>
        <h1 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-lg sm:text-xl text-[#111111] uppercase tracking-tight shrink-0">
          PLAYER PROFILE
        </h1>
      </header>

      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[6px_6px_0px_#111111] p-4 sm:p-5 rounded-none">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {avatar ? (
                <img
                  src={avatar.src}
                  alt={`${profile.name || "Player"} avatar`}
                  style={{ objectPosition: avatar.position }}
                  className="w-14 h-14 sm:w-16 sm:h-16 border-[3px] border-[#111111] bg-[#FFD60A] shrink-0 object-cover"
                />
              ) : (
                <span className="w-14 h-14 sm:w-16 sm:h-16 border-[3px] border-[#111111] bg-[#FFD60A] shrink-0 flex items-center justify-center font-['Archivo_Black'] text-2xl">
                  {(profile.name || "P").trim().charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <span className="bg-[#111111] text-[#FFD60A] px-2 py-0.5 font-mono text-[10px] font-bold uppercase inline-block">
                  PLAYER CALLSIGN
                </span>
                <h2 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-2xl sm:text-3xl text-[#111111] uppercase leading-none mt-1 truncate">
                  {profile.name || "Player"}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 font-mono text-[11px] font-bold">
                  <span className="bg-[#FFD60A] border border-[#111111] px-2 py-0.5">👑 LV {level.level}</span>
                  <span className="bg-[#F4EFE6] border border-[#111111] px-2 py-0.5">⚡ {xp} XP</span>
                  <span className="bg-[#F4EFE6] border border-[#111111] px-2 py-0.5">🏆 {profile.elo ?? 1000} ELO</span>
                  <span className="bg-[#F4EFE6] border border-[#111111] px-2 py-0.5">🎯 {winRate}% WIN RATE</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-[#F4EFE6] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] px-3 py-2 text-center min-w-[76px]">
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-xl text-[#111111]">{profile.gamesPlayed}</div>
                <div className="font-mono text-[10px] font-bold uppercase">GAMES</div>
              </div>
              <div className="bg-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] px-3 py-2 text-center min-w-[76px]">
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-xl text-[#FFD60A]">{profile.gamesWon}</div>
                <div className="font-mono text-[10px] font-bold uppercase text-[#FFFFFF]">WINS</div>
              </div>
              <div className="bg-[#F4EFE6] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] px-3 py-2 text-center min-w-[76px]">
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-xl text-[#00C271]">{profile.totalCorrect}</div>
                <div className="font-mono text-[10px] font-bold uppercase">CORRECT</div>
              </div>
              <div className="bg-[#F4EFE6] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] px-3 py-2 text-center min-w-[76px]">
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-xl text-[#FF3B1D]">{profile.bestStreak}</div>
                <div className="font-mono text-[10px] font-bold uppercase">BEST STREAK</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-[#111111]">
            <div className="flex items-center justify-between font-mono text-xs font-bold mb-1.5">
              <span>LEVEL {level.level} PROGRESS</span>
              <span>{level.into} / {level.need} XP</span>
            </div>
            <div className="w-full h-4 bg-[#E6E0D4] border-2 border-[#111111] overflow-hidden">
              <div
                className="h-full bg-[#00C271] border-r-2 border-[#111111]"
                style={{ width: `${Math.min(100, (level.into / Math.max(1, level.need)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 flex flex-col gap-5">
          <section className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
            <header className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between font-mono text-xs font-bold">
              <span className="text-[#FFD60A] flex items-center gap-2"><Globe className="w-4 h-4" /> SEASON &amp; GLOBAL STANDINGS</span>
              <span className="text-[#00C271]">SEASON {seasonKeyOf()}</span>
            </header>
            <div className="grid grid-cols-3 border-b-2 border-[#111111] bg-[#F4EFE6] divide-x-2 divide-[#111111] text-center py-2.5">
              <div className="px-1">
                <div className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">CURRENT SEASON</div>
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm">{seasonKeyOf()}</div>
              </div>
              <div className="px-1">
                <div className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">SEASON PTS</div>
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm">{currentSeason.points}</div>
              </div>
              <div className="px-1">
                <div className="font-mono text-[9px] sm:text-[10px] font-bold uppercase">SEASON WINS</div>
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm">{currentSeason.wins}</div>
              </div>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="font-mono text-[10px] font-black uppercase tracking-wide mb-2">SEASON POINTS HISTORY</div>
              {seasonEntries.length === 0 ? (
                <p className="font-mono text-xs text-[#111111]/70 py-2">No season data yet.</p>
              ) : (
                <div className="divide-y divide-[#111111]/30">
                  {seasonEntries.map(([season, stats]) => (
                    <div key={season} className="py-1.5">
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold">
                        <span>{season}</span>
                        <span>{stats.points} PTS • {stats.wins}/{stats.games} WINS</span>
                      </div>
                      <div className="mt-1 h-2 bg-[#E6E0D4] border border-[#111111] overflow-hidden">
                        <div className="h-full bg-[#00C271]" style={{ width: `${Math.max(0, Math.min(100, (stats.points / maxPts) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#111111] text-[#FFD60A] px-4 py-2 font-mono text-[11px] font-black uppercase">GLOBAL LEADERBOARD</div>
            <div className="max-h-[280px] overflow-y-auto divide-y-2 divide-[#111111]">
              {globalRows.length === 0 ? (
                <p className="px-4 py-3 font-mono text-xs text-[#111111]/70 bg-[#FFFFFF]">No global data yet. Finish a game to appear.</p>
              ) : globalRows.map((row, index) => {
                const rankColor = index === 0
                  ? "bg-[#FFD60A]"
                  : index === 1
                    ? "bg-[#E6E0D4]"
                    : index === 2
                      ? "bg-[#F4EFE6]"
                      : "bg-[#FFFFFF]";
                return (
                  <div key={row.id} className={`px-4 py-2 flex items-center justify-between gap-2 ${row.id === myId ? "bg-[#FFD60A]/30" : "bg-[#FFFFFF]"}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-7 h-7 flex items-center justify-center border-2 border-[#111111] font-mono text-xs font-black shrink-0 ${rankColor}`}>
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-['Archivo_Black'] text-xs uppercase text-[#111111] truncate">{row.name || "Player"}</div>
                        <div className="font-mono text-[10px] text-[#111111]/75">{row.wins ?? 0}/{row.games ?? 0} WINS</div>
                      </div>
                    </div>
                    <span className="bg-[#00C271] border border-[#111111] px-2 py-0.5 font-mono text-[11px] font-black shrink-0">
                      {row.elo ?? 1000} ELO
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
            <header className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between font-mono text-xs font-bold">
              <span className="text-[#00C271] flex items-center gap-2"><TrendingUp className="w-4 h-4" /> RECENT BROADCAST MATCHES</span>
              <span className="text-[#FFD60A]">MATCH HISTORY</span>
            </header>
            <div className="divide-y-2 divide-[#111111]">
              {history.length === 0 ? (
                <p className="px-4 py-4 font-mono text-xs text-[#111111]/70">Play a game to build your history.</p>
              ) : history.slice(0, 10).map((match, index) => {
                const date = new Date(match.date);
                return (
                  <div key={`${match.date}-${index}`} className="px-4 py-3 flex items-center justify-between gap-3 bg-[#FFFFFF] hover:bg-[#F4EFE6]">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#111111]">
                        {date.toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "numeric" })}
                        {" • "}
                        {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="font-mono text-[11px] text-[#111111]/75">
                        ✓ {match.correct} CORRECT • ✕ {match.wrong} WRONG
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="bg-[#111111] text-[#FFD60A] px-2 py-0.5 font-mono text-xs font-black">#{match.rank}</span>
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm text-[#00C271]">${match.myScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="lg:col-span-7 bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] flex flex-col overflow-hidden">
          <header className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between gap-2">
            <h2 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm text-[#FFD60A] uppercase flex items-center gap-2">
              <Star className="w-4 h-4" /> ACHIEVEMENTS &amp; UNLOCK HINTS
            </h2>
            <span className="bg-[#00C271] text-[#111111] px-2.5 py-0.5 font-mono text-xs font-black shrink-0">
              {unlocked.length} / {ACHIEVEMENT_IDS.length} UNLOCKED
            </span>
          </header>

          <div className="bg-[#F4EFE6] border-b-2 border-[#111111] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {([
                  ["all", "ALL", ACHIEVEMENT_IDS.length],
                  ["unlocked", "UNLOCKED", unlocked.length],
                  ["locked", "LOCKED", ACHIEVEMENT_IDS.length - unlocked.length],
                ] as const).map(([filter, label, count]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setAchievementFilter(filter)}
                    className={`px-2.5 py-1 font-mono text-[11px] font-bold border-2 border-[#111111] rounded-none ${achievementFilter === filter ? "bg-[#111111] text-[#FFD60A]" : "bg-[#FFFFFF] text-[#111111]"}`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline font-mono text-[10px] font-bold text-[#111111]/70">
                💡 HOVER OR TAP ANY BADGE FOR UNLOCK CRITERIA
              </span>
            </div>

            <div className="bg-[#111111] text-[#FFFFFF] border-2 border-[#111111] p-3 flex items-center gap-3">
              {(() => {
                const Icon = ACHIEVEMENT_ICONS[selectedId] ?? Trophy;
                const isUnlocked = Boolean(profile.achievements[selectedId]);
                return (
                  <>
                    <span className="w-11 h-11 border-2 border-[#FFFFFF] bg-[#FFD60A] flex items-center justify-center shrink-0 text-[#111111]">
                      <Icon className="w-6 h-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-sm text-[#FFD60A] uppercase">
                          {t(achievementKey(selectedId))}
                        </h3>
                        <span className={`px-1.5 py-0.5 font-mono text-[9px] font-black uppercase ${isUnlocked ? "bg-[#00C271] text-[#111111]" : "bg-[#FF3B1D] text-[#FFFFFF]"}`}>
                          {isUnlocked ? "UNLOCKED" : "LOCKED"}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[#FFFFFF] font-bold mt-1">
                        HOW TO UNLOCK: {selectedHintText}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[430px] overflow-y-auto">
            {visibleAchievements.length === 0 ? (
              <p className="font-mono text-xs text-[#111111]/70">No achievements in this filter.</p>
            ) : visibleAchievements.map((id) => {
              const isUnlocked = Boolean(profile.achievements[id]);
              const Icon = ACHIEVEMENT_ICONS[id] ?? Trophy;
              const progress = Math.round(Math.max(0, Math.min(1, achievementCounts[id])) * 100);
              return (
                <button
                  key={id}
                  type="button"
                  onMouseEnter={() => setSelectedAchievement(id)}
                  onFocus={() => setSelectedAchievement(id)}
                  onClick={() => setSelectedAchievement(id)}
                  aria-pressed={selectedId === id}
                  className={`border-2 border-[#111111] p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors text-left rounded-none ${isUnlocked ? "bg-[#FFD60A]/25 shadow-[3px_3px_0px_#111111]" : "bg-[#F4EFE6] hover:bg-[#FFFFFF]"}`}
                >
                  <span className={`w-9 h-9 border-2 border-[#111111] flex items-center justify-center shrink-0 ${isUnlocked ? "bg-[#FFD60A] text-[#111111]" : "bg-[#E6E0D4] text-[#111111]/60"}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-xs text-[#111111] uppercase leading-tight">
                        {t(achievementKey(id))}
                      </span>
                      <span className={`shrink-0 font-mono text-[10px] font-black ${isUnlocked ? "text-[#00C271]" : "text-[#111111]/50"}`}>
                        {isUnlocked ? "✓" : "🔒"}
                      </span>
                    </span>
                    <span className="block font-mono text-[10px] font-semibold text-[#111111]/80 leading-snug mt-0.5">
                      HOW TO UNLOCK: {unlockHintFor(id)}
                    </span>
                    {PROGRESS_ACHIEVEMENTS.has(id) && (
                      <span className="block mt-1.5 w-full h-1.5 bg-[#E6E0D4] border border-[#111111] overflow-hidden">
                        <span className="block h-full bg-[#00C271]" style={{ width: `${progress}%` }} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProfilePage;