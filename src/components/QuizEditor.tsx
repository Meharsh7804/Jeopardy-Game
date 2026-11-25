import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Quiz, Category, Question, QuestionType } from "../types/jeopardy";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import { validateQuiz, hasBlockingErrors } from "../utils/quizValidation";
import {
  Save,
  Trash,
  Upload,
  Copy,
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
  const [activeQuestionValue, setActiveQuestionValue] = useState<number | "all">(100);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Quiz | null>(null);
  const [dragCatIdx, setDragCatIdx] = useState<number | null>(null);
  const [dragQIdx, setDragQIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState<{ key: string; progress: number } | null>(null);
  const validationIssuesLive = useMemo(() => validateQuiz(quiz), [quiz]);
  const hasFieldIssue = (path: string) => validationIssuesLive.some((i) => i.path === path);
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
        .then(() => {
          setSaveFailed(false);
          setSaveErrorMessage(null);
        })
        .catch(() => {
          setSaveFailed(true);
          setSaveErrorMessage("Auto-save failed. The quiz may be too large to sync; try a smaller image.");
        });
    }, 1200);
    return () => clearTimeout(t);
  }, [quiz, saveQuiz]);

  const setField = <K extends keyof Quiz>(k: K, v: Quiz[K]) =>
    setQuiz((p) => ({ ...p, [k]: v }));

  const defaultQuestionValue = (category?: Category) =>
    category?.questions.some((question) => question.value === 100)
      ? 100
      : category?.questions[0]?.value ?? 100;

  const selectCategory = (idx: number) => {
    setActiveCatIdx(idx);
    setActiveQuestionValue(defaultQuestionValue(quiz.categories[idx]));
  };

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
    setActiveQuestionValue(100);
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

  const duplicateCategory = (idx: number) => {
    setQuiz((p) => {
      const src = p.categories[idx];
      if (!src) return p;
      const copy: Category = JSON.parse(JSON.stringify(src));
      copy.id = `cat-${Math.random().toString(36).slice(2, 9)}`;
      copy.name = `${src.name} (Copy)`;
      copy.questions = copy.questions.map((q, i) => ({ ...q, id: `q-${copy.id}-${i}-${Math.random().toString(36).slice(2, 6)}` }));
      const cats = [...p.categories];
      cats.splice(idx + 1, 0, copy);
      return { ...p, categories: cats };
    });
    setActiveCatIdx(idx + 1);
    setActiveQuestionValue(defaultQuestionValue(quiz.categories[idx]));
  };

  const duplicateQuestion = (catIdx: number, qIdx: number) => {
    setQuiz((p) => {
      const cats = JSON.parse(JSON.stringify(p.categories));
      const src = cats[catIdx]?.questions[qIdx];
      if (!src) return p;
      const copy = { ...src, id: `q-${Math.random().toString(36).slice(2, 9)}` };
      cats[catIdx].questions.splice(qIdx + 1, 0, copy);
      return { ...p, categories: cats };
    });
  };

  const moveQuestion = (catIdx: number, from: number, to: number) => {
    setQuiz((p) => {
      const cats = JSON.parse(JSON.stringify(p.categories));
      const arr = cats[catIdx]?.questions;
      if (!arr || from === to) return p;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { ...p, categories: cats };
    });
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
    setActiveQuestionValue(defaultQuestionValue(quiz.categories[a]));
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

    const key = `${catIdx}-${qIdx}`;
    setUploading({ key, progress: 0 });
    try {
      let dataUrl: string;
      if (isImage) {
        setUploading({ key, progress: 30 });
        dataUrl = await compressImage(file);
        setUploading({ key, progress: 100 });
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (ev) => { if (ev.lengthComputable) setUploading({ key, progress: Math.round((ev.loaded / ev.total) * 100) }); };
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Unable to read media."));
          reader.readAsDataURL(file);
        });
      }
      setQ(catIdx, qIdx, "mediaUrl", dataUrl);
    } catch {
      alert("Unable to read media file.");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = () => {
    const issues = validateQuiz(quiz);
    if (hasBlockingErrors(issues)) {
      setSaveFailed(true);
      setSaveErrorMessage("Fix the highlighted fields before saving.");
      return;
    }
    saveQuiz(quiz)
      .then(() => {
        setSaveFailed(false);
        setSaveErrorMessage(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      })
      .catch(() => {
        setSaveFailed(true);
        setSaveErrorMessage("Save failed — the quiz may be too large to sync. Try a smaller image.");
      });
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
    let csv = "Category,Value,Type,Question,Answer,DailyDouble,Media,Difficulty,Tags,Author\n";
    quiz.categories.forEach((cat) =>
      cat.questions.forEach((q) => {
        const tags = (q.tags || []).join("|");
        csv += `"${cat.name.replace(/"/g, '""')}",${q.value},"${q.type}","${q.text.replace(/"/g, '""')}","${q.answer?.replace(/"/g, '""') || ""}",${!!q.isDailyDouble},"${q.mediaUrl?.startsWith("data:") ? "[embedded]" : (q.mediaUrl ?? "")}","${q.difficulty || ""}","${tags.replace(/"/g, '""')}","${(quiz.author ?? "").replace(/"/g, '""')}"\n`;
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
            author: imported.author || quiz.author,
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
                difficulty: ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : undefined,
                tags: Array.isArray(q.tags) ? q.tags.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.trim()) : undefined,
              })),
            })),
          };
          setImportPreview({ ...newQuiz, id: quiz.id, createdAt: quiz.createdAt } as Quiz);
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
          let importedAuthor = "";

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols: string[] = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
              cols.push(match[1] !== undefined ? match[1] : match[2]);
            }
            if (cols[9]) importedAuthor = cols[9];
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
            const difficulty = ["easy","medium","hard"].includes(cols[7]) ? (cols[7] as any) : undefined;
            const tags = cols[8] ? cols[8].split("|").map((t) => t.trim()).filter(Boolean) : undefined;
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
              difficulty,
              tags: tags && tags.length ? tags : undefined,
            });
          }

          const newCats = Array.from(categoriesMap.values());
          if (newCats.length === 0)
            throw new Error("No valid categories found in CSV.");

          setImportPreview({ ...quiz, author: importedAuthor || quiz.author, categories: newCats });
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
      <div
        className="flex-1 w-full px-4 py-8 flex items-center justify-center min-h-screen bg-[#F4EFE6]"
        style={{
          backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[6px_6px_0px_#111111] p-8 max-w-md w-full flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 border-2 border-[#111111] bg-[#FFD60A] flex items-center justify-center">
            <Lock className="w-8 h-8 text-[#111111]" />
          </div>
          <div className="text-center">
            <h2 className="font-['Archivo_Black'] text-2xl uppercase text-[#111111]">Password Protected</h2>
            <p className="font-mono text-xs text-[#111111]/70 mt-1">Enter the quiz password to edit <span className="font-bold text-[#111111]">{quizToEdit?.title}</span></p>
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
                className={`w-full bg-[#F4EFE6] border-2 border-[#111111] px-4 py-3 pr-12 text-sm text-[#111111] font-bold focus:bg-[#FFFFFF] focus:outline-none rounded-none ${
                  passwordError ? "ring-2 ring-[#FF3B1D]" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[#FF3B1D] text-xs font-bold flex items-center gap-1.5">
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
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-[#111111] bg-[#00C271] hover:bg-[#111111] hover:text-[#FFD60A] font-mono text-sm font-bold uppercase"
            >
              <Unlock className="w-4 h-4" /> Unlock Editor
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[#F4EFE6] border-2 border-[#111111] text-[#111111] text-sm font-bold hover:bg-[#FFD60A] transition rounded-none"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-[#F4EFE6] text-[#111111]"
      style={{
        backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <header className="h-14 shrink-0 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="min-w-max w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-[#FF3B1D] border-2 border-[#111111] flex items-center justify-center shrink-0 text-[#FFFFFF]">
              <Layout className="w-4 h-4" />
            </div>
            <h2 className="font-['Archivo_Black'] text-lg text-[#111111] uppercase tracking-tight">Quiz Editor</h2>
            <span className="hidden sm:inline bg-[#111111] text-[#FFD60A] px-2.5 py-0.5 font-mono text-[10px] font-bold">SHOW PACK BUILDER</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            accept=".json,.csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3 bg-[#F4EFE6] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs font-bold flex items-center gap-1.5 rounded-none"
          >
            <Upload className="w-4 h-4" /> IMPORT QUIZ
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="h-9 px-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs font-bold rounded-none"
          >
            JSON
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="h-9 px-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs font-bold rounded-none"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-9 px-4 bg-[#00C271] hover:bg-[#111111] text-[#111111] hover:text-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-['Archivo_Black'] text-xs tracking-wider uppercase flex items-center gap-1.5 rounded-none"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> SAVED
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> SAVE PACK
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close editor"
            className="w-9 h-9 bg-[#FF3B1D] hover:bg-[#111111] text-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono font-black flex items-center justify-center rounded-none"
          >
            <X className="w-4 h-4" />
          </button>
          </div>
        </div>
      </header>

      {saveFailed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-4 bg-[#FFFFFF] border-2 border-[#FF3B1D] flex items-center gap-3 text-[#FF3B1D] shadow-[3px_3px_0px_#111111]"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{saveErrorMessage}</p>
          <button
            onClick={() => { setSaveFailed(false); setSaveErrorMessage(null); }}
            className="ml-auto p-1 hover:bg-[#FF3B1D]/15"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {importError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-4 bg-[#FFFFFF] border-2 border-[#FF3B1D] flex items-center gap-3 text-[#FF3B1D] shadow-[3px_3px_0px_#111111]"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{importError}</p>
          <button
            onClick={() => setImportError(null)}
            className="ml-auto p-1 hover:bg-[#FF3B1D]/15"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start relative z-10">
        {/* Left column */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Metadata */}
          <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
            <h3 className="bg-[#111111] text-[#FFD60A] px-4 py-2.5 font-mono text-xs font-bold uppercase flex items-center justify-between">
              📋 QUIZ DETAILS
            </h3>
            <div className="p-4 space-y-3">
            <div className="space-y-1">
              <label className="font-mono text-[10px] font-black uppercase">Title
              </label>
              <input
                value={quiz.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Awesome Trivia"
                className={`w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 font-bold text-sm text-[#111111] focus:bg-[#FFFFFF] focus:outline-none rounded-none ${hasFieldIssue("title") ? "ring-2 ring-[#FF3B1D]" : ""}`}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] font-black uppercase">Description
              </label>
              <textarea
                value={quiz.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="A fun trivia game for everyone"
                className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 text-xs font-semibold text-[#111111] focus:bg-[#FFFFFF] focus:outline-none rounded-none resize-y"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] font-black uppercase">Showrunner / Author</label>
              <input
                value={quiz.author ?? ""}
                onChange={(e) => setField("author", e.target.value)}
                placeholder="Showrunner name"
                className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-1.5 text-xs font-bold text-[#111111] focus:bg-[#FFFFFF] focus:outline-none rounded-none"
              />
            </div>

            {/* Quiz Password */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] font-black uppercase flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Edit Password (optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={quiz.password ?? ""}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Leave blank for no password"
                  className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 pr-12 text-xs text-[#111111] font-bold focus:bg-[#FFFFFF] focus:outline-none rounded-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="font-mono text-[10px] text-[#111111]/70">Anyone editing this quiz will need to enter this password.</p>
            </div>

            <div className="pt-3 border-t-2 border-[#111111]">
              <button
                onClick={handleDelete}
                className="w-full py-2 bg-[#FFFFFF] hover:bg-[#FF3B1D] text-[#FF3B1D] hover:text-[#FFFFFF] border-2 border-[#111111] font-mono text-xs font-bold uppercase transition-colors rounded-none flex items-center justify-center gap-2"
              >
                <Trash className="w-4 h-4" /> DELETE ENTIRE QUIZ
              </button>
            </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
            <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between font-mono text-xs font-bold uppercase">
              <h3 className="flex items-center gap-2 text-[#FFD60A]">
                <BookOpen className="w-4 h-4" /> CATEGORIES
              </h3>
              <button
                onClick={addCategory}
                className="bg-[#00C271] text-[#111111] hover:bg-[#FFD60A] px-2.5 py-0.5 border border-[#FFFFFF] font-mono text-[10px] font-black"
              >
                <Plus className="w-3 h-3 inline" /> ADD
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {quiz.categories.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 border-2 border-[#111111] border-dashed"
                  >
                    <p className="font-mono text-xs text-[#111111]/70 mb-3">
                      NO CATEGORIES YET
                    </p>
                    <button
                      onClick={addCategory}
                      className="px-4 py-2 bg-[#FFD60A] text-xs font-bold text-[#111111] hover:bg-[#00C271] transition border-2 border-[#111111] rounded-none"
                    >
                      ADD FIRST CATEGORY
                    </button>
                  </motion.div>
                )}
                {quiz.categories.map((cat, idx) => (
                  <motion.div
                    key={cat.id}
                    layout
                    draggable
                    onDragStart={() => setDragCatIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragCatIdx !== null && dragCatIdx !== idx) swapCats(dragCatIdx, idx); setDragCatIdx(null); }}
                    onDragEnd={() => setDragCatIdx(null)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => selectCategory(idx)}
                    className={`border-2 border-[#111111] p-2.5 flex flex-col gap-2 cursor-pointer transition-all ${
                      activeCatIdx === idx
                        ? "bg-[#FFD60A] shadow-[3px_3px_0px_#111111]"
                        : "bg-[#F4EFE6] hover:bg-[#FFFFFF]"
                    } ${dragCatIdx === idx ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                        <span
                          className="font-['Archivo_Black'] text-xs text-[#111111] uppercase truncate"
                        >
                          {cat.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            editCategoryName(idx);
                          }}
                          title="Edit category name"
                          className="w-6 h-6 border border-[#111111] bg-[#FFFFFF] hover:bg-[#FFD60A] flex items-center justify-center shrink-0"
                        >
                          <Edit2 className="w-3 h-3 text-[#111111]" />
                        </button>
                      </div>

                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Move ${cat.name} up`}
                          onClick={() => swapCats(idx, idx - 1)}
                          disabled={idx === 0}
                          className="w-6 h-6 border border-[#111111] bg-[#FFFFFF] hover:bg-[#FFD60A] disabled:opacity-30 font-mono text-xs font-black"
                        >
                          <ArrowUp className="w-3 h-3 mx-auto" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${cat.name} down`}
                          onClick={() => swapCats(idx, idx + 1)}
                          disabled={idx === quiz.categories.length - 1}
                          className="w-6 h-6 border border-[#111111] bg-[#FFFFFF] hover:bg-[#FFD60A] disabled:opacity-30 font-mono text-xs font-black"
                        >
                          <ArrowDown className="w-3 h-3 mx-auto" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Duplicate ${cat.name}`}
                          onClick={() => duplicateCategory(idx)}
                          className="w-6 h-6 border border-[#111111] bg-[#FFFFFF] hover:bg-[#FFD60A] flex items-center justify-center"
                          title="Duplicate category"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${cat.name}`}
                          onClick={() => removeCategory(idx)}
                          className="w-6 h-6 border border-[#111111] bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-[#FFFFFF] flex items-center justify-center"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                        <span className="bg-[#111111] text-[#FFD60A] px-1.5 py-0.5 font-mono text-[10px] font-bold ml-1 whitespace-nowrap">
                          {cat.questions.filter((question) => question.text.trim() && question.answer.trim()).length}/{cat.questions.length}
                        </span>
                      </div>
                    </div>
                    {activeCatIdx === idx && (
                      <input
                        value={cat.description ?? ""}
                        onChange={(e) => setCatDescription(idx, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Optional category description"
                        className="mt-1 w-full bg-[#FFFFFF] border border-[#111111] px-2 py-1 font-mono text-[11px] text-[#111111] rounded-none focus:outline-none"
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right column — questions */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {quiz.categories.length === 0 ? (
            <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] p-12 text-center min-h-[50vh] flex flex-col items-center justify-center">
              <BookOpen className="w-16 h-16 text-[#111111]/20 mb-4" />
              <h2 className="font-['Archivo_Black'] text-2xl text-[#111111] uppercase mb-2">
                NO CATEGORIES SELECTED
              </h2>
              <p className="font-mono text-xs text-[#111111]/70 max-w-md mx-auto">
                Create a category on the left to start adding questions.
              </p>
            </div>
          ) : (
            <>
              <section className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
                <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-bold text-[#FFD60A] uppercase flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" /> CURRENTLY EDITING CATEGORY
                  </p>
                  <span className="bg-[#FF3B1D] text-[#FFFFFF] px-2.5 py-0.5 font-['Archivo_Black'] text-xs uppercase truncate max-w-[45%]">
                    {quiz.categories[activeCatIdx]?.name}
                  </span>
                </div>
                <div className="p-4 bg-[#F4EFE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    aria-label="Edit active category name"
                    value={quiz.categories[activeCatIdx]?.name ?? ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setQuiz((previous) => ({
                        ...previous,
                        categories: previous.categories.map((category, idx) =>
                          idx === activeCatIdx ? { ...category, name } : category,
                        ),
                      }));
                    }}
                    className="flex-1 min-w-0 bg-[#FFFFFF] border-2 border-[#111111] px-3 py-2 font-['Archivo_Black'] text-base sm:text-lg text-[#111111] rounded-none focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {[100, 200, 300, 400, 500].map((value) => {
                      const tierQuestion = quiz.categories[activeCatIdx]?.questions.find((question) => question.value === value);
                      const isComplete = Boolean(tierQuestion?.text.trim() && tierQuestion?.answer.trim());
                      const active = activeQuestionValue === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setActiveQuestionValue(value)}
                          className={`px-3 py-2 border-2 border-[#111111] font-mono text-xs font-bold flex items-center gap-1.5 ${active ? "bg-[#FFD60A] text-[#111111] shadow-[2px_2px_0px_#111111] font-['Archivo_Black']" : "bg-[#FFFFFF] hover:bg-[#FFD60A]/40 text-[#111111]"}`}
                        >
                          ${value}
                          {isComplete && <span className="w-2 h-2 bg-[#00C271] border border-[#111111]" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={activeQuestionValue === "all"}
                      onClick={() => setActiveQuestionValue("all")}
                      className={`px-3 py-2 border-2 border-[#111111] font-mono text-xs font-bold ${activeQuestionValue === "all" ? "bg-[#FFD60A] text-[#111111] shadow-[2px_2px_0px_#111111]" : "bg-[#FFFFFF] hover:bg-[#FFD60A]/40 text-[#111111]"}`}
                    >
                      ALL
                    </button>
                  </div>
                </div>
              </section>

              <div className="space-y-4">
                {!quiz.categories[activeCatIdx]?.questions.some((question) => activeQuestionValue === "all" || question.value === activeQuestionValue) && (
                  <div className="bg-[#FFFFFF] border-2 border-[#111111] p-5 font-mono text-xs font-bold uppercase text-[#111111]/70">
                    No clue at this value. Select ALL or another tier.
                  </div>
                )}
                {quiz.categories[activeCatIdx]?.questions
                  .map((question, qIdx) => ({ question, qIdx }))
                  .filter(({ question }) => activeQuestionValue === "all" || question.value === activeQuestionValue)
                  .map(({ question: q, qIdx }) => (
                  <div
                    key={q.id}
                    draggable
                    onDragStart={() => setDragQIdx(qIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragQIdx !== null && dragQIdx !== qIdx) moveQuestion(activeCatIdx, dragQIdx, qIdx); setDragQIdx(null); }}
                    onDragEnd={() => setDragQIdx(null)}
                    className={`bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden ${dragQIdx === qIdx ? "opacity-50" : ""}`}
                  >
                    <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-[#FFD60A] text-[#111111] px-3 py-0.5 font-['Archivo_Black'] text-sm">${q.value}</span>
                        <span className="font-mono text-xs font-bold uppercase">CLUE DETAILS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateQuestion(activeCatIdx, qIdx)}
                          className="bg-[#F4EFE6] text-[#111111] hover:bg-[#FFD60A] px-2.5 py-1 font-mono text-[10px] font-bold border border-[#FFFFFF] uppercase rounded-none flex items-center gap-1"
                          title="Duplicate question"
                        >
                          <Copy className="w-3 h-3" /> DUPLICATE
                        </button>
                        <button
                          type="button"
                          onClick={() => clearQ(activeCatIdx, qIdx)}
                          className="bg-[#FF3B1D] text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#111111] px-2.5 py-1 font-mono text-[10px] font-bold border border-[#FFFFFF] uppercase rounded-none flex items-center gap-1"
                          title="Clear question"
                        >
                          <X className="w-3 h-3" /> CLEAR
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="font-mono text-[11px] font-black text-[#FF3B1D] uppercase mb-1.5 flex items-center gap-1.5">
                          <Type className="w-3 h-3" /> QUESTION TEXT
                        </label>
                        <textarea
                          value={q.text}
                          onChange={(e) =>
                            setQ(activeCatIdx, qIdx, "text", e.target.value)
                          }
                          rows={3}
                          placeholder="What is the capital of..."
                          className={`w-full bg-[#F4EFE6] border-2 border-[#111111] p-3 font-bold text-base text-[#111111] resize-y focus:bg-[#FFFFFF] focus:outline-none rounded-none placeholder:text-[#111111]/35 ${hasFieldIssue(`categories[${activeCatIdx}].questions[${qIdx}].text`) ? "ring-2 ring-[#FF3B1D]" : ""}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="font-mono text-[11px] font-black text-[#00C271] uppercase mb-1.5 flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> CORRECT ANSWER
                        </label>
                        <textarea
                          value={q.answer}
                          onChange={(e) =>
                            setQ(activeCatIdx, qIdx, "answer", e.target.value)
                          }
                          rows={3}
                          placeholder="The correct answer is..."
                          className={`w-full bg-[#F4EFE6] border-2 border-[#111111] border-l-[6px] border-l-[#00C271] p-3 font-bold text-base text-[#111111] resize-y focus:bg-[#FFFFFF] focus:outline-none rounded-none placeholder:text-[#111111]/35 ${hasFieldIssue(`categories[${activeCatIdx}].questions[${qIdx}].answer`) ? "ring-2 ring-[#FF3B1D]" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="font-mono text-[10px] font-black uppercase mb-1">DIFFICULTY</label>
                        <select
                          value={q.difficulty || ""}
                          onChange={(e) => setQ(activeCatIdx, qIdx, "difficulty", e.target.value || undefined)}
                          className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 font-mono text-xs font-bold text-[#111111] rounded-none"
                        >
                          <option value="">Unset</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="font-mono text-[10px] font-black uppercase mb-1">TAGS (COMMA SEPARATED)</label>
                        <input
                          type="text"
                          value={(q.tags || []).join(", ")}
                          onChange={(e) => {
                            const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                            setQ(activeCatIdx, qIdx, "tags", tags.length ? tags : undefined);
                          }}
                          placeholder="history, science, bonus"
                          className="w-full bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 font-mono text-xs font-bold text-[#111111] rounded-none"
                        />
                      </div>
                    </div>

                    {/* Media type + upload */}
<div className="bg-[#F4EFE6] border-2 border-[#111111] p-3 flex flex-col gap-3">
  <div className="flex items-center gap-1.5 flex-wrap">
    {(["text", "image", "audio", "video", "both"] as const).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => setQ(activeCatIdx, qIdx, "type", t)}
        className={`px-3 py-1.5 border-2 border-[#111111] font-mono text-xs uppercase transition-colors ${
          q.type === t
            ? "bg-[#111111] text-[#FFD60A] font-black"
            : "bg-[#FFFFFF] hover:bg-[#FFD60A] text-[#111111] font-bold"
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
          className="w-full bg-[#FFFFFF] border-2 border-[#111111] rounded-none pl-9 pr-3 py-2 text-xs text-[#111111] outline-none"
        />
        <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-[#111111]" />
      </div>

      <div className="flex items-center gap-2">
        <label className={`flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] border-2 border-[#111111] text-[#111111] hover:bg-[#FFD60A] cursor-pointer transition font-mono text-xs font-bold shrink-0 rounded-none ${uploading?.key === `${activeCatIdx}-${qIdx}` ? "opacity-60 pointer-events-none" : ""}`}>
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept="image/*,audio/*,video/*"
            className="hidden"
            disabled={uploading?.key === `${activeCatIdx}-${qIdx}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleMediaUpload(activeCatIdx, qIdx, file);
              }
              e.target.value = "";
            }}
          />
          {uploading?.key === `${activeCatIdx}-${qIdx}` ? `Uploading ${uploading.progress}%` : "Upload"}
        </label>

        {q.mediaUrl && (
          <div className="relative w-10 h-10 overflow-hidden border-2 border-[#111111] shrink-0 bg-black group flex items-center justify-center">
            {q.mediaUrl.startsWith("data:audio") || q.type === "audio" ? (
              <span className="text-[8px] font-bold text-[#111111] uppercase tracking-widest">Audio</span>
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
              className="absolute inset-0 flex items-center justify-center bg-[#111111]/45 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      </main>
      <AnimatePresence>
        {importPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60 " onClick={() => setImportPreview(null)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[6px_6px_0px_#111111] p-6 w-full max-w-lg space-y-4" onClick={(e)=>e.stopPropagation()}>
                <h3 className="font-['Archivo_Black'] text-2xl uppercase text-[#111111]">Import Preview</h3>
                <p className="font-mono text-xs text-[#111111]/70">This will replace your current quiz content.</p>
                <div className="bg-[#F4EFE6] p-4 border-2 border-[#111111] text-sm text-[#111111] space-y-1">
                <div><span className="text-text-muted">Title:</span> {importPreview.title}</div>
                <div><span className="text-text-muted">Categories:</span> {importPreview.categories.length}</div>
                <div><span className="text-text-muted">Questions:</span> {importPreview.categories.reduce((a,c)=>a+c.questions.length,0)}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setImportPreview(null)} className="flex-1 py-3 bg-[#F4EFE6] border-2 border-[#111111] text-[#111111] font-bold uppercase rounded-none">Cancel</button>
                <button onClick={() => { setQuiz(importPreview); setActiveCatIdx(0); setActiveQuestionValue(defaultQuestionValue(importPreview.categories[0])); setImportPreview(null); }} className="flex-1 py-3 bg-[#00C271] border-2 border-[#111111] text-[#111111] font-bold uppercase rounded-none">Apply Import</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
