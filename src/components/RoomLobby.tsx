import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import { useSettings } from "../context/SettingsContext";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import type { Quiz, Category } from "../types/jeopardy";
import {
  Lock,
  LogIn,
  Loader2,
  Pencil,
  X,
  MonitorPlay,
  LayoutGrid,
  Zap,
  Settings as SettingsIcon,
  Trophy,
  ArrowLeft,
  Check,
  Sparkles,
  Eye,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PlayerAvatar } from "../utils/playerAvatar";
import { avatarImages, fbAvatarKey } from "../utils/avatarImages";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";
import { getAbilityForAvatar } from "../abilities/config";
import { CHARACTER_TRIVIA } from "../abilities/trivia";
import { SettingsModal } from "./SettingsModal";

import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import {
  loadProfile,
  saveProfileName,
  saveProfileAvatar,
  xpOf,
  levelInfo,
  ACHIEVEMENT_IDS,
  isSecretAchievement,
  achievementKey,
  achievementHint,
} from "../utils/profile";
import { momentBus } from "../delight/moments";
import { soundManager } from "../utils/sound";
import { useLongHover } from "../delight/secrets";

interface RoomLobbyProps {
  onHostEntersRoom: () => void;
  onPlayerEntersRoom: () => void;
  onCreateQuiz: () => void;
  onEditQuiz: (quiz: Quiz) => void;
  onOpenProfile?: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  onHostEntersRoom,
  onPlayerEntersRoom,
  onCreateQuiz,
  onEditQuiz,
  onOpenProfile,
}) => {
  const { createRoom, joinRoom, loading, error, myId } = useRoom();
  const { quizzes } = useQuizLibrary();
  const { settings, update: updateSettings, t } = useSettings();

  // Hidden delight: hover the logo long enough and it murmurs a secret back.
  const logoRef = React.useRef<HTMLDivElement>(null);
  useLongHover(logoRef, 2500, () => {
    soundManager.playEgg();
    momentBus.emit({
      icon: "",
      title: "The logo hums",
      subtitle: "Some totems remember every game played beneath them.",
      tone: "ink",
    });
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCodeLocked, setJoinCodeLocked] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked">("all");

  const [hostName, setHostName] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id ?? "");
  const [playerName, setPlayerName] = useState(() => loadProfile().name || "");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickFindQuery, setQuickFindQuery] = useState("");
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorFilter, setMonitorFilter] = useState<"ALL" | "HINDI" | "ENGLISH">("ALL");
  const [spinning, setSpinning] = useState(false);
  const [spinFlash, setSpinFlash] = useState(false);
  const spinTimers = useRef<number[]>([]);
  const profile = loadProfile();
  const [selectedAvatar, setSelectedAvatar] = useState(() => profile.avatar || avatarImages[0]?.id || "");
  const joinFilmstripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!joinOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement | null)?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = Math.max(0, avatarImages.findIndex((a) => a.id === selectedAvatar));
      const next = e.key === "ArrowRight" ? (idx + 1) % avatarImages.length : (idx - 1 + avatarImages.length) % avatarImages.length;
      const av = avatarImages[next];
      if (av) setSelectedAvatar(av.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joinOpen, selectedAvatar]);
  useEffect(() => {
    if (!joinOpen) return;
    const el = joinFilmstripRef.current?.querySelector(`[data-avatar-id="${selectedAvatar}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [joinOpen, selectedAvatar]);

  // Live "who's already in this room" — used to grey out taken characters in the
  // join picker so two players can't pick the same avatar.
  const [takenAvatars, setTakenAvatars] = useState<Record<string, string>>({});
  useEffect(() => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setTakenAvatars({});
      return;
    }
    const ownersRef = ref(db, `rooms/${code}/avatarOwners`);
    const unsub = onValue(ownersRef, (snap) => {
      setTakenAvatars(snap.val() ?? {});
    });
    return () => unsub();
  }, [roomCode]);

  const xp = xpOf(profile);
  const level = levelInfo(xp);
  const unlockedCount = ACHIEVEMENT_IDS.filter((id) => profile.achievements[id]).length;
  const lockedCount = ACHIEVEMENT_IDS.length - unlockedCount;

  // ── Hero studio state ──
  const [liveRooms, setLiveRooms] = useState(0);
  const [livePlayers, setLivePlayers] = useState(0);
  const [onAirMode, setOnAirMode] = useState<"live" | "rehearsal">("live");
  const [buzzFlash, setBuzzFlash] = useState<{ ms: number; key: number } | null>(null);
  const [overdrive, setOverdrive] = useState(false);
  const [heroJoinError, setHeroJoinError] = useState("");
  const [, setBestBuzzMs] = useState<number | null>(null);
  const [warmupStreak, setWarmupStreak] = useState(0);
  const [flippedTiles, setFlippedTiles] = useState<Record<number, boolean>>({});
  const [answeredTiles, setAnsweredTiles] = useState<Record<number, "correct" | "wrong">>({});
  const [confettiBursts, setConfettiBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const logoClickCount = React.useRef(0);
  const logoClickTimer = React.useRef<number | null>(null);
  const heroRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const roomsRef = ref(db, "rooms");
    const unsub = onValue(roomsRef, (snap) => {
      const val = snap.val() || {};
      const entries = Object.values(val) as any[];
      const active = entries.filter((r) => r && r.phase && r.phase !== "ended");
      setLiveRooms(active.length);
      setLivePlayers(active.reduce((acc, r) => acc + Object.keys(r.players || {}).length, 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key.toLowerCase() === "b") {
        const ms = 80 + Math.floor(Math.random() * 120);
        setBuzzFlash({ ms, key: Date.now() });
        setBestBuzzMs((prev) => (prev === null || ms < prev ? ms : prev));
        soundManager.playBuzzer();
        window.setTimeout(() => setBuzzFlash(null), 700);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  type FeedItem = { tag: "INDIA" | "WORLD"; title: string; link?: string };
  const FEED_FALLBACK: FeedItem[] = [
    { tag: "INDIA", title: "Parliament session sees key debate on national development priorities" },
    { tag: "WORLD", title: "Global leaders meet to discuss security and economic cooperation" },
    { tag: "INDIA", title: "Major Indian cities expand metro and green transport projects" },
    { tag: "WORLD", title: "International markets react to new central bank policy signals" },
    { tag: "INDIA", title: "Tech startups across India report strong growth in AI adoption" },
    { tag: "WORLD", title: "Scientists share new findings on climate resilience worldwide" },
  ];
  const readFeedCache = (): FeedItem[] | null => {
    try {
      const raw = localStorage.getItem("bwq_live_headlines_v2");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts?: number; headlines?: FeedItem[] };
      if (!parsed?.ts || !Array.isArray(parsed.headlines)) return null;
      if (Date.now() - parsed.ts > 60 * 60 * 1000) return null;
      const clean = parsed.headlines.filter((h) => (h?.tag === "INDIA" || h?.tag === "WORLD") && String(h?.title || "").trim()).slice(0, 12);
      return clean.length ? clean : null;
    } catch { return null; }
  };
  const writeFeedCache = (headlines: FeedItem[]) => {
    try { localStorage.setItem("bwq_live_headlines_v2", JSON.stringify({ ts: Date.now(), headlines })); } catch {}
  };
  const [feedHeadlines, setFeedHeadlines] = useState<FeedItem[]>(() => readFeedCache() || FEED_FALLBACK);
  const [breakingHold, setBreakingHold] = useState(false);

  useEffect(() => {
    const hasBreaking = feedHeadlines.some((h) => /breaking/i.test(h.title));
    if (!hasBreaking) { setBreakingHold(false); return; }
    setBreakingHold(true);
    const t = window.setTimeout(() => setBreakingHold(false), 6500);
    return () => window.clearTimeout(t);
  }, [feedHeadlines]);

  useEffect(() => {
    let alive = true;
    const clean = (items: any[]): FeedItem[] => items
      .map((h): FeedItem => ({ tag: h?.tag === "WORLD" ? "WORLD" : "INDIA", title: String(h?.title || "").replace(/\s+/g, " ").trim(), link: String(h?.link || "").trim() || undefined }))
      .filter((h) => !!h.title)
      .slice(0, 12);
    const interleave = (india: FeedItem[], world: FeedItem[]) => {
      const out: FeedItem[] = [];
      const len = Math.max(india.length, world.length);
      for (let i = 0; i < len; i++) { if (india[i]) out.push(india[i]); if (world[i]) out.push(world[i]); }
      return out.slice(0, 12);
    };
    const fetchRssJson = async (url: string, tag: "INDIA" | "WORLD") => {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("rss2json failed");
      const data = await res.json() as { items?: Array<{ title?: string; link?: string }> };
      return (Array.isArray(data?.items) ? data.items : []).slice(0, 6).map((i) => ({ tag, title: String(i?.title || "").trim(), link: String(i?.link || "").trim() || undefined })).filter((i) => i.title);
    };
    const load = async () => {
      try {
        const res = await fetch("/api/headlines", { headers: { Accept: "application/json" } });
        if (res.ok) {
          const data = await res.json() as { headlines?: any[] };
          const next = clean(Array.isArray(data?.headlines) ? data.headlines : []);
          if (alive && next.length > 0) { setFeedHeadlines(next); writeFeedCache(next); return; }
        }
        throw new Error("api unavailable");
      } catch {
        try {
          const [indiaSettled, worldSettled] = await Promise.allSettled([
            fetchRssJson("https://www.thehindu.com/news/national/feeder/default.rss", "INDIA"),
            fetchRssJson("https://feeds.bbci.co.uk/news/world/rss.xml", "WORLD"),
          ]);
          const india = indiaSettled.status === "fulfilled" ? indiaSettled.value : [];
          const world = worldSettled.status === "fulfilled" ? worldSettled.value : [];
          const next = interleave(india, world);
          if (alive && next.length > 0) { setFeedHeadlines(next); writeFeedCache(next); }
        } catch {
          // keep cache/fallback
        }
      }
    };
    load();
    const id = window.setInterval(load, 60 * 60 * 1000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);



  // Guard against malformed quiz data from the shared Firebase library (some
  // older/foreign packs may lack a `categories` array). Treat missing as empty
  // so the create-game screen never crashes to a black screen.
  const categoriesOf = (q: Quiz | undefined): Category[] => {
    const cats = q?.categories;
    return Array.isArray(cats) ? cats : [];
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0];

 

  // QR/deep-link join: prefill the room code when arriving via /?join=CODE or /?code=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("join") || params.get("code") || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code) {
      setRoomCode(code);
      setJoinCodeLocked(true);
      setJoinOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Sync selected quiz when the library updates (e.g. after Firebase resolves)
  useEffect(() => {
    if (quizzes.length > 0 && !quizzes.find((q) => q.id === selectedQuizId)) {
      setSelectedQuizId(quizzes[0].id);
    }
  }, [quizzes, selectedQuizId]);

  useEffect(() => {
    if (!createOpen || quickFindOpen || quizzes.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;
      if (typing) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir: 1 | -1 = e.key === "ArrowRight" ? 1 : -1;
      const idx = Math.max(0, quizzes.findIndex((q) => q.id === selectedQuizId));
      const next = (idx + dir + quizzes.length) % quizzes.length;
      setSelectedQuizId(quizzes[next].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen, quickFindOpen, quizzes, selectedQuizId]);

  useEffect(() => () => { spinTimers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    const q = monitorSearch.trim().toLowerCase();
    const hasFilter = monitorFilter !== "ALL" || !!q;
    if (!hasFilter) return;
    const filtered = quizzes.filter((z) => {
      const hay = `${z.title || ""} ${z.description || ""}`;
      const isHindi = /[\u0900-\u097F]/.test(hay) || /hindi/i.test(hay);
      if (monitorFilter === "HINDI" && !isHindi) return false;
      if (monitorFilter === "ENGLISH" && isHindi) return false;
      if (q && !(z.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (filtered.length > 0 && !filtered.some((z) => z.id === selectedQuizId)) setSelectedQuizId(filtered[0].id);
  }, [monitorSearch, monitorFilter, quizzes, selectedQuizId]);

  const handleHost = async () => {
    setLocalError("");
    if (!hostName.trim()) {
      setLocalError(t("errorEnterHostName"));
      return;
    }
    if (!selectedQuiz) {
      setLocalError(t("errorSelectQuiz"));
      return;
    }
    try {
      const hostAvatar = profile.avatar || avatarImages[0]?.id || undefined;
      await createRoom(selectedQuiz, hostName.trim(), hostAvatar);
      onHostEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? t("errorCreateFailed"));
    }
  };

  const handleJoin = async () => {
    setLocalError("");
    if (!playerName.trim()) {
      setLocalError(t("errorEnterName"));
      return;
    }
    if (roomCode.trim().length !== 6) {
      setLocalError(t("errorCodeLength"));
      return;
    }
    try {
      saveProfileName(playerName.trim());
      if (selectedAvatar) saveProfileAvatar(selectedAvatar);
      await joinRoom(roomCode.trim(), playerName.trim(), selectedAvatar, { spectator: joinAsSpectator });
      onPlayerEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? t("errorJoinFailed"));
    }
  };

  const handleHeroJoinCode = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setHeroJoinError("Enter a valid 6-character room code");
      return;
    }
    setHeroJoinError("");
    setLocalError("");
    setRoomCode(code);
    setJoinCodeLocked(true);
    setJoinOpen(true);
  };

  const modalPanel =
    "glass-panel-heavy rounded-[2rem] p-8 w-full space-y-6 relative border border-[#111111]/25 shadow-[6px_6px_0_#111111] max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar";
  const closeBtn =
    "absolute top-5 right-5 p-2 rounded-full bg-[#E5DEC9] border border-[#111111]/15 text-text-muted hover:text-[#111111] hover:bg-[#E5DEC9] transition-all";

  const howToSteps = [
    { Icon: MonitorPlay, title: t("htpStep1Title"), desc: t("htpStep1Desc") },
    { Icon: LayoutGrid, title: t("htpStep2Title"), desc: t("htpStep2Desc") },
    { Icon: Zap, title: t("htpStep3Title"), desc: t("htpStep3Desc") },
  ];

  const triggerOverdrive = () => {
    setOverdrive(true);
    soundManager.playBuzzer();
    window.setTimeout(() => setOverdrive(false), 1400);
  };

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) window.clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      triggerOverdrive();
      return;
    }
    logoClickTimer.current = window.setTimeout(() => {
      logoClickCount.current = 0;
    }, 900);
  };

  const spawnConfetti = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setConfettiBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => setConfettiBursts((b) => b.filter((p) => p.id !== id)), 800);
  };

  const flipTiles = [
    { cat: "POP CULTURE", value: 200, q: "Which film features the line 'I'll be back'?", options: ["The Terminator", "Predator"], answer: 0 },
    { cat: "SCIENCE", value: 400, q: "What planet is known as the Red Planet?", options: ["Mars", "Jupiter"], answer: 0 },
    { cat: "WILD CARD", value: 500, q: "How many seconds in a minute?", options: ["60", "90"], answer: 0 },
  ];

  // ── 1. CREATE GAME -> TV DIRECTOR'S HARDWARE CONTROL CONSOLE ─────────────
  if (createOpen) {
    const monitorQuery = monitorSearch.trim().toLowerCase();
    const isHindiQuiz = (q: Quiz) => /[\u0900-\u097F]/.test(`${q.title || ""} ${q.description || ""}`) || /hindi/i.test(`${q.title || ""} ${q.description || ""}`);
    const activeList = quizzes.filter((q) => {
      const hindi = isHindiQuiz(q);
      if (monitorFilter === "HINDI" && !hindi) return false;
      if (monitorFilter === "ENGLISH" && hindi) return false;
      if (monitorQuery && !(q.title || "").toLowerCase().includes(monitorQuery)) return false;
      return true;
    });
    const hindiCount = quizzes.filter(isHindiQuiz).length;
    const englishCount = quizzes.length - hindiCount;
    const selectedCats = categoriesOf(selectedQuiz);
    const totalQuestions = selectedCats.reduce((acc, cat) => acc + (cat.questions?.length || 0), 0);
    const activeIndex = Math.max(0, activeList.findIndex((q) => q.id === selectedQuizId));
    const packNo = activeList.length > 0 ? (activeList.some((q) => q.id === selectedQuizId) ? activeIndex + 1 : 1) : 0;
    const packTotal = activeList.length;
    const cycle = (dir: -1 | 1) => {
      if (activeList.length === 0 || spinning) return;
      const idx = Math.max(0, activeList.findIndex((q) => q.id === selectedQuizId));
      const safeIdx = idx === -1 ? 0 : idx;
      const next = (safeIdx + dir + activeList.length) % activeList.length;
      setSelectedQuizId(activeList[next].id);
    };
    const randomizePack = () => {
      if (activeList.length === 0 || spinning) return;
      spinTimers.current.forEach((t) => window.clearTimeout(t));
      spinTimers.current = [];
      setSpinning(true);
      const steps = [45, 60, 80, 105, 135, 175, 225, 290];
      let acc = 0;
      steps.forEach((ms, i) => {
        acc += ms;
        const t = window.setTimeout(() => {
          const rand = activeList[Math.floor(Math.random() * activeList.length)];
          if (rand) setSelectedQuizId(rand.id);
          if (i === steps.length - 1) {
            const final = activeList[Math.floor(Math.random() * activeList.length)];
            if (final) setSelectedQuizId(final.id);
            setSpinning(false);
            setSpinFlash(true);
            window.setTimeout(() => setSpinFlash(false), 350);
          }
        }, acc);
        spinTimers.current.push(t);
      });
    };
    const quickFindResults = quizzes.filter((q) => !quickFindQuery.trim() || (q.title || "").toLowerCase().includes(quickFindQuery.toLowerCase()));
    const vuBars = Array.from({ length: 8 }, (_, i) => i < Math.min(8, hostName.trim().length));
    const micHot = hostName.trim().length > 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className="min-h-screen flex flex-col bg-[#F4EFE6] text-[#111111]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      >
        <header className="w-full border-b-2 border-[#111111] bg-[#F4EFE6]/95 shrink-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-[#FF3B1D] border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="1.8" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
              </div>
              <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-[1rem] sm:text-[1.1rem] uppercase tracking-[-0.02em] leading-none text-[#111111] truncate">Buzzing With Quizzing</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button type="button" onClick={onCreateQuiz} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#FFD60A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow,background-color]">+ Build New Quiz</button>
              <button type="button" onClick={() => setCreateOpen(false)} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#F4EFE6] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow,background-color]"><ArrowLeft className="w-4 h-4" /> Back</button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center">
          <div className="h-auto bg-white border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] flex flex-col">

            {/* Upper: Broadcast Preview Monitor */}
            <section className="bg-[#111111] text-white flex flex-col border-b-[3px] border-[#111111]">
              <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-[#333333] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase text-[#00C271]">
                  <span className="w-2.5 h-2.5 bg-[#00C271] border border-[#00C271]/50 shadow-[0_0_0_2px_rgba(0,194,113,0.15)]" />
                  CH-{String(packNo || 1).padStart(2, "0")} / {String(packTotal || 0).padStart(2, "0")} // Ready for Broadcast
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <input
                      type="text"
                      value={monitorSearch}
                      onChange={(e) => setMonitorSearch(e.target.value)}
                      placeholder="SEARCH PACKS..."
                      className="bg-[#1C1C1C] border border-[#444444] text-white font-mono text-xs px-3 py-1.5 w-44 sm:w-48 pr-8 placeholder:text-white/35 focus:border-[#FFD60A] focus:outline-none"
                    />
                    {monitorSearch && (
                      <button type="button" onClick={() => setMonitorSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/55 hover:text-[#FFD60A] font-mono text-xs" aria-label="Clear search">×</button>
                    )}
                  </div>
                  <button type="button" onClick={() => { setQuickFindQuery(""); setQuickFindOpen(true); }} className="px-3 py-1.5 border border-[#555555] bg-[#1C1C1C] font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-white hover:border-[#FFD60A] hover:text-[#FFD60A] transition-colors">All Packs ({quizzes.length}) </button>
                  {selectedQuiz && <button type="button" onClick={() => onEditQuiz(selectedQuiz)} className="px-3 py-1.5 border border-[#555555] bg-[#1C1C1C] font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-white hover:border-[#FFD60A] hover:text-[#FFD60A] transition-colors inline-flex items-center gap-1.5">Edit Pack <Pencil className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-3.5">
                <div>
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-[#F4EFE6]/45 mb-1.5">Live Program Feed</div>
                  <h2 style={{ fontFamily: "'Archivo Black', sans-serif" }} className={`text-3xl md:text-4xl uppercase tracking-[-0.03em] leading-[0.92] break-words ${spinFlash ? "text-white" : "text-[#FFD60A]"}`}>
                    {selectedQuiz?.title || "No Quiz Pack Loaded"}
                  </h2>
                </div>

                <div>
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#F4EFE6]/45 mb-2.5">Category Matrix</div>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedCats.length > 0 ? selectedCats.map((c) => {
                      const qCount = (c.questions?.length || 0);
                      return (
                        <div key={c.id} className="w-fit inline-flex items-center gap-2.5 px-3.5 py-2 border bg-[#1A1A1A] border-[#444444] text-white hover:bg-[#FFD60A] hover:border-[#FFD60A] hover:text-[#111111] transition-colors cursor-default group">
                          <span className="font-bold text-[0.8125rem] uppercase tracking-[0.02em]">{c.name}</span>
                          <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 border border-[#555555] text-white/55 group-hover:border-[#111111]/25 group-hover:text-[#111111]/75 transition-colors">{qCount}Q</span>
                        </div>
                      );
                    }) : <div className="px-4 py-6 border border-dashed border-[#444444] font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-white/45">No categories loaded</div>}
                  </div>
                </div>

                <div className="border-t border-[#2A2A2A] pt-3 mt-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {([
                      { id: "ALL" as const, label: `ALL (${quizzes.length})` },
                      { id: "HINDI" as const, label: `HINDI (${hindiCount})` },
                      { id: "ENGLISH" as const, label: `ENGLISH (${englishCount})` },
                    ]).map((f) => {
                      const active = monitorFilter === f.id;
                      return (
                        <button key={f.id} type="button" onClick={() => setMonitorFilter(f.id)} className={`px-3 py-1.5 border font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase transition-colors ${active ? "bg-[#FFD60A] border-[#FFD60A] text-[#111111]" : "bg-[#1A1A1A] border-[#444444] text-white/80 hover:border-[#FFD60A]/70 hover:text-[#FFD60A]"}`}>
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#F4EFE6]/65">
                    <span className="text-[#FFD60A]">TELEMETRY // </span>{selectedCats.length} CATEGORIES LOADED • {totalQuestions} QUESTIONS READY
                  </div>
                </div>
              </div>
            </section>

            {/* Lower: Hardware Switchboard */}
            <section className="grid grid-cols-1 md:grid-cols-12 border-t-[3px] border-[#111111] bg-white">
              {/* MIC 01 */}
              <div className="md:col-span-4 flex flex-col justify-start gap-3 p-4 bg-[#FFFFFF] border-b-[3px] md:border-b-0 md:border-r-[3px] border-[#111111]">
                <div>
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#111111]/50 mb-2">MIC 01 // Host Input</div>
                  <label className="font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase text-[#111111] mb-2 block">Host Callsign</label>
                  <input type="text" value={hostName} onChange={(e) => setHostName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleHost()} placeholder="ENTER HOST NAME..." className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-4 py-3 text-[1rem] font-extrabold uppercase tracking-[0.01em] text-[#111111] placeholder:text-[#111111]/30 outline-none focus:shadow-[3px_3px_0_#FFD60A]" style={{ fontFamily: "'Archivo Black', sans-serif" }} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-1">
                    {vuBars.map((on, i) => (
                      <div key={i} className={`h-3 flex-1 border border-[#111111] transition-colors ${on ? (i < 5 ? "bg-[#00C271]" : "bg-[#FFD60A]") : "bg-[#F4EFE6]"}`} />
                    ))}
                  </div>
                  <div className={`shrink-0 inline-flex items-center gap-2 px-2.5 py-1.5 border-2 border-[#111111] font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase ${micHot ? "bg-[#00C271]/15 text-[#111111]" : "bg-[#F4EFE6] text-[#111111]/50"}`}>
                    <span className={`w-2 h-2 border border-[#111111] ${micHot ? "bg-[#00C271]" : "bg-[#111111]/20"}`} /> {micHot ? "Mic Live" : "Mic Idle"}
                  </div>
                </div>
              </div>

              {/* DECK */}
              <div className="md:col-span-4 flex flex-col justify-start gap-3 p-4 bg-[#F4EFE6] border-b-[3px] md:border-b-0 md:border-r-[3px] border-[#111111]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#111111]/50">DECK // Channel Select</div>
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111] px-2 py-1 border border-[#111111] bg-white">Pack {String(packNo || 0).padStart(2, "0")} / {String(packTotal || 0).padStart(2, "0")}</div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => cycle(-1)} className="flex-1 py-3.5 px-3 bg-white border-2 border-[#111111] shadow-[4px_4px_0_#111111] font-mono text-[0.8125rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#FFD60A]/30 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111] transition-[transform,box-shadow,background-color]">◀ Prev</button>
                  <button type="button" onClick={() => cycle(1)} className="flex-1 py-3.5 px-3 bg-white border-2 border-[#111111] shadow-[4px_4px_0_#111111] font-mono text-[0.8125rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#FFD60A]/30 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111] transition-[transform,box-shadow,background-color]">Next ▶</button>
                </div>
                <button type="button" onClick={randomizePack} disabled={spinning || activeList.length === 0} className="w-full py-3 px-4 bg-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-[0.8125rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#ffe34d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow,background-color] disabled:opacity-60"> {spinning ? "Shuffling..." : "Shuffle / Random Pack"}</button>
              </div>

              {/* MASTER */}
              <div className="md:col-span-4 flex flex-col justify-start gap-3 p-4 bg-[#FFFFFF]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#111111]/50">MASTER // On-Air Trigger</div>
                  <div className={`inline-flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase ${micHot && selectedQuiz ? "text-[#00C271]" : "text-[#111111]/40"}`}>
                    <span className={`w-2 h-2 border border-[#111111] ${micHot && selectedQuiz ? "bg-[#00C271]" : "bg-[#111111]/20"}`} /> {micHot && selectedQuiz ? "Ready" : "Standby"}
                  </div>
                </div>
                <div className="font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#111111]/60">{selectedCats.length} CATS • {totalQuestions} QUESTIONS</div>
                {(localError || error) && <p className="px-3 py-2 border-2 border-[#FF3B1D] bg-[#FF3B1D]/10 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[#111111]">{localError || error}</p>}
                <div className="space-y-3">
                  <button onClick={handleHost} disabled={loading || quizzes.length === 0} className="w-full py-4 px-5 bg-[#FF3B1D] text-white border-2 border-[#111111] shadow-[4px_4px_0_#111111] hover:bg-[#ff553d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111] transition-[transform,box-shadow,background-color] disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                    <span className="flex items-center justify-center gap-3 text-[1rem] sm:text-[1.1rem] uppercase tracking-[0.01em]">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#111111]" />} Go On Air &amp; Host →</span>
                  </button>
                  <div className="h-2.5 border border-[#111111] bg-[repeating-linear-gradient(-45deg,#FFD60A,#FFD60A_8px,#111111_8px,#111111_16px)]" aria-hidden />
                </div>
              </div>
            </section>
          </div>
        </main>

        <AnimatePresence>
          {quickFindOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#111111]/45 flex items-start justify-center p-4 pt-[12vh]" onClick={() => setQuickFindOpen(false)}>
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} className="w-full max-w-2xl bg-white border-2 border-[#111111] shadow-[8px_8px_0_#111111]" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b-2 border-[#111111] bg-[#F4EFE6] flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase text-[#111111]">All Packs ({quizzes.length})</span>
                  <button type="button" onClick={() => setQuickFindOpen(false)} className="p-1 text-[#111111]/60 hover:text-[#111111]"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 border-b-2 border-[#111111]">
                  <input autoFocus type="text" value={quickFindQuery} onChange={(e) => setQuickFindQuery(e.target.value)} placeholder="Type to jump to a quiz..." className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-4 py-3 font-mono text-[0.8125rem] font-bold tracking-[0.03em] uppercase text-[#111111] placeholder:text-[#111111]/35 outline-none focus:shadow-[3px_3px_0_#FFD60A]" />
                </div>
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                  {quickFindResults.length === 0 ? (
                    <div className="p-6 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#111111]/45 text-center">No matching packs</div>
                  ) : quickFindResults.map((q) => {
                    const qCats = categoriesOf(q);
                    const qCount = qCats.reduce((acc, cat) => acc + (cat.questions?.length || 0), 0);
                    const active = q.id === selectedQuizId;
                    return (
                      <button key={q.id} type="button" onClick={() => { setSelectedQuizId(q.id); setQuickFindOpen(false); }} className={`w-full text-left px-4 py-3 border-b border-[#E5DEC9] flex items-center justify-between gap-3 hover:bg-[#FFD60A]/20 ${active ? "bg-[#FFD60A]/25" : "bg-white"}`}>
                        <span className="font-bold text-[0.9375rem] text-[#111111] truncate">{q.title}</span>
                        <span className="shrink-0 font-mono text-[0.6875rem] font-bold tracking-[0.06em] uppercase text-[#111111]/55">{qCats.length} CATS • {qCount} QS</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // ── 2. JOIN GAME -> CONTESTANT CASTING (ARCADE PODIUM) ─────────────────
  if (joinOpen) {
    const selectedIndex = Math.max(0, avatarImages.findIndex((a) => a.id === selectedAvatar));
    const selectedAvatarObj = avatarImages[selectedIndex] ?? getAvatarByIdOrSeed(selectedAvatar);
    const selectedDef = selectedAvatar ? getAbilityForAvatar(selectedAvatar) : undefined;
    const selectedTrivia = selectedDef ? CHARACTER_TRIVIA[selectedDef.avatarId] : undefined;
    const takenSelected = !!selectedAvatar && !!takenAvatars[fbAvatarKey(selectedAvatar)] && takenAvatars[fbAvatarKey(selectedAvatar)] !== myId;
    const codeIsLocked = joinCodeLocked && roomCode.trim().length > 0;
    const cycleAvatar = (dir: -1 | 1) => {
      const next = (selectedIndex + dir + avatarImages.length) % avatarImages.length;
      const av = avatarImages[next];
      if (av) setSelectedAvatar(av.id);
    };
    const pickRandomAvatar = () => {
      const av = avatarImages[Math.floor(Math.random() * avatarImages.length)];
      if (av) setSelectedAvatar(av.id);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
        className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden bg-[#F4EFE6] text-[#111111]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      >
        {/* 1. COMPACT TOP STUDIO HEADER */}
        <header className="h-14 border-b-2 border-[#111111] bg-[#FFFFFF] px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-[#FF3B1D] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
            </div>
            <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm sm:text-base uppercase tracking-[-0.02em] leading-none text-[#111111] truncate">Contestant Casting</span>
            <button type="button" onClick={() => { setJoinCodeLocked(false); setJoinOpen(false); }} className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-[#111111] bg-[#F4EFE6] font-mono text-xs font-bold uppercase tracking-[0.06em] text-[#111111] hover:bg-[#FFD60A] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>
          <div className="bg-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] px-3.5 py-1 flex items-center gap-3 shrink-0">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase text-[#111111]/60 leading-none">Room Pass</div>
              {codeIsLocked ? (
                <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-base tracking-widest text-[#111111] leading-none mt-0.5">{roomCode}</div>
              ) : (
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  className="mt-0.5 w-24 bg-transparent font-mono text-base font-bold tracking-widest text-[#111111] placeholder:text-[#111111]/35 outline-none uppercase"
                />
              )}
            </div>
            {roomCode.trim().length === 6 && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase text-[#00C271]">
                <span className="w-2 h-2 bg-[#00C271] border border-[#111111]" /> Linked
              </div>
            )}
          </div>
        </header>

        {/* 2. MAIN SINGLE-VIEWPORT STAGE */}
        <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* LEFT: Character Carousel & Podium */}
            <section className="lg:col-span-6 flex flex-col min-h-0">
              <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2 flex items-center justify-between gap-3 border-2 border-b-0 border-[#111111]">
                <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase">01 // Select Contestant Avatar</span>
                <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase text-[#FFD60A]">Char {String(selectedIndex + 1).padStart(2, "0")} / {String(avatarImages.length).padStart(2, "0")}</span>
              </div>
              <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] p-5 flex-1 flex flex-col justify-between gap-4 min-h-0">
                {/* Carousel Switcher */}
                <div className="flex-1 flex items-center justify-between gap-4">
                  <button type="button" onClick={() => cycleAvatar(-1)} className="px-3 py-6 sm:py-8 bg-[#F4EFE6] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-mono font-bold text-xs uppercase tracking-[0.04em] transition-[transform,box-shadow,background-color]">◀ Prev</button>
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 border-[3px] border-[#111111] bg-[#FFD60A] p-1.5 shadow-[4px_4px_0_#111111] shrink-0">
                    <img src={selectedAvatarObj?.src} alt={selectedDef?.name || selectedAvatar} className="w-full h-full object-cover border border-[#111111] bg-[#F4EFE6]" style={{ objectPosition: selectedAvatarObj?.position }} />
                    {takenSelected && <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#FF3B1D] text-white border border-[#111111] font-mono text-[9px] font-bold uppercase">Taken</span>}
                  </div>
                  <button type="button" onClick={() => cycleAvatar(1)} className="px-3 py-6 sm:py-8 bg-[#F4EFE6] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-mono font-bold text-xs uppercase tracking-[0.04em] transition-[transform,box-shadow,background-color]">Next ▶</button>
                </div>

                {/* Filmstrip */}
                <div ref={joinFilmstripRef} className="flex items-center gap-2 overflow-x-auto py-1 -mx-1 px-1 custom-scrollbar">
                  {avatarImages.map((av) => {
                    const isSelected = selectedAvatar === av.id;
                    const taken = !!takenAvatars[fbAvatarKey(av.id)] && takenAvatars[fbAvatarKey(av.id)] !== myId;
                    return (
                      <button
                        key={av.id}
                        data-avatar-id={av.id}
                        type="button"
                        onClick={() => setSelectedAvatar(av.id)}
                        title={taken ? `${av.id} — taken` : av.id}
                        className={`relative w-11 h-11 shrink-0 border-2 border-[#111111] p-0.5 transition-[transform,box-shadow,background-color] ${isSelected ? "bg-[#FFD60A] shadow-[2px_2px_0_#111111] -translate-y-0.5" : "bg-[#F4EFE6] hover:bg-white"} ${taken ? "opacity-45 grayscale" : ""}`}
                      >
                        <img src={av.src} alt={av.id} className="w-full h-full object-cover border border-[#111111]/20" style={{ objectPosition: av.position }} />
                      </button>
                    );
                  })}
                </div>

                {/* Callsign Nameplate */}
                <div className="border-t-2 border-[#111111] pt-3.5 flex items-end gap-2.5">
                  <div className="flex-1">
                    <label className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase text-[#111111] block mb-1.5">Stage Callsign</label>
                    <input
                      type="text"
                      placeholder={t("yourNamePh")}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F4EFE6] border-2 border-[#111111] text-lg uppercase text-[#111111] placeholder:text-[#111111]/30 focus:bg-[#FFD60A]/20 focus:outline-none"
                      style={{ fontFamily: "'Archivo Black', sans-serif" }}
                    />
                  </div>
                  <button type="button" onClick={pickRandomAvatar} className="px-3.5 py-2.5 bg-[#FFD60A] hover:bg-[#111111] hover:text-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-mono text-xs font-bold uppercase tracking-[0.06em] text-[#111111] transition-[transform,box-shadow,background-color,color] shrink-0">
                     Random
                  </button>
                </div>
              </div>
            </section>

            {/* RIGHT: Power-Up Dossier + Stats + Launch */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-4 min-h-0">
              {/* Power-Up Monitor */}
              <section className="bg-[#FFFFFF] p-2 border-2 border-[#111111] shadow-[6px_6px_0_#111111] flex-1 flex flex-col">
                <div className="bg-[#111111] text-[#FFFFFF] p-4 flex-1 flex flex-col gap-3">
                  <div className="font-mono text-xs font-bold tracking-[0.1em] uppercase text-[#00C271]">Active Power-Up // Ability Spec</div>
                  <div>
                    <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-2xl text-[#FFD60A] uppercase leading-tight">{selectedDef?.name || "Select Character"}</div>
                    {selectedDef && (
                      <div className="inline-block mt-1 bg-[#FF3B1D] text-[#FFFFFF] font-mono text-xs font-bold px-2.5 py-0.5 uppercase tracking-[0.04em]">
                        {selectedDef.emoji} {selectedDef.abilityName}
                      </div>
                    )}
                    {takenSelected && <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#FF3B1D]">Taken in this room</div>}
                  </div>
                  <div className="bg-[#1A1A1A] border border-[#333333] p-3 text-xs text-[#E5E5E5] space-y-1">
                    <p className="font-bold text-white">{selectedDef?.tagline || "Pick a character to load their ability spec."}</p>
                    <p className="text-[#CCCCCC] leading-relaxed">{selectedDef?.longDesc || "Each contestant brings one unique power-up into the show."}</p>
                  </div>
                  <div className="text-xs text-[#AAAAAA] leading-relaxed">
                    <span className="text-[#FFD60A] font-mono font-bold tracking-[0.04em]">DID YOU KNOW? </span>
                    {selectedTrivia || "Choose a character to reveal their trivia file."}
                  </div>
                </div>
              </section>

              {/* Career Telemetry */}
              <section className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[4px_4px_0_#111111] grid grid-cols-4 divide-x-2 divide-[#111111]">
                {[
                  { label: "Games", value: String(profile.gamesPlayed) },
                  { label: "Wins", value: String(profile.gamesWon) },
                  { label: "ELO", value: String(profile.elo ?? 1000) },
                  { label: "Level", value: `LV ${level.level}` },
                ].map((s) => (
                  <div key={s.label} className="py-2.5 text-center">
                    <div className="font-mono text-lg font-black text-[#111111] leading-none">{s.value}</div>
                    <div className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase text-[#111111]/50 mt-1">{s.label}</div>
                  </div>
                ))}
              </section>

              {/* Spectator + Launch */}
              <div className="flex flex-col gap-3 mt-auto lg:mt-0">
                <button
                  type="button"
                  onClick={() => setJoinAsSpectator((v) => !v)}
                  className="w-full bg-[#FFFFFF] border-2 border-[#111111] px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F4EFE6] transition-colors"
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.06em] text-[#111111] flex items-center gap-2"><Eye className="w-4 h-4" /> Join as Spectator</span>
                  <span className={`w-12 h-6 border-2 border-[#111111] p-0.5 flex items-center shrink-0 transition-colors ${joinAsSpectator ? "bg-[#FFD60A] justify-end" : "bg-[#F4EFE6] justify-start"}`}>
                    <span className="w-4 h-4 bg-[#111111]" />
                  </span>
                </button>

                {(localError || error) && (
                  <p className="px-3 py-2 border-2 border-[#FF3B1D] bg-[#FF3B1D]/10 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[#111111]">{localError || error}</p>
                )}

                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#FF3B1D] hover:bg-[#E02E12] text-[#FFFFFF] border-2 border-[#111111] shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_#111111] transition-[transform,box-shadow,background-color] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Archivo Black', sans-serif" }}
                >
                  <span className="flex items-center justify-center gap-3 text-lg tracking-wide uppercase">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#111111]" />}
                    Lock In &amp; Join Show →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </motion.div>
    );
  }

  // ── 3. HOME LOBBY HERO VIEW — BROADCAST STUDIO ──────────────────────────
  const liveLabel = onAirMode === "live"
    ? `ON AIR · ${liveRooms} ROOMS · ${livePlayers} PLAYERS`
    : "REHEARSAL MODE · HOST FACTS ARMED";

  return (
    <div ref={heroRef} className={`bwq-hero bwq-hero-grid min-h-[100dvh] flex flex-col relative ${overdrive ? "bwq-shake" : ""}`} style={{ color: "#111111" }}>
      {/* Stage spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(255,214,10,0.18), transparent 70%)" }}
      />
      {/* Overdrive border */}
      {overdrive && <div aria-hidden className="pointer-events-none absolute inset-0 z-[60] border-[6px] border-[#FF3B1D] bwq-buzz-flash" />}
      {/* Buzz flash */}
      {buzzFlash && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[55] flex items-center justify-center">
          <div className="absolute inset-0 bg-[#FFD60A]/20 bwq-buzz-flash" />
          <div className="relative bwq-buzz-flash bg-[#111111] text-[#FFD60A] border-2 border-[#111111] px-6 py-4 shadow-[6px_6px_0_#FF3B1D]" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            <div className="text-[clamp(2rem,6vw,4.5rem)] font-extrabold uppercase tracking-[-0.04em] leading-none">BUZZ!</div>
            <div className="font-mono text-xs font-bold tracking-[0.2em] mt-1 text-[#111111]">{(buzzFlash.ms / 1000).toFixed(3)}s — NEW RECORD!</div>
          </div>
        </div>
      )}

      {/* Floating trivia tokens */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {[
          { top: "12%", left: "4%", size: 54, delay: "0s", rot: -8 },
          { top: "18%", right: "6%", size: 46, delay: "1.2s", rot: 12 },
          { top: "62%", left: "2%", size: 40, delay: "2.1s", rot: 6 },
          { top: "70%", right: "4%", size: 58, delay: "0.7s", rot: -10 },
          { top: "42%", right: "12%", size: 34, delay: "1.7s", rot: 15 },
        ].map((tok, i) => (
          <div key={i} className="absolute bwq-float-token text-[#111111]/[0.12]" style={{ top: tok.top, left: tok.left, right: (tok as any).right, animationDelay: tok.delay }}>
            <svg width={tok.size} height={tok.size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${tok.rot}deg)` }}>
              {i === 0 && <><circle cx="32" cy="32" r="20" /><circle cx="32" cy="32" r="8" fill="currentColor" stroke="none" opacity="0.25" /><path d="M32 12v4M32 48v4M12 32h4M48 32h4" /></>}
              {i === 1 && <path d="M36 6 16 36h14l-2 22 20-30H34z" />}
              {i === 2 && <><path d="M32 8v8M32 48v8M8 32h8M48 32h8" /><circle cx="32" cy="32" r="12" /><path d="M32 26v8l6 4" /></>}
              {i === 3 && <><path d="M20 52h24M24 52l-4-16h24l-4 16M20 36c-6 0-10-4-10-10V16h44v10c0 6-4 10-10 10" /><path d="M10 20H6v6c0 4 2 6 6 6M54 20h4v6c0 4-2 6-6 6" /></>}
              {i === 4 && <><circle cx="32" cy="32" r="22" /><path d="M24 24a8 8 0 0 1 16 0c0 6-8 6-8 12" /><circle cx="32" cy="44" r="1.5" fill="currentColor" stroke="none" /></>}
            </svg>
          </div>
        ))}
      </div>

      {/* ── A. TOP BROADCAST BAR ── */}
      <header className="relative z-40 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5">
        <div className="flex items-center justify-between gap-3 border-2 border-[#111111] bg-[#F4EFE6]/95 px-3 sm:px-4 py-2.5 sm:py-3 shadow-[4px_4px_0_#111111]">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={handleLogoClick} className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-[#FF3B1D] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none transition-transform" aria-label="Buzzing With Quizzing logo" title="Buzzing With Quizzing">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="1.8" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
            </button>
            <div className="leading-[0.95] min-w-0">
              <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-extrabold uppercase tracking-[-0.03em] text-[13px] sm:text-[15px] text-[#111111] truncate">BUZZING WITH</div>
              <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-extrabold uppercase tracking-[-0.03em] text-[13px] sm:text-[15px] text-[#111111] truncate">QUIZZING</div>
            </div>
          </div>

          <button
            onClick={() => setOnAirMode((m) => (m === "live" ? "rehearsal" : "live"))}
            className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 border-2 border-[#111111] bg-white font-mono text-[0.75rem] font-bold tracking-[0.12em] uppercase shadow-[2px_2px_0_#111111] hover:translate-y-[-1px] transition-transform"
            title="Toggle studio mode"
          >
            <span className={`w-2.5 h-2.5 rounded-full border border-[#111111] ${onAirMode === "live" ? "bg-[#FF3B1D] bwq-onair-dot" : "bg-[#2563EB]"}`} />
            <span className="text-[#111111]">{liveLabel}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => (onOpenProfile ? onOpenProfile() : setShowAchievementsModal(true))}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 border-2 border-[#111111] bg-white shadow-[2px_2px_0_#111111] hover:translate-y-[-1px] transition-transform"
              title="Profile & XP"
            >
              <PlayerAvatar seed={myId} avatar={selectedAvatar || profile.avatar} name={profile.name || playerName || "Player"} size={28} className="border border-[#111111]" />
              <div className="leading-none text-left">
                <div className="font-mono text-[0.75rem] font-bold tracking-[0.08em] text-[#111111]">LVL {level.level}</div>
                <div className="font-mono text-[0.75rem] font-bold tracking-[0.08em] text-[#111111]/60">{level.into}/{level.need} XP</div>
              </div>
            </button>
            <button onClick={() => setHowToOpen(true)} className="hidden lg:inline-flex px-3 py-2 border-2 border-[#111111] bg-[#F4EFE6] font-mono text-[0.75rem] font-bold tracking-[0.12em] uppercase shadow-[2px_2px_0_#111111] hover:bg-[#FFD60A] transition-colors">{t("howToPlay")}</button>
            <button
              onClick={() => updateSettings({ isSoundMuted: !settings.isSoundMuted })}
              className="w-10 h-10 border-2 border-[#111111] bg-white shadow-[2px_2px_0_#111111] flex items-center justify-center hover:bg-[#F4EFE6] transition-colors"
              aria-label={settings.isSoundMuted ? "Unmute sound" : "Mute sound"}
              title={settings.isSoundMuted ? "Unmute" : "Mute"}
            >
              {settings.isSoundMuted ? <VolumeX className="w-4 h-4 text-[#111111]" /> : <Volume2 className="w-4 h-4 text-[#111111]" />}
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 border-2 border-[#111111] bg-white shadow-[2px_2px_0_#111111] flex items-center justify-center hover:bg-[#F4EFE6] transition-colors" aria-label={t("settingsTitle")}>
              <SettingsIcon className="w-4 h-4 text-[#111111]" />
            </button>
          </div>
        </div>
        <div className="md:hidden mt-2 flex">
          <button onClick={() => setOnAirMode((m) => (m === "live" ? "rehearsal" : "live"))} className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-[#111111] bg-white font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase shadow-[2px_2px_0_#111111]">
            <span className={`w-2 h-2 rounded-full border border-[#111111] ${onAirMode === "live" ? "bg-[#FF3B1D] bwq-onair-dot" : "bg-[#2563EB]"}`} />
            {onAirMode === "live" ? `ON AIR · ${liveRooms}R · ${livePlayers}P` : "REHEARSAL MODE"}
          </button>
        </div>
      </header>

      {/* ── B. CENTERPIECE HEADLINE & BUZZER DECK ── */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 sm:pt-10 lg:pt-12 pb-6 flex flex-col">
        <div className="max-w-[1150px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-[#111111] bg-[#FFD60A] font-mono text-[0.75rem] sm:text-[0.8125rem] font-bold tracking-[0.14em] uppercase shadow-[3px_3px_0_#111111] mb-5 sm:mb-6">
            <span className="w-2 h-2 bg-[#111111]" /> BROADCAST GAME SHOW STUDIO
          </div>

          <h1 style={{ fontFamily: "'Archivo Black', sans-serif", letterSpacing: "-0.02em", lineHeight: 0.98 }} className="uppercase font-normal text-[#111111] text-[clamp(2.75rem,5.2vw,4.5rem)]">
            <span className="block">BUZZ IN FAST.</span>
            <span className="block mt-1 sm:mt-2">
              <span className="inline-block bg-[#FFD60A] border-2 border-[#111111] px-2 sm:px-3 py-0.5 mr-2 sm:mr-4 shadow-[4px_4px_0_#111111]" style={{ transform: "rotate(-2deg)", lineHeight: 0.98 }}>STEAL</span>
              <span>THE BOARD.</span>
            </span>
          </h1>

          <p className="mt-5 max-w-[38rem] font-mono text-[0.875rem] font-bold tracking-[0.12em] uppercase leading-relaxed text-[#111111]/70">
            Host a room. Buzz in first. Take the points.
          </p>

          {/* Action Console */}
          <div className="mt-5 flex flex-col lg:flex-row gap-4 lg:items-stretch max-w-[980px]">
            <button
              onClick={() => { setLocalError(""); setCreateOpen(true); }}
              className="group flex items-center justify-center gap-3 px-7 sm:px-8 py-4 sm:py-5 bg-[#FF3B1D] text-white min-h-[68px] lg:self-stretch border-2 border-[#111111] shadow-[4px_4px_0_#111111] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111] transition-[transform,box-shadow] duration-150"
            >
              <span className="w-10 h-10 border-2 border-white/70 bg-[#111111]/10 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M13 2 4.5 13H11l-1 9 9.5-11H13z" /></svg>
              </span>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: "0.04em", fontSize: "1rem" }} className="uppercase">{t("hostAGame")}</span>
            </button>

            <div className="relative lg:self-stretch">
              <div className={`flex flex-col sm:flex-row items-stretch gap-0 min-h-[68px] h-full border-2 ${heroJoinError ? "border-[#FF3B1D] shadow-[4px_4px_0_#FF3B1D]" : "border-[#111111] shadow-[4px_4px_0_#111111]"} bg-white`}>
                <div className={`flex-1 flex items-center gap-3 px-4 sm:px-5 py-3 bg-white border-b-2 sm:border-b-0 sm:border-r-2 ${heroJoinError ? "border-[#FF3B1D]" : "border-[#111111]"}`}>
                  <span className="font-mono text-[0.75rem] font-bold tracking-[0.16em] text-[#111111]/55 uppercase shrink-0">ROOM CODE</span>
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={6}
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(e) => { setHeroJoinError(""); setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleHeroJoinCode(); } }}
                    className="w-full min-w-0 bg-transparent outline-none font-mono text-lg sm:text-xl font-bold tracking-[0.22em] uppercase text-[#111111] placeholder:text-[#111111]/25"
                    aria-label="Room code"
                    aria-invalid={!!heroJoinError}
                  />
                </div>
                <button
                  onClick={handleHeroJoinCode}
                  className="px-6 sm:px-7 py-3 sm:py-4 bg-[#FFFFFF] hover:bg-[#FFD60A] transition-colors flex items-center justify-center gap-2 uppercase text-[#111111] min-h-[56px] sm:min-h-0 sm:h-full sm:self-stretch"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: "0.04em", fontSize: "1rem" }}
                >
                  <LogIn className="w-4 h-4" /> {t("joinGame")}
                </button>
              </div>
              {heroJoinError && (
                <div
                  className="absolute right-3 z-20 px-3 py-1.5 bg-[#FF3B1D] text-white font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase border-2 border-[#111111] shadow-[2px_2px_0_#111111]"
                  style={{ top: "-14px", transform: "rotate(-1.5deg)" }}
                  role="status"
                  aria-live="polite"
                >
                  ! ENTER 6-CHAR CODE
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[0.75rem] font-bold tracking-[0.12em] uppercase text-[#111111]/65">
            <span className="px-2 py-1 border border-[#111111]/25 bg-white/60">{quizzes.length} QUIZ PACKS READY</span>
            <span className="px-2 py-1 border border-[#111111]/25 bg-white/60">{onAirMode === "live" ? "LIVE STUDIO MODE" : "REHEARSAL MODE"}</span>
            <span className="px-2 py-1 border border-[#111111]/25 bg-white/60">PRESS B TO BUZZ</span>
          </div>
        </div>

        {/* ── C. BOTTOM PLAYABLE MINI-BOARD STRIP ── */}
        <div className="mt-auto pt-10 sm:pt-12 lg:pt-14">
          {/* Studio Feed Marquee */}
          <div className="mb-6 border-y-2 border-[#111111] bg-[#111111] overflow-hidden flex items-stretch bwq-marquee w-screen relative left-1/2 -translate-x-1/2">
            <div className="shrink-0 bg-[#111111] px-4 py-2.5 flex items-center gap-2 border-r-2 border-[#F4EFE6]/20 z-10">
              <span className="w-2 h-2 rounded-full bg-[#FF3B1D] bwq-onair-dot" />
              <span className="font-mono text-[0.8125rem] font-bold tracking-[0.12em] uppercase text-[#FFD60A] whitespace-nowrap">STUDIO FEED</span>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden py-2.5">
              {(() => {
                const breakingItem = feedHeadlines.find((h) => /breaking/i.test(h.title));
                if (breakingHold && breakingItem) {
                  return (
                    <div className="px-4 flex items-center gap-3 min-w-0">
                      <span className="shrink-0 px-2 py-0.5 bg-[#FF3B1D] text-white font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase border border-[#FF3B1D]">Breaking</span>
                      <span className={`shrink-0 font-mono text-[0.8125rem] font-bold tracking-[0.08em] uppercase whitespace-nowrap ${breakingItem.tag === "INDIA" ? "text-[#FFD60A]" : "text-[#60A5FA]"}`}>[{breakingItem.tag}]</span>
                      <span className="font-mono text-[0.8125rem] font-bold tracking-[0.04em] uppercase text-[#F4EFE6] truncate">{breakingItem.title}</span>
                    </div>
                  );
                }
                return (
                  <div className="bwq-marquee-track items-center">
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex items-center shrink-0 pr-10">
                        {feedHeadlines.map((item, i) => (
                          <span key={`${copy}-${i}`} className="flex items-center shrink-0">
                            <span className={`font-mono text-[0.8125rem] font-bold tracking-[0.08em] uppercase whitespace-nowrap ${item.tag === "INDIA" ? "text-[#FFD60A]" : "text-[#60A5FA]"}`}>[{item.tag}]</span>
                            <span className="ml-2 font-mono text-[0.8125rem] font-bold tracking-[0.04em] uppercase text-[#F4EFE6] whitespace-nowrap">{item.title}</span>
                            <span className="mx-5 font-mono text-[0.8125rem] font-bold tracking-[0.08em] text-[#F4EFE6]/35">///</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="font-mono text-[0.75rem] font-bold tracking-[0.2em] uppercase text-[#111111]/55">Warmup Board</div>
              <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: "1.35rem", lineHeight: 1.1 }} className="uppercase tracking-[-0.02em] text-[#111111]">Flip a tile. Steal the points.</div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 border-2 border-[#111111] bg-white shadow-[3px_3px_0_#111111] font-mono text-[0.75rem] font-bold tracking-[0.12em] uppercase">
              <span className="text-[#111111]/55">Warmup Streak</span>
              <span className="text-[#00C271]">{warmupStreak}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {flipTiles.map((tile, idx) => {
              const flipped = !!flippedTiles[idx];
              const answered = answeredTiles[idx];
              return (
                <div key={idx} className="bwq-flip-card h-[210px] sm:h-[220px]">
                  <div className={`bwq-flip-inner ${flipped ? "is-flipped" : ""}`}>
                    <button
                      onClick={() => setFlippedTiles((p) => ({ ...p, [idx]: true }))}
                      className="bwq-flip-face w-full h-full text-left border-2 border-[#111111] bg-white p-4 sm:p-5 shadow-[4px_4px_0_#111111] hover:translate-y-[-2px] transition-transform flex flex-col justify-between"
                      aria-label={`Open ${tile.cat} for ${tile.value}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[0.75rem] font-bold tracking-[0.16em] uppercase text-[#111111]/60">{tile.cat}</span>
                        <span className="w-7 h-7 border-2 border-[#111111] bg-[#F4EFE6] flex items-center justify-center font-mono text-[0.75rem] font-bold">{idx + 1}</span>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }} className="text-[2.75rem] leading-none tracking-[-0.02em] text-[#111111] tabular-nums">{tile.value}</div>
                        <div className="mt-3 font-mono text-[0.75rem] font-bold tracking-[0.14em] uppercase text-[#FF3B1D]">Tap to reveal</div>
                      </div>
                    </button>

                    <div className="bwq-flip-face bwq-flip-back w-full h-full border-2 border-[#111111] bg-[#F4EFE6] p-4 sm:p-5 shadow-[4px_4px_0_#111111] flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-[0.75rem] font-bold tracking-[0.14em] uppercase text-[#111111]/60">{tile.cat} // {tile.value}</span>
                        {answered && <span className={`font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase px-2 py-0.5 border border-[#111111] ${answered === "correct" ? "bg-[#00C271] text-white" : "bg-[#FF3B1D] text-white"}`}>{answered === "correct" ? "CORRECT" : "TRY AGAIN"}</span>}
                      </div>
                      <p className="text-sm font-bold leading-snug text-[#111111] mb-3">{tile.q}</p>
                      <div className="mt-auto grid grid-cols-1 gap-2">
                        {tile.options.map((opt, oi) => {
                          const pickedCorrect = answered === "correct" && oi === tile.answer;
                          return (
                            <button
                              key={oi}
                              onClick={(e) => {
                                if (answered === "correct") return;
                                const correct = oi === tile.answer;
                                setAnsweredTiles((p) => ({ ...p, [idx]: correct ? "correct" : "wrong" }));
                                if (correct) {
                                  setWarmupStreak((s) => s + 1);
                                  soundManager.playCorrect();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  spawnConfetti(rect.left + rect.width / 2, rect.top);
                                } else {
                                  setWarmupStreak(0);
                                  soundManager.playWrong();
                                }
                              }}
                              className={`px-3 py-2 border-2 border-[#111111] font-mono text-[0.8125rem] font-bold tracking-[0.04em] uppercase text-left transition-colors ${pickedCorrect ? "bg-[#00C271] text-white" : "bg-white hover:bg-[#FFD60A] text-[#111111]"}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Test Buzzer */}
            <div className="h-[210px] sm:h-[220px] border-2 border-[#111111] bg-[#111111] text-[#F4EFE6] p-4 sm:p-5 shadow-[4px_4px_0_#111111] flex flex-col justify-between">
              <div>
                <div className="font-mono text-[0.75rem] font-bold tracking-[0.16em] uppercase text-[#FFD60A]">Test Buzzer</div>
                <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: "1.5rem", lineHeight: 1.1 }} className="mt-2 uppercase tracking-[-0.02em]">Hit it.<br />Beat it.</div>
                <p className="mt-3 text-xs font-semibold text-[#F4EFE6]/75 max-w-[18rem]">Smash the buzzer or press <span className="font-mono text-[#FFD60A]">B</span> for a reaction-time flash.</p>
              </div>
              <button
                onClick={() => {
                  const ms = 80 + Math.floor(Math.random() * 120);
                  setBuzzFlash({ ms, key: Date.now() });
                  setBestBuzzMs((prev) => (prev === null || ms < prev ? ms : prev));
                  soundManager.playBuzzer();
                  window.setTimeout(() => setBuzzFlash(null), 700);
                }}
                className="bwq-buzzer-btn bg-[#FF3B1D] text-white px-4 py-3 uppercase flex items-center justify-center gap-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: "0.04em", fontSize: "1rem" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
                BUZZ!
              </button>
              <div className="sm:hidden mt-3 font-mono text-[0.75rem] font-bold tracking-[0.12em] uppercase text-[#F4EFE6]/70">Warmup Streak: <span className="text-[#00C271]">{warmupStreak}</span></div>
            </div>
          </div>


        </div>
      </main>

      {/* Confetti bursts */}
      {confettiBursts.map((b) => (
        <div key={b.id} className="pointer-events-none fixed z-[70]" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 28 + (i % 3) * 14;
            const colors = ["#FF3B1D", "#FFD60A", "#00C271", "#2563EB", "#111111"];
            return (
              <span
                key={i}
                className="bwq-confetti-piece absolute block w-2.5 h-2.5 border border-[#111111]"
                style={{
                  background: colors[i % colors.length],
                  ["--cx" as any]: `${Math.cos(angle) * dist}px`,
                  ["--cy" as any]: `${Math.sin(angle) * dist - 20}px`,
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Overdrive badge */}
      <AnimatePresence>
        {overdrive && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }} className="fixed top-24 left-1/2 -translate-x-1/2 z-[65] px-5 py-3 bg-[#FFD60A] border-2 border-[#111111] shadow-[6px_6px_0_#111111] font-mono text-xs sm:text-sm font-bold tracking-[0.14em] uppercase text-[#111111]">
            DOUBLE POINTS UNLOCKED
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing modals preserved */}
      <AnimatePresence>
        {howToOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60 " onClick={() => setHowToOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className={`${modalPanel} max-w-md`} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setHowToOpen(false)} className={closeBtn} aria-label={t("close")}><X className="w-4 h-4" /></button>
              <h3 className="text-3xl font-display font-black text-[#111111] leading-tight pr-8 flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-inner"><Zap className="w-5 h-5 text-primary-accent" /></span>{t("howToPlay")}</h3>
              <p className="text-sm text-text-muted -mt-2">{t("howToPlayIntro")}</p>
              <div className="space-y-3">
                {howToSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-[#F4EFE6] border border-[#111111]/10">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-accent/20 to-secondary-accent/20 border border-[#111111]/15 flex items-center justify-center"><step.Icon className="w-5 h-5 text-primary-accent" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[#111111]"><span className="text-text-muted font-black mr-2">{i + 1}.</span>{step.title}</p>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAchievementsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60 " onClick={() => setShowAchievementsModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl glass-panel-heavy border border-[#111111]/20 shadow-2xl overflow-hidden bg-primary-bg/95" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-[#111111]/15 flex items-center justify-between bg-[#F4EFE6]">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <PlayerAvatar seed={myId} avatar={selectedAvatar || profile.avatar} name={profile.name || playerName || "Player"} size={52} className="rounded-2xl ring-2 ring-primary-accent shadow-lg" />
                    <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-primary-accent text-black text-xs font-mono font-bold border border-black shadow">L{level.level}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black text-[#111111] flex items-center gap-2">{profile.name || playerName || "Player"}'s Achievements</h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span className="text-amber-300 font-bold flex items-center gap-1"><Trophy className="w-3.5 h-3.5 fill-current text-amber-400" />{unlockedCount} of {ACHIEVEMENT_IDS.length} Unlocked</span>
                      <span>•</span>
                      <span className="text-primary-accent font-mono font-bold">{level.into} / {level.need} XP</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowAchievementsModal(false)} className={closeBtn} aria-label={t("close")}><X className="w-5 h-5" /></button>
              </div>
              <div className="px-6 py-4 bg-[#F4EFE6] border-b border-[#111111]/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-[#F4EFE6] border border-[#111111]/10"><p className="text-[0.75rem] uppercase font-bold text-text-muted">Games Played</p><p className="text-lg font-mono font-bold text-[#111111] mt-0.5">{profile.gamesPlayed}</p></div>
                <div className="p-3 rounded-2xl bg-[#F4EFE6] border border-[#111111]/10"><p className="text-[0.75rem] uppercase font-bold text-text-muted">Games Won</p><p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{profile.gamesWon}</p></div>
                <div className="p-3 rounded-2xl bg-[#F4EFE6] border border-[#111111]/10"><p className="text-[0.75rem] uppercase font-bold text-text-muted">Best Streak</p><p className="text-lg font-mono font-bold text-amber-400 mt-0.5">{profile.bestStreak}</p></div>
                <div className="p-3 rounded-2xl bg-[#F4EFE6] border border-[#111111]/10"><p className="text-[0.75rem] uppercase font-bold text-text-muted">Fastest Buzz</p><p className="text-lg font-mono font-bold text-indigo-400 mt-0.5">{profile.fastestBuzz ? `${(profile.fastestBuzz / 1000).toFixed(2)}s` : "—"}</p></div>
              </div>
              <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F4EFE6] border border-[#111111]/15">
                  <button onClick={() => setAchFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${achFilter === "all" ? "bg-primary-accent text-black shadow" : "text-text-muted hover:text-[#111111]"}`}>All ({ACHIEVEMENT_IDS.length})</button>
                  <button onClick={() => setAchFilter("unlocked")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${achFilter === "unlocked" ? "bg-emerald-500 text-[#111111] shadow" : "text-text-muted hover:text-[#111111]"}`}>Unlocked ({unlockedCount})</button>
                  <button onClick={() => setAchFilter("locked")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${achFilter === "locked" ? "bg-amber-500/80 text-black shadow" : "text-text-muted hover:text-[#111111]"}`}>Locked ({lockedCount})</button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ACHIEVEMENT_IDS.filter((id) => { const unlocked = !!profile.achievements[id]; if (achFilter === "unlocked") return unlocked; if (achFilter === "locked") return !unlocked; return true; }).map((id) => {
                  const unlocked = !!profile.achievements[id];
                  const Icon = ACHIEVEMENT_ICONS[id] || Trophy;
                  const secret = isSecretAchievement(id) && !unlocked;
                  const titleKey = achievementKey(id);
                  const descKey = `${titleKey}Desc`;
                  const hint = achievementHint(id, profile);
                  return (
                    <div key={id} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${unlocked ? "bg-gradient-to-br from-amber-500/10 via-primary-accent/5 to-white/5 border-amber-500/30 shadow-lg shadow-amber-500/5 hover:border-amber-500/50" : "bg-[#F4EFE6] border-[#111111]/15 opacity-75 hover:opacity-100 hover:border-[#111111]/25"}`}>
                      <div className="flex items-start gap-3.5">
                        <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border shadow-inner ${unlocked ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black border-amber-300 shadow-amber-500/20" : "bg-[#F4EFE6] text-[#111111]/50 border-[#111111]/15"}`}>{secret ? <Lock className="w-5 h-5" /> : <Icon className="w-5.5 h-5.5" />}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-sm text-[#111111] truncate">{secret ? "??? Secret Badge" : t(titleKey)}</h4>
                            {unlocked && <span className="shrink-0 text-[0.75rem] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Unlocked</span>}
                          </div>
                          <p className="text-xs text-text-muted mt-1 leading-snug">{secret ? "Earned through curious discovery & playful actions in game." : t(descKey)}</p>
                        </div>
                      </div>
                      {!unlocked && !secret && hint && <div className="mt-3 pt-2.5 border-t border-[#111111]/10 text-[0.8125rem] text-amber-300/80 font-medium flex items-start gap-1.5"><Sparkles className="w-3 h-3 shrink-0 text-amber-400 mt-[1px]" /><span>{t(hint.key, hint.params)}</span></div>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
