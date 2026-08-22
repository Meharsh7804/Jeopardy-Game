import React from "react";
import { MomentToast } from "./moments";
import { GlobalConfetti } from "./celebrate";

/**
 * Always-mounted delight UI: playful moment toasts + the global confetti
 * source. Easter-egg triggers live in the screens where their gameplay
 * happens (board, buzzer, room code), not here.
 */
export const DelightLayer: React.FC = () => {
  return (
    <>
      <MomentToast />
      <GlobalConfetti />
    </>
  );
};
