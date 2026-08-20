import React, { useRef, useEffect } from "react";
import type { QuestionType } from "../../types/jeopardy";

interface MediaViewerProps {
  url: string;
  type?: QuestionType;
  className?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLMediaElement | HTMLImageElement>) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  url,
  type,
  className = "w-full h-full object-contain",
  autoPlay = true,
  onEnded,
  onError,
}) => {
  const isAudio = type === "audio" || url.startsWith("data:audio") || url.match(/\.(mp3|wav|ogg)$/i);
  const isVideo = type === "video" || url.startsWith("data:video") || url.match(/\.(mp4|webm|ogg)$/i);

  const mediaRef = useRef<HTMLMediaElement>(null);

  useEffect(() => {
    if (autoPlay && mediaRef.current) {
      mediaRef.current.play().catch(() => {
        // Autoplay may be blocked by browser policies if the user hasn't interacted
        // with the document yet. This is handled gracefully by ignoring the rejection.
      });
    }
  }, [url, autoPlay]);

  if (isAudio) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/60 p-4">
        <audio
          ref={mediaRef as any}
          src={url}
          controls
          className="w-full"
          onEnded={onEnded}
          onError={onError}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        ref={mediaRef as any}
        src={url}
        controls
        playsInline
        className={className}
        onEnded={onEnded}
        onError={onError}
      />
    );
  }

  // Fallback to image
  return <img src={url} alt="Media" className={className} onError={onError} />;
};
