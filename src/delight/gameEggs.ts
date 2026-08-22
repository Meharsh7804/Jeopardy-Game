import { useEffect } from "react";
import { momentBus } from "./moments";
import { soundManager } from "../utils/sound";

/**
 * Some room codes (the random 6-letter id) accidentally contain real words.
 * The first time a device sees one, it "speaks" — a witty, once-per-session
 * easter egg tied entirely to normal room creation/joining.
 */
const CODE_WORDS: Record<string, { icon: string; title: string; subtitle: string }> = {
  cat: { icon: "🐱", title: "A Cat Wandered In", subtitle: "The room code shelters a cat." },
  dog: { icon: "🐶", title: "Good Boy", subtitle: "A dog appeared in the code." },
  egg: { icon: "🥚", title: "Egg Detected", subtitle: "Something fragile is in the code." },
  fun: { icon: "🎉", title: "Fun Foretold", subtitle: "This code promises a good time." },
  win: { icon: "🏆", title: "Destiny Win", subtitle: "The code foretells a victory." },
  bug: { icon: "🐛", title: "Hitchhiker", subtitle: "A bug rode in on the code." },
  zap: { icon: "⚡", title: "Zappy Code", subtitle: "This code has a charge." },
  jam: { icon: "🍓", title: "Jam Session", subtitle: "A jam is encoded in the room." },
  lol: { icon: "😆", title: "The Code Laughs", subtitle: "Somebody tickled the generator." },
  pie: { icon: "🥧", title: "Pi(h) In The Sky", subtitle: "A pie is baked into the code." },
  ice: { icon: "🧊", title: "Ice Cold", subtitle: "Things are frosty in here." },
  sun: { icon: "☀️", title: "Sunny Code", subtitle: "The code caught some sun." },
  map: { icon: "🗺️", title: "The Code Is A Map", subtitle: "Follow the letters." },
  sea: { icon: "🌊", title: "Salty Code", subtitle: "This code smells of the sea." },
  sky: { icon: "🌌", title: "Sky Code", subtitle: "The code reaches the clouds." },
  xox: { icon: "💌", title: "Hugs Encoded", subtitle: "The code sends its love." },
};

let shownThisSession = false;

export const useRoomCodeWordEgg = (roomId?: string) => {
  useEffect(() => {
    if (!roomId || shownThisSession) return;
    const lower = roomId.toLowerCase();
    for (const [word, data] of Object.entries(CODE_WORDS)) {
      if (lower.includes(word)) {
        shownThisSession = true;
        soundManager.playEgg();
        momentBus.emit({ icon: data.icon, title: data.title, subtitle: data.subtitle, tone: "playful" });
        break;
      }
    }
  }, [roomId]);
};
