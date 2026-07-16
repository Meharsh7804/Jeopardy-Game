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
    };
  });

  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Auto-save debounce
  useEffect(() => {
    if (!quiz.title.trim() && quiz.categories.length === 0) return; // Don't auto-save empty new quizzes instantly
    const t = setTimeout(() => saveQuiz(quiz), 1200);
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

const handleImageUpload = (
  catIdx: number,
  qIdx: number,
  file: File
) => {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert("Image must be under 2 MB.");
    return;
  }

  // Creates a lightweight, temporary local URL instantly (no async reader needed)
  const previewUrl = URL.createObjectURL(file);
  
  // Update your state with the lightweight URL
  setQ(catIdx, qIdx, "mediaUrl", previewUrl);
  
  // Optional: If you need to send the actual file to a backend API later, 
  // you should also save the raw `file` object in your state, not just the URL.
  // setQ(catIdx, qIdx, "rawFile", file); 
};

  const handleSave = () => {
    saveQuiz(quiz);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
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
  <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl shadow-inner shrink-0">
    {(["text", "image", "both"] as const).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => setQ(activeCatIdx, qIdx, "type", t)}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
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
          placeholder="https://example.com/image.jpg"
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
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageUpload(activeCatIdx, qIdx, file);
              }
              // Optional: Reset the input value so the user can upload the same file again if they delete it
              e.target.value = "";
            }}
          />
          Upload
        </label>

        {q.mediaUrl && (
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black group">
            <img
              src={q.mediaUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
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
