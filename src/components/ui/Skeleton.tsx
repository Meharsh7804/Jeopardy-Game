import React from "react";

interface SkeletonProps {
  className?: string;
  /** Render as a circle (avatar placeholder). */
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", circle = false }) => {
  return (
    <div
      className={`animate-pulse bg-[#E5DEC9] ${circle ? "rounded-full" : "rounded-lg"} ${className}`}
      aria-hidden
    />
  );
};

export default Skeleton;