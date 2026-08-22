import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import type { Category, Question } from "../types/jeopardy";

interface MindMapBoardProps {
  categories: Category[];
  completedQuestions?: Record<string, boolean>;
  onOpenQuestion?: (q: Question, catName: string) => void;
  onCategoryInfo?: (catId: string) => void;
  readOnly?: boolean;
  columns: number;
  minColWidth?: number;
}

interface Connector {
  d: string;
  color: string;
  key: string;
}

const BRANCH_COLORS = ["#211d17", "#a23b27", "#2f5d86", "#b06a2c", "#3f6f53"];

/**
 * Renders the Jeopardy board as a "knowledge map": a central brain node
 * grows a hand-drawn branch toward each category, and every question is a
 * knowledge node hung along that branch. Connectors are measured from the
 * real DOM so they stay glued to the columns at any size.
 */
export const MindMapBoard: React.FC<MindMapBoardProps> = ({
  categories,
  completedQuestions = {},
  onOpenQuestion,
  onCategoryInfo,
  readOnly = false,
  columns,
  minColWidth = 120,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const brainRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const measure = () => {
    const wrap = wrapRef.current;
    const brain = brainRef.current;
    if (!wrap || !brain) return;
    const wb = wrap.getBoundingClientRect();
    const bb = brain.getBoundingClientRect();
    const bx = bb.left + bb.width / 2 - wb.left;
    const by = bb.top + bb.height - wb.top;

    const next: Connector[] = [];
    categories.forEach((cat, i) => {
      const el = headerRefs.current[cat.id];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2 - wb.left;
      const y = r.top - wb.top;
      const dx = x - bx;
      const cp1x = bx + dx * 0.15;
      const cp2x = x - dx * 0.15;
      const d = `M ${bx} ${by} C ${cp1x} ${by + (y - by) * 0.55}, ${cp2x} ${y - (y - by) * 0.45}, ${x} ${y}`;
      next.push({
        d,
        color: BRANCH_COLORS[i % BRANCH_COLORS.length],
        key: cat.id,
      });
    });
    setConnectors(next);
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  useEffect(() => {
    const t = setTimeout(measure, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = categories[0]?.questions.length ?? 5;

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      style={{
        minWidth: categories.length > 6 ? `${categories.length * (minColWidth + 8)}px` : undefined,
      }}
    >
      <svg className="absolute w-0 h-0" aria-hidden>
        <filter id="brainRough">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
        </filter>
      </svg>

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ overflow: "visible" }}
        aria-hidden
      >
        {connectors.map((c) => {
          const parts = c.d.split(" ").slice(-2);
          return (
            <g key={c.key} filter="url(#brainRough)">
              <path d={c.d} fill="none" stroke={c.color} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
              <circle cx={parts[0]} cy={parts[1]} r={3.2} fill={c.color} />
            </g>
          );
        })}
      </svg>

      <div className="flex flex-col items-center mb-2 relative z-20">
        <div ref={brainRef} className="node-red relative flex items-center justify-center" style={{ width: 76, height: 76 }}>
          <BrainDoodle />
        </div>
        <span className="hand text-ink-muted text-base -mt-1">the mind map</span>
      </div>

      <div className="grid gap-2 relative z-10" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            type="button"
            ref={(el) => {
              headerRefs.current[cat.id] = el;
            }}
            onClick={() => onCategoryInfo?.(cat.id)}
            className="drawn px-2 py-2.5 text-center font-display font-black text-[11px] uppercase tracking-wide min-h-[3.6rem] flex flex-col items-center justify-center gap-1 transition hover:-translate-y-0.5 group"
            style={{ borderColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
          >
            <span className="leading-tight group-hover:opacity-70 transition-opacity" style={{ color: BRANCH_COLORS[i % BRANCH_COLORS.length] }}>
              {cat.name}
            </span>
            <span className="hr-ink w-10 opacity-70" />
            {cat.description?.trim() && (
              <Info className="w-3 h-3 mt-0.5" style={{ color: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
            )}
          </button>
        ))}

        {Array.from({ length: rows }).map((_, rowIdx) =>
          categories.map((cat) => {
            const q = cat.questions[rowIdx];
            if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
            const done = !!completedQuestions[q.id];
            return (
              <motion.button
                layoutId={readOnly ? undefined : `q-${q.id}`}
                key={q.id}
                disabled={readOnly || done}
                onClick={() => onOpenQuestion?.(q, cat.name)}
                whileHover={!readOnly && !done ? { scale: 1.06, y: -3 } : {}}
                whileTap={!readOnly && !done ? { scale: 0.94 } : {}}
                className={`node-red p-3 font-display font-black text-center flex items-center justify-center min-h-[4.6rem] transition-all ${
                  done
                    ? "opacity-25 grayscale cursor-not-allowed"
                    : "cursor-pointer text-red-deep hover:shadow-[3px_4px_0_rgba(162,59,39,0.25)]"
                }`}
              >
                {done ? (
                  <span className="hand text-ink line-through opacity-60">done</span>
                ) : (
                  <span className="hand-lg">${q.value}</span>
                )}
              </motion.button>
            );
          }),
        )}
      </div>
    </div>
  );
};

const BrainDoodle: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 64 64" fill="none" aria-hidden>
    <path
      d="M24 12c-6 0-10 4-10 10-5 2-7 7-5 12-2 4 0 9 5 11 1 5 6 8 11 7 3 3 9 3 12 0 5 1 11-2 12-7 4-2 6-7 4-11 2-5-1-10-6-12 0-6-5-10-11-10-1 0-2 0-3 .2"
      stroke="#a23b27"
      strokeWidth="2.4"
      strokeLinejoin="round"
      fill="rgba(162,59,39,0.06)"
    />
    <path d="M32 14v36M20 24c4 2 6 5 6 9s-2 7-6 9M44 24c-4 2-6 5-6 9s2 7 6 9M27 20c2 4 2 8 0 12M37 20c-2 4-2 8 0 12" stroke="#2f5d86" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M14 32l5-2M50 32l-5-2" stroke="#b06a2c" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
