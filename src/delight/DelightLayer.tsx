import React from "react";
import { MomentToast } from "./moments";
import { GlobalConfetti } from "./celebrate";
import { useGlobalSecrets } from "./secrets";

/**
 * Always-mounted delight UI: playful moment toasts + the global confetti
 * source + the global secret listener (keyboard combos, typed words).
 * Easter-egg triggers live in the screens where their gameplay happens
 * (board, buzzer, room code), not here.
 */
export const DelightLayer: React.FC = () => {
  useGlobalSecrets();
  return (
    <>
      <MomentToast />
      <GlobalConfetti />
    </>
  );
};
