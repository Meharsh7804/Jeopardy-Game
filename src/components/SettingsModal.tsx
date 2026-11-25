import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX } from "lucide-react";
import { useSettings, type AnimationSpeed } from "../context/SettingsContext";
import { LANGS } from "../i18n";
import { soundManager, type SoundTheme } from "../utils/sound";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { settings, update, t } = useSettings();
  const volPct = Math.round(settings.soundVolume * 100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="max-w-2xl w-full bg-[#F4EFE6] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] rounded-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="bg-[#111111] text-[#FFFFFF] px-5 py-3.5 flex items-center justify-between border-b-2 border-[#111111]">
              <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-base sm:text-lg tracking-wide uppercase">
                ⚙ Studio Calibration // Settings
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 bg-[#FF3B1D] text-[#FFFFFF] border-2 border-[#FFFFFF] flex items-center justify-center font-black hover:bg-[#FFD60A] hover:text-[#111111] transition-colors"
                aria-label={t("close")}
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            {/* 2-COLUMN CONTROL DECK */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-[#111111]">
              {/* LEFT: AUDIO & ACCESSIBILITY */}
              <div className="p-5 flex flex-col gap-5 bg-[#FFFFFF]">
                <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#111111]/50">01 // Audio &amp; Accessibility</div>

                {/* Master Volume */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111]">Master Audio</span>
                    <span className="font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111]/70">
                      {settings.isSoundMuted ? "MUTED" : `${volPct}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => update({ isSoundMuted: !settings.isSoundMuted })}
                      className={`w-10 h-10 border-2 border-[#111111] flex items-center justify-center shrink-0 transition-colors ${settings.isSoundMuted ? "bg-[#FF3B1D] text-white" : "bg-[#F4EFE6] text-[#111111] hover:bg-[#FFD60A]/30"}`}
                      aria-label={settings.isSoundMuted ? t("unmute") : t("mute")}
                    >
                      {settings.isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 relative h-6 flex items-center">
                      <div className="absolute inset-x-0 h-4 bg-[#F4EFE6] border-2 border-[#111111]" />
                      <div className="absolute left-0 h-4 bg-[#FFD60A] border-y-2 border-l-2 border-[#111111]" style={{ width: `${settings.isSoundMuted ? 0 : volPct}%`, maxWidth: "100%" }} />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={volPct}
                        onChange={(e) => update({ soundVolume: Number(e.target.value) / 100 })}
                        disabled={settings.isSoundMuted}
                        className="bwq-fader absolute inset-0 w-full h-6 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        aria-label={t("volume")}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-[18px] h-6 bg-[#111111] border border-[#111111] pointer-events-none"
                        style={{ left: `calc(${settings.isSoundMuted ? 0 : volPct}% - 9px)` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sound Theme */}
                <div className="space-y-2.5">
                  <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111] block">SFX Sound Pack</span>
                  <div className="grid grid-cols-3 border-2 border-[#111111] divide-x-2 divide-[#111111]">
                    {(["classic", "arcade", "retro"] as SoundTheme[]).map((s) => {
                      const active = settings.soundTheme === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { update({ soundTheme: s }); soundManager.playBuzzer(); }}
                          className={`py-2.5 font-mono text-[0.6875rem] font-bold tracking-[0.06em] uppercase transition-colors ${active ? "bg-[#FFD60A] text-[#111111] font-black" : "bg-[#FFFFFF] text-[#111111] hover:bg-[#F4EFE6]"}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Large Font Toggle */}
                <button
                  type="button"
                  onClick={() => update({ largeFontMode: !settings.largeFontMode })}
                  className="w-full p-3.5 bg-[#F4EFE6] border-2 border-[#111111] flex items-center justify-between gap-4 cursor-pointer text-left hover:bg-[#efe7d3] transition-colors"
                >
                  <div>
                    <p className="font-bold text-[0.8125rem] uppercase tracking-[0.02em] text-[#111111]">Large Font Mode</p>
                    <p className="text-xs text-[#111111]/60 mt-0.5">High-legibility broadcast text</p>
                  </div>
                  <div className={`w-14 h-7 border-2 border-[#111111] p-0.5 flex items-center shrink-0 transition-colors ${settings.largeFontMode ? "bg-[#00C271] justify-end" : "bg-[#FFFFFF] justify-start"}`}>
                    <div className="w-5 h-5 bg-[#111111]" />
                  </div>
                </button>
              </div>

              {/* RIGHT: SHOW PACING & LOCALE */}
              <div className="p-5 flex flex-col gap-5 bg-[#F4EFE6]">
                <div className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#111111]/50">02 // Show Pacing &amp; Locale</div>

                {/* Question Timer */}
                <div className="space-y-2.5">
                  <div>
                    <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111] block">Shot Clock / Timer</span>
                    <span className="text-[0.6875rem] text-[#111111]/55 block mt-0.5">Auto-closes clue when timer hits 00</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 15, 20, 30, 45, 60].map((s) => {
                      const active = settings.questionTimerSeconds === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => update({ questionTimerSeconds: s })}
                          className={`py-2 border-2 border-[#111111] font-mono font-bold text-xs tracking-[0.04em] uppercase transition-colors ${active ? "bg-[#FFD60A] text-[#111111] shadow-[2px_2px_0_#111111]" : "bg-[#FFFFFF] text-[#111111] hover:bg-[#FFD60A]/30"}`}
                        >
                          {s === 0 ? "OFF" : `${s}S`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Animation Speed */}
                <div className="space-y-2.5">
                  <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111] block">Stage Animation Speed</span>
                  <div className="grid grid-cols-3 border-2 border-[#111111] divide-x-2 divide-[#111111]">
                    {(["slow", "normal", "fast"] as AnimationSpeed[]).map((s) => {
                      const active = settings.animationSpeed === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => update({ animationSpeed: s })}
                          className={`py-2.5 font-mono text-[0.6875rem] font-bold tracking-[0.06em] uppercase transition-colors ${active ? "bg-[#FFD60A] text-[#111111] font-black" : "bg-[#FFFFFF] text-[#111111] hover:bg-[#F4EFE6]"}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-2.5">
                  <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111] block">Console Language</span>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGS.map((l) => {
                      const active = settings.language === l.code;
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => update({ language: l.code })}
                          className={`py-2 border-2 border-[#111111] text-xs font-bold tracking-[0.04em] uppercase transition-colors ${active ? "bg-[#111111] text-[#FFD60A]" : "bg-[#FFFFFF] text-[#111111] hover:bg-[#FFD60A]/30"}`}
                        >
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM BAR */}
            <div className="border-t-2 border-[#111111] bg-[#FFFFFF] px-5 py-3.5 flex items-center justify-between gap-4">
              <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#111111]/45">Auto-saved to studio console</span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#111111] text-[#FFFFFF] hover:bg-[#FFD60A] hover:text-[#111111] border-2 border-[#111111] font-bold text-xs tracking-wider uppercase transition-colors"
                style={{ fontFamily: "'Archivo Black', sans-serif" }}
              >
                DONE &amp; LOCK IN ✓
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};