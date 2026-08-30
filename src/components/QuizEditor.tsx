import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Quiz, Category, Question, QuestionType } from "../types/jeopardy";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import {
  Save,
  FileJson,
  FileSpreadsheet,
  Trash,
  Upload,
  X,
  Check,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Image as ImageIcon,
  Type,
  Layout,
  AlertCircle,
  BookOpen,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from "lucide-react";

interface QuizEditorProps {
  quizToEdit: Quiz | null;
  onClose: () => void;
}

const makeQ = (id: string, value: number): Question => ({
  id,
  text: "",
  answer: "",
  value,
  type: "text",
});

const makeCat = (id: string, name: string): Category => ({
  id,
  name,
  description: "",
  questions: [100, 200, 300, 400, 500].map((v) => makeQ(`q-${id}-${v}`, v)),
});

export const QuizEditor: React.FC<QuizEditorProps> = ({
  quizToEdit,
  onClose,
}) => {
  const { saveQuiz, deleteQuiz } = useQuizLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quiz, setQuiz] = useState<Quiz>(() => {
    if (quizToEdit) return JSON.parse(JSON.stringify(quizToEdit));
    const newId = `quiz-${Math.random().toString(36).slice(2, 9)}`;
    return {
      id: newId,
      title: "New Quiz Pack",
      description: "Custom trivia board",
      categories: [], // Starts empty, let user add categories
      createdAt: Date.now(),
      password: "",
    };
  });

  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLocked, setPasswordLocked] = useState(() => {
    // If editing a quiz that already has a password, start locked until verified
    return !!(quizToEdit?.password && quizToEdit.password.trim());
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Auto-save debounce
  useEffect(() => {
    if (!quiz.title.trim() && quiz.categories.length === 0) return; // Don't auto-save empty new quizzes instantly
    const t = setTimeout(() => {
      saveQuiz(quiz)
        .then(() => setSaveFailed(false))
        .catch(() => setSaveFailed(true));
    }, 1200);
    return () => clearTimeout(t);
  }, [quiz, saveQuiz]);

  const setField = <K extends keyof Quiz>(k: K, v: Quiz[K]) =>
    setQuiz((p) => ({ ...p, [k]: v }));

  const addCategory = () => {
    const name = window.prompt(
      "Enter category name (or leave blank for default):",
    );
    if (name === null) return; // cancelled

    const finalName = name.trim() || `Category ${quiz.categories.length + 1}`;
    const newCat = makeCat(
      `cat-${Math.random().toString(36).slice(2, 9)}`,
      finalName,
    );

    setQuiz((p) => ({ ...p, categories: [...p.categories, newCat] }));
    setActiveCatIdx(quiz.categories.length);
  };

  const editCategoryName = (idx: number) => {
    const currentName = quiz.categories[idx].name;
    const name = window.prompt("Edit category name:", currentName);
    if (name !== null && name.trim()) {
      setQuiz((p) => {
        const c = [...p.categories];
        c[idx] = { ...c[idx], name: name.trim() };
        return { ...p, categories: c };
      });
    }
  };

  const removeCategory = (idx: number) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this entire category and its questions?",
      )
    )
      return;
    setQuiz((p) => {
      const c = [...p.categories];
      c.splice(idx, 1);
      return { ...p, categories: c };
    });
    if (activeCatIdx >= idx && activeCatIdx > 0) {
      setActiveCatIdx(activeCatIdx - 1);
    }
  };

  const setCatDescription = (idx: number, description: string) =>
    setQuiz((p) => {
      const c = [...p.categories];
      c[idx] = { ...c[idx], description };
      return { ...p, categories: c };
    });

  const setQ = (
    catIdx: number,
    qIdx: number,
    field: keyof Question,
    val: any,
  ) =>
    setQuiz((p) => {
      const cats = JSON.parse(JSON.stringify(p.categories));
      cats[catIdx].questions[qIdx][field] = val;
      return { ...p, categories: cats };
    });

  const swapCats = (a: number, b: number) => {
    if (b < 0 || b >= quiz.categories.length) return;
    setQuiz((p) => {
      const cats = [...p.categories];
      [cats[a], cats[b]] = [cats[b], cats[a]];
      return { ...p, categories: cats };
    });
    setActiveCatIdx(b);
  };

  const clearQ = (catIdx: number, qIdx: number) => {
    if (!window.confirm("Clear this question?")) return;
    setQ(catIdx, qIdx, "text", "");
    setQ(catIdx, qIdx, "answer", "");
    setQ(catIdx, qIdx, "mediaUrl", undefined);
    setQ(catIdx, qIdx, "type", "text");
    setQ(catIdx, qIdx, "isDailyDouble", false);
  };

  // Reads the file as a self-contained base64 data URL (blob: URLs only exist
  // in the browser that created them, so players on other devices could never
  // load images saved that way). Oversized images are downscaled/re-encoded so
  // the stored string stays small enough for Firebase RTDB and realtime sync.
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.onload = () => {
        const original = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1280;
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          // Already small and not oversized — keep the original untouched
          // (preserves PNG transparency for small logos/icons).
          if (file.size <= 300 * 1024 && scale === 1) {
            resolve(original);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(original);
            return;
          }
          // JPEG has no alpha channel — white background for transparent PNGs.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          resolve(dataUrl.length < original.length ? dataUrl : original);
        };
        img.onerror = () => reject(new Error("Unable to read image."));
        img.src = original;
      };
      reader.readAsDataURL(file);
    });

  const handleMediaUpload = async (
    catIdx: number,
    qIdx: number,
    file: File,
  ) => {
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isAudio && !isVideo) {
      alert("Please select an image, audio, or video file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Media must be under 10 MB.");
      return;
    }

    try {
      let dataUrl: string;
      if (isImage) {
        dataUrl = await compressImage(file);
      } else {
        // For audio/video, just read as base64 without compression
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Unable to read media."));
          reader.readAsDataURL(file);
        });
      }
      setQ(catIdx, qIdx, "mediaUrl", dataUrl);
    } catch {
      alert("Unable to read media file.");
    }
  };

  const handleSave = () => {
    saveQuiz(quiz)
      .then(() => {
        setSaveFailed(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      })
      .catch(() => setSaveFailed(true));
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete "${quiz.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteQuiz(quiz.id);
    onClose();
  };

  const exportJson = () => {
    const a = document.createElement("a");
    a.href =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(quiz, null, 2));
    a.download = `${quiz.title.replace(/\s+/g, "_")}.json`;
    a.click();
  };

  const exportCsv = () => {
    let csv = "Category,Value,Type,Question,Answer,DailyDouble,Media\n";
    quiz.categories.forEach((cat) =>
      cat.questions.forEach((q) => {
        csv += `"${cat.name.replace(/"/g, '""')}",${q.value},"${q.type}","${q.text.replace(/"/g, '""')}","${q.answer?.replace(/"/g, '""') || ""}",${!!q.isDailyDouble},"${q.mediaUrl?.startsWith("data:") ? "[embedded]" : (q.mediaUrl ?? "")}"\n`;
      }),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${quiz.title.replace(/\s+/g, "_")}.csv`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const imported = JSON.parse(content);
          if (!imported.categories || !Array.isArray(imported.categories)) {
            throw new Error("Invalid JSON: Missing 'categories' array.");
          }
          const newQuiz = {
            ...quiz,
            title: imported.title || quiz.title,
            description: imported.description || quiz.description,
            categories: imported.categories.map((c: any) => ({
              id: c.id || `cat-${Math.random().toString(36).slice(2, 9)}`,
              name: c.name || "Imported Category",
              description: c.description || "",
              questions: (c.questions || []).map((q: any) => ({
                id: q.id || `q-${Math.random().toString(36).slice(2, 9)}`,
                text: q.text || "",
                answer: q.answer || "",
                value: q.value || 100,
                type: ["text", "image", "both"].includes(q.type)
                  ? q.type
                  : "text",
                mediaUrl: q.mediaUrl,
                isDailyDouble: !!q.isDailyDouble,
              })),
            })),
          };
          setQuiz(newQuiz);
          setActiveCatIdx(0);
        } else if (file.name.endsWith(".csv")) {
          // Simple CSV parser
          const lines = content
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
          if (lines.length <= 1)
            throw new Error("CSV file appears to be empty.");

          // Basic CSV regex matcher to handle quotes
          const regex = /"([^"]*)"|([^,]+)/g;
          const categoriesMap = new Map<string, Category>();

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols: string[] = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
              cols.push(match[1] !== undefined ? match[1] : match[2]);
            }
            if (cols.length < 5) continue;

            const catName = cols[0] || "Imported Category";
            if (!categoriesMap.has(catName)) {
              categoriesMap.set(catName, {
                id: `cat-${Math.random().toString(36).slice(2, 9)}`,
                name: catName,
                description: "",
                questions: [],
              });
            }
            const cat = categoriesMap.get(catName)!;
            cat.questions.push({
              id: `q-${Math.random().toString(36).slice(2, 9)}`,
              value: parseInt(cols[1]) || 100,
              type: (["text", "image", "both"].includes(cols[2])
                ? cols[2]
                : "text") as QuestionType,
              text: cols[3] || "",
              answer: cols[4] || "",
              isDailyDouble: cols[5] === "true",
              mediaUrl:
                cols[6] && cols[6] !== "[embedded]" ? cols[6] : undefined,
            });
          }

          const newCats = Array.from(categoriesMap.values());
          if (newCats.length === 0)
            throw new Error("No valid categories found in CSV.");

          setQuiz((p) => ({ ...p, categories: newCats }));
          setActiveCatIdx(0);
        } else {
          throw new Error(
            "Unsupported file type. Please upload a JSON or CSV file.",
          );
        }
      } catch (err: any) {
        setImportError(err.message || "Failed to parse file.");
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  if (passwordLocked) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-screen bg-primary-bg relative">
        <div className="absolute top-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary-accent/10 blur-[120px] rounded-full pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="glass-panel-heavy rounded-3xl p-10 max-w-md w-full flex flex-col items-center gap-6 shadow-2xl border border-white/10 relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning-accent to-amber-600 flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-black" />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-display font-black text-white">Password Protected</h2>
            <p className="text-text-muted text-sm mt-1">Enter the quiz password to edit <span className="font-bold text-white">{quizToEdit?.title}</span></p>
          </div>
          <div className="w-full space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (passwordInput === (quizToEdit?.password ?? "")) {
                      setPasswordLocked(false);
                    } else {
                      setPasswordError(true);
                    }
                  }
                }}
                placeholder="Enter password…"
                className={`w-full bg-black/40 border rounded-xl px-4 py-3 pr-12 text-sm text-white font-bold outline-none transition-all shadow-inner ${
                  passwordError ? "border-danger-accent focus:ring-1 focus:ring-danger-accent" : "border-white/10 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-danger-accent text-xs font-bold flex items-center gap-1.5">
                <X className="w-3 h-3" /> Incorrect password. Try again.
              </motion.p>
            )}
            <button
              onClick={() => {
                if (passwordInput === (quizToEdit?.password ?? "")) {
                  setPasswordLocked(false);
                } else {
                  setPasswordError(true);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl premium-btn font-bold text-base text-white shadow-lg"
            >
              <Unlock className="w-4 h-4" /> Unlock Editor
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted text-sm font-bold hover:bg-white/10 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6 min-h-screen bg-primary-bg relative">
      <div className="absolute top-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary-accent/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative z-10 border border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-accent to-secondary-accent flex items-center justify-center shadow-lg">
            <Layout className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-primary-accent uppercase tracking-widest mb-0.5">
              Quiz Studio
            </p>
            <h2 className="text-3xl font-display font-black text-white leading-tight">
              Quiz Editor
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".json,.csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition shadow-inner"
          >
            <Upload className="w-4 h-4" /> Import Quiz
          </button>

          <div className="h-6 w-px bg-white/10 hidden md:block mx-1" />

          <button
            onClick={exportJson}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-primary-accent hover:text-primary-hover hover:bg-white/10 transition shadow-inner"
          >
            <FileJson className="w-4 h-4" /> JSON
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-success-accent hover:text-emerald-400 hover:bg-white/10 transition shadow-inner"
          >
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>

          <div className="h-6 w-px bg-white/10 hidden md:block mx-1" />

          <button
            onClick={handleSave}
            className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl premium-btn transition shadow-lg ml-2"
          >
            {saveSuccess ? (
              <>
                <Check className="w-5 h-5" /> Saved
              </>
            ) : (
              <>
                <Save className="w-5 h-5" /> Save
              </>
            )}
          </button>
          <button
            onClick={onClose}
            title="Close editor"
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition shadow-inner ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {saveFailed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-danger-accent/10 border border-danger-accent/30 flex items-center gap-3 text-danger-accent shadow-md"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">Save failed — the quiz may be too large to sync. Try a smaller image.</p>
          <button
            onClick={() => setSaveFailed(false)}
            className="ml-auto p-1 hover:bg-danger-accent/20 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {importError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-danger-accent/10 border border-danger-accent/30 flex items-center gap-3 text-danger-accent shadow-md"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{importError}</p>
          <button
            onClick={() => setImportError(null)}
            className="ml-auto p-1 hover:bg-danger-accent/20 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Metadata */}
          <div className="glass-panel-heavy p-6 rounded-3xl space-y-4 shadow-xl border border-white/10">
            <h3 className="font-display font-bold text-lg text-white mb-2 flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary-accent" /> Quiz Details
            </h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                Title
              </label>
              <input
                value={quiz.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Awesome Trivia"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-primary-accent focus:ring-1 focus:ring-primary-accent transition-all shadow-inner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                Description
              </label>
              <textarea
                value={quiz.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="A fun trivia game for everyone"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none focus:border-primary-accent focus:ring-1 focus:ring-primary-accent transition-all shadow-inner resize-none"
              />
            </div>

            {/* Quiz Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-warning-accent uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Edit Password (optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={quiz.password ?? ""}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Leave blank for no password"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white font-bold outline-none focus:border-warning-accent focus:ring-1 focus:ring-warning-accent transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-text-muted ml-1">Anyone editing this quiz will need to enter this password.</p>
            </div>

            <div className="pt-4 border-t border-white/5 mt-4">
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold px-4 py-3 rounded-xl bg-danger-accent/10 border border-danger-accent/20 text-danger-accent hover:bg-danger-accent/20 transition"
              >
                <Trash className="w-4 h-4" /> Delete Entire Quiz
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="glass-panel-heavy p-6 rounded-3xl space-y-4 shadow-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-secondary-accent" />{" "}
                Categories
              </h3>
              <button
                onClick={addCategory}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary-accent hover:text-white transition px-2 py-1 rounded bg-primary-accent/10 hover:bg-primary-accent/20"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            <div className="space-y-3 custom-scrollbar max-h-[500px] overflow-y-auto pr-2">
              <AnimatePresence>
                {quiz.categories.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 border border-white/10 border-dashed rounded-2xl"
                  >
                    <p className="text-sm text-text-muted mb-3">
                      No categories yet.
                    </p>
                    <button
                      onClick={addCategory}
                      className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition border border-white/10"
                    >
                      Add First Category
                    </button>
                  </motion.div>
                )}
                {quiz.categories.map((cat, idx) => (
                  <motion.div
                    key={cat.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => setActiveCatIdx(idx)}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 cursor-pointer transition-all ${
                      activeCatIdx === idx
                        ? "bg-primary-accent/15 border-primary-accent/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span
                          className={`font-bold text-sm truncate ${activeCatIdx === idx ? "text-primary-accent" : "text-white"}`}
                        >
                          {cat.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            editCategoryName(idx);
                          }}
                          className="text-text-muted hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          style={{
                            opacity: activeCatIdx === idx ? 1 : undefined,
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div
                        className="flex gap-1 bg-black/30 rounded-lg p-0.5 border border-white/5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => swapCats(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-md text-text-muted disabled:opacity-30 hover:text-white hover:bg-white/10 transition"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => swapCats(idx, idx + 1)}
                          disabled={idx === quiz.categories.length - 1}
                          className="p-1.5 rounded-md text-text-muted disabled:opacity-30 hover:text-white hover:bg-white/10 transition"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeCategory(idx)}
                          className="p-1.5 rounded-md text-text-muted hover:text-danger-accent hover:bg-danger-accent/10 transition ml-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {activeCatIdx === idx && (
                      <textarea
                        value={cat.description ?? ""}
                        onChange={(e) => setCatDescription(idx, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        rows={2}
                        placeholder="Optional category description"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none placeholder:text-text-muted/50"
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right column — questions */}
        <div className="lg:col-span-8 space-y-6">
          {quiz.categories.length === 0 ? (
            <div className="glass-panel-heavy p-12 rounded-3xl text-center shadow-xl border border-white/10 min-h-[50vh] flex flex-col items-center justify-center">
              <BookOpen className="w-16 h-16 text-white/10 mb-4" />
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                No Categories Selected
              </h2>
              <p className="text-text-muted max-w-md mx-auto">
                Create a category on the left to start adding questions.
              </p>
            </div>
          ) : (
            <>
              <div className="glass-panel-heavy p-6 rounded-3xl bg-primary-accent/5 border border-primary-accent/20 flex items-center gap-4 shadow-lg">
                <div className="w-10 h-10 rounded-full bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30">
                  <Edit2 className="w-5 h-5 text-primary-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-primary-accent uppercase tracking-[0.24em] mb-0.5">
                    Currently Editing
                  </p>
                  <h3 className="font-display font-black text-2xl text-white leading-none">
                    {quiz.categories[activeCatIdx]?.name}
                  </h3>
                </div>
              </div>

              <div className="space-y-6">
                {quiz.categories[activeCatIdx]?.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 shadow-lg bg-white/[0.01]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning-accent to-amber-600 flex flex-col items-center justify-center shadow-lg text-black">
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-80">
                            Q {qIdx + 1}
                          </p>
                          <p className="text-xl font-display font-black leading-none mt-1">
                            {q.value}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            Question Details
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Keep it concise and clear.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-black/30 p-1.5 rounded-xl border border-white/5">
                        <button
                          onClick={() => clearQ(activeCatIdx, qIdx)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-text-muted hover:text-danger-accent hover:bg-danger-accent/10 transition"
                          title="Clear question"
                        >
                          <Trash className="w-4 h-4" /> Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-primary-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Type className="w-3 h-3" /> Question Text
                        </label>
                        <textarea
                          value={q.text}
                          onChange={(e) =>
                            setQ(activeCatIdx, qIdx, "text", e.target.value)
                          }
                          rows={4}
                          placeholder="What is the capital of..."
                          className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white font-medium outline-none resize-none focus:border-primary-accent focus:ring-1 focus:ring-primary-accent transition-all shadow-inner placeholder:text-text-muted/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-success-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Check className="w-3 h-3" /> Correct Answer
                        </label>
                        <textarea
                          value={q.answer}
                          onChange={(e) =>
                            setQ(activeCatIdx, qIdx, "answer", e.target.value)
                          }
                          rows={4}
                          placeholder="The correct answer is..."
                          className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white font-medium outline-none resize-none focus:border-success-accent focus:ring-1 focus:ring-success-accent transition-all shadow-inner placeholder:text-text-muted/30"
                        />
                      </div>
                    </div>

                    {/* Media type + upload */}
<div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
  <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl shadow-inner shrink-0 flex-wrap gap-1">
    {(["text", "image", "audio", "video", "both"] as const).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => setQ(activeCatIdx, qIdx, "type", t)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
          q.type === t
            ? "bg-white/10 text-white shadow-sm"
            : "text-text-muted hover:text-white"
        }`}
      >
        {t}
      </button>
    ))}
  </div>

  {q.type !== "text" && (
    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 relative">
        <input
          type="text"
          placeholder="https://example.com/media.mp4"
          value={q.mediaUrl || ""}
          onChange={(e) => {
            // ✅ FIXED: Directly set the mediaUrl to the typed/pasted text
            setQ(activeCatIdx, qIdx, "mediaUrl", e.target.value);
          }}
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-primary-accent transition-colors"
        />
        <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 cursor-pointer transition text-xs font-bold shrink-0">
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept="image/*,audio/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleMediaUpload(activeCatIdx, qIdx, file);
              }
              // Optional: Reset the input value so the user can upload the same file again if they delete it
              e.target.value = "";
            }}
          />
          Upload
        </label>

        {q.mediaUrl && (
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black group flex items-center justify-center">
            {q.mediaUrl.startsWith("data:audio") || q.type === "audio" ? (
              <span className="text-[8px] font-bold text-white uppercase tracking-widest">Audio</span>
            ) : q.mediaUrl.startsWith("data:video") || q.type === "video" ? (
              <video src={q.mediaUrl} className="w-full h-full object-cover" />
            ) : (
              <img
                src={q.mediaUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}
            <button
              onClick={() =>
                setQ(activeCatIdx, qIdx, "mediaUrl", undefined)
              }
              title="Remove attachment"
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4 text-danger-accent" />
            </button>
          </div>
        )}
      </div>
    </div>
  )}
</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
