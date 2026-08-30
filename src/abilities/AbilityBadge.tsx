import React from "react";
import { Lock, Check } from "lucide-react";
import type { RoomPlayer } from "../types/jeopardy";
import { getAbilityForAvatar } from "./config";

const SKILL = "unlock after 2 correct · once per game";

/** Compact pill showing a player's ability state (locked / ready / fired). */
export const AbilityBadge: React.FC<{
  player: RoomPlayer;
  className?: string;
}> = ({ player, className = "" }) => {
  const ability = getAbilityForAvatar(player.abilityId);
  if (!ability) return null;

  const used = !!player.abilityUsed;
  const ready = !!player.abilityUnlocked && !used;

  return (
    <span
      title={used ? `${ability.abilityName} (used)` : ready ? `${ability.abilityName} — ${SKILL}` : `${ability.abilityName} — locked`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
        used
          ? "bg-white/5 border-white/10 text-text-muted"
          : ready
            ? "bg-warning-accent/15 border-warning-accent/40 text-warning-accent"
            : "bg-black/30 border-white/5 text-text-muted/60"
      } ${className}`}
    >
      <span className="text-[10px] leading-none">{ability.emoji}</span>
      {used ? <Check className="w-2.5 h-2.5" /> : !ready && <Lock className="w-2.5 h-2.5" />}
      <span className="hidden sm:inline">{ability.abilityName}</span>
    </span>
  );
};