import React, { useCallback, useState } from 'react';
import { momentBus } from '../delight/moments';
import { soundManager } from '../utils/sound';

const EGG_MESSAGES = [
  { icon: '', title: 'Voltage found!', subtitle: 'You tapped into the hidden current.' },
  { icon: '️', title: 'Secret signal', subtitle: 'The arena noticed your curiosity.' },
  { icon: '', title: 'Bonus life!', subtitle: 'Not really. But the vibe is immaculate.' },
  { icon: '', title: 'Easter egg!', subtitle: 'Curiosity is your power-up.' },
];

export const DynamicBackground: React.FC = () => {
  const [, setStarClicks] = useState(0);
  const [secretStarGone, setSecretStarGone] = useState(false);
  const [eggIndex, setEggIndex] = useState(0);

  const onSecretStar = useCallback(() => {
    setStarClicks((c) => {
      const next = c + 1;
      if (next >= 5) {
        const msg = EGG_MESSAGES[eggIndex % EGG_MESSAGES.length];
        setEggIndex((i) => i + 1);
        soundManager.playEgg?.();
        momentBus.emit({ icon: msg.icon, title: msg.title, subtitle: msg.subtitle, tone: 'celebrate' });
        setSecretStarGone(true);
        setTimeout(() => setSecretStarGone(false), 9000);
        return 0;
      }
      soundManager.playPop?.();
      return next;
    });
  }, [eggIndex]);

  const onMystery = useCallback(() => {
    const msg = EGG_MESSAGES[(eggIndex + 2) % EGG_MESSAGES.length];
    setEggIndex((i) => i + 1);
    soundManager.playEgg?.();
    momentBus.emit({ icon: msg.icon, title: msg.title, subtitle: msg.subtitle, tone: 'playful' });
  }, [eggIndex]);

  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute inset-0 bg-[#F4EFE6]" />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FFD60A]/10 to-transparent" />
      {!secretStarGone && (
        <button className="absolute pointer-events-auto text-[#111111]/15 hover:text-[#FF3B1D] transition-all hover:scale-150" style={{ right: '7%', top: '16%', fontSize: 20 }} onClick={onSecretStar} title=" "></button>
      )}
      <button className="absolute pointer-events-auto text-[#111111]/10 hover:text-[#2563EB] transition-all hover:scale-125" style={{ left: '5%', bottom: '14%', fontSize: 16 }} onClick={onMystery} title=" ">◈</button>
    </div>
  );
};

export default DynamicBackground;