import { Trophy, Flame, Target, CalendarCheck, Zap, Coins, Award, Medal, Shield, GraduationCap, Gauge, Snowflake, Gamepad2, Swords, Hand, Undo2, Egg, Volume2, Dices, Star } from "lucide-react";
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
  theProfessor: GraduationCap,
  speedDemon: Gauge,
  brainFreeze: Snowflake,
  buttonMasher: Gamepad2,
  onePointWonder: Swords,
  clutchMaster: Hand,
  comebackKid: Undo2,
  eggHunter: Egg,
  buzzWhisperer: Volume2,
  riskTaker: Dices,
  perfectRound: Star,
};
