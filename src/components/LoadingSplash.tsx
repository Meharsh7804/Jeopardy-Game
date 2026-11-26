import React from "react";
import { motion } from "framer-motion";
import { Radio, RefreshCw, Zap } from "lucide-react";

interface LoadingSplashProps {
  message?: string;
}

const fuseColors = ["#FFD60A", "#FF3B1D", "#E6E0D4", "#FFD60A", "#E6E0D4"];

export const LoadingSplash: React.FC<LoadingSplashProps> = ({ message }) => {
  const extraStatus = message && !/restoring your session/i.test(message)
    ? message
    : null;

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-[#F4EFE6] text-[#111111]"
      style={{
        backgroundImage:
          "linear-gradient(to right, #E6E0D4 1px, transparent 1px), linear-gradient(to bottom, #E6E0D4 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <header className="h-12 w-full shrink-0 bg-[#FF3B1D] text-[#FFFFFF] border-b-2 border-[#111111] flex items-center justify-between gap-3 px-4 sm:px-6 font-mono text-xs sm:text-sm font-black tracking-wide uppercase">
        <span className="min-w-0"> RECONNECTING TO GAME SERVER... YOUR BUZZ &amp; SCORE ARE SAFE.</span>
        <RefreshCw className="w-5 h-5 shrink-0 animate-spin" aria-label="Retrying connection" />
      </header>

      <main className="flex-1 w-full flex items-center justify-center px-4 py-8">
        <section className="max-w-lg w-full bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[10px_10px_0px_#111111] rounded-none overflow-hidden flex flex-col">
          <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center gap-2 font-mono text-xs font-black uppercase shrink-0">
            <Radio className="w-4 h-4 text-[#FFD60A] shrink-0" />
            <span>Signal Interrupted // Broadcast Data Recovery</span>
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-5 bg-[#FFFFFF]">
            <div className="relative w-20 h-20 bg-[#FFD60A] border-[3px] border-[#111111] shadow-[4px_4px_0px_#111111] flex items-center justify-center rounded-none shrink-0">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#111111] text-[#FFFFFF] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider border border-[#111111] whitespace-nowrap">
                Signal Lost
              </span>
              <Zap className="w-12 h-12 text-[#111111] fill-[#111111]" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="font-['Archivo_Black'] text-3xl sm:text-4xl uppercase tracking-tighter leading-none text-[#111111]">
                Restoring Your Session
              </h1>
              <p className="font-mono text-xs font-extrabold tracking-widest text-[#111111]/70 mt-1">
                STAND BY • RETRIEVING DATA
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 mt-2" role="status" aria-label="Restoring connection">
              {fuseColors.map((color, index) => (
                <motion.span
                  key={index}
                  aria-hidden="true"
                  className="w-5 h-5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] rounded-none"
                  initial={{ backgroundColor: "#E6E0D4" }}
                  animate={{ backgroundColor: [color, "#E6E0D4", color] }}
                  transition={{
                    duration: 1.2,
                    delay: index * 0.18,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            <div className="mt-1 font-mono text-[10px] sm:text-xs font-black tracking-widest uppercase flex flex-col gap-0.5 text-center">
              <span>● ATTEMPTING RE-CONNECT</span>
              <span>⌛ RETRIEVING PROFILE AND SCORE DATA</span>
              {extraStatus && <span className="text-[#111111]/65">{extraStatus}</span>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoadingSplash;
