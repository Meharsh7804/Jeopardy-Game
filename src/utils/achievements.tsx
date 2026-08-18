import { Trophy, Flame, Target, CalendarCheck, Zap, Coins, Award, Medal, Shield } from "lucide-react";
import type { AchievementId } from "./profile";

/** Icons for every achievement, shared across lobby, results and toasts. */
export const ACHIEVEMENT_ICONS: Record<AchievementId, typeof Trophy> = {
  firstWin: Trophy,
  onFire: Flame,
  sharpshooter: Target,
  regular: CalendarCheck,
  lightning: Zap,
  highRoller: Coins,
  flawless: Award,
  centurion: Medal,
  collector: Shield,
};
