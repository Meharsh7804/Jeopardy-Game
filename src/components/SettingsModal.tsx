import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Type, Gauge, Languages, Music, Check } from "lucide-react";
import { useSettings, type AnimationSpeed } from "../context/SettingsContext";
import { LANGS } from "../i18n";
import { soundManager, type SoundTheme } from "../utils/sound";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { settings, update, t } = useSettings();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-panel-heavy rounded-[2rem] p-8 max-w-md w-full space-y-7 relative border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all"
              aria-label={t("close")}
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-3xl font-display font-black text-white leading-tight pr-8 flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-inner">
                <Gauge className="w-5 h-5 text-primary-accent" />
              </span>
              {t("settingsTitle")}
            </h3>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Languages className="w-3.5 h-3.5" /> {t("language")}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => update({ language: l.code })}
                    className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      settings.language === l.code
                        ? "bg-primary-accent/20 border-primary-accent/50 text-white"
                        : "bg-white/5 border-white/5 text-text-muted hover:bg-white/10"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5" /> {t("sound")}
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => update({ isSoundMuted: !settings.isSoundMuted })}
                  className={`p-3 rounded-xl border transition-all ${
                    settings.isSoundMuted
                      ? "bg-danger-accent/15 border-danger-accent/40 text-danger-accent"
                      : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                  }`}
                  aria-label={settings.isSoundMuted ? t("unmute") : t("mute")}
                >
                  {settings.isSoundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.soundVolume * 100)}
                  onChange={(e) => update({ soundVolume: Number(e.target.value) / 100 })}
                  disabled={settings.isSoundMuted}
                  className="flex-1 accent-primary-accent"
                  aria-label={t("volume")}
                />
                <span className="text-sm font-bold text-white w-10 text-right">
                  {settings.isSoundMuted ? "0" : Math.round(settings.soundVolume * 100)}
                </span>
              </div>
            </div>

            <button
              onClick={() => update({ largeFontMode: !settings.largeFontMode })}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                settings.largeFontMode
                  ? "bg-primary-accent/15 border-primary-accent/40"
                  : "bg-white/5 border-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <span className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <Type className="w-5 h-5 text-secondary-accent" />
                </span>
                <div>
                  <p className="font-bold text-sm text-white">{t("largeFont")}</p>
                  <p className="text-[11px] text-text-muted">{t("largeFontSub")}</p>
                </div>
              </div>
              <span
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                  settings.largeFontMode
                    ? "bg-primary-accent border-primary-accent text-white"
                    : "border-white/20"
                }`}
              >
                {settings.largeFontMode && <Check className="w-3.5 h-3.5" />}
              </span>
            </button>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Music className="w-3.5 h-3.5" /> {t("soundTheme")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["classic", "arcade", "retro"] as SoundTheme[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      update({ soundTheme: s });
                      soundManager.playBuzzer();
                    }}
                    className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      settings.soundTheme === s
                        ? "bg-secondary-accent/20 border-secondary-accent/50 text-white"
                        : "bg-white/5 border-white/5 text-text-muted hover:bg-white/10"
                    }`}
                  >
                    {t(`theme${s[0].toUpperCase()}${s.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                {t("animationSpeed")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["slow", "normal", "fast"] as AnimationSpeed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ animationSpeed: s })}
                    className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      settings.animationSpeed === s
                        ? "bg-secondary-accent/20 border-secondary-accent/50 text-white"
                        : "bg-white/5 border-white/5 text-text-muted hover:bg-white/10"
                    }`}
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};