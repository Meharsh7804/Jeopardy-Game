import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { X, Copy, Check, Smartphone } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

interface QrJoinModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
}

/**
 * Modal showing a QR code that encodes the join URL (?join=CODE). Scanning it
 * opens the app with the room code pre-filled on the join tab.
 */
export const QrJoinModal: React.FC<QrJoinModalProps> = ({ open, onClose, roomId }) => {
  const { t } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const joinUrl = `${window.location.origin}/?join=${roomId}`;

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 216,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#030712", light: "#ffffff" },
    }).catch(() => {});
  }, [open, joinUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-panel-heavy rounded-[2rem] p-8 max-w-sm w-full space-y-6 relative border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all"
              aria-label={t("close")}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-secondary-accent/20 flex items-center justify-center border border-secondary-accent/30 shadow-inner">
                <Smartphone className="w-5 h-5 text-secondary-accent" />
              </span>
              <div>
                <h3 className="text-2xl font-display font-black text-white leading-tight">{t("qrJoin")}</h3>
                <p className="text-xs text-text-muted mt-0.5">{t("roomCode")}: {roomId}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-3xl shadow-[0_0_40px_rgba(99,102,241,0.25)]">
                <canvas ref={canvasRef} className="w-[216px] h-[216px]" />
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white hover:bg-white/10 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-success-accent" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy join link"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};