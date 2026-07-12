import React, { useState, useEffect } from "react";
import type { Quiz, Category, Question } from "../types/jeopardy";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import {
  Save,
  FileJson,
  FileSpreadsheet,
  Trash,
  ArrowUp,
  ArrowDown,
  Upload,
  X,
  Check,
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
  questions: [10, 20, 30, 40, 50].map((v) => makeQ(`q-${id}-${v}`, v)),
});

export const QuizEditor: React.FC<QuizEditorProps> = ({
  quizToEdit,
  onClose,
}) => {
  const { saveQuiz, deleteQuiz } = useQuizLibrary();

  const [quiz, setQuiz] = useState<Quiz>(() => {
    if (quizToEdit) return JSON.parse(JSON.stringify(quizToEdit));
    const newId = `quiz-${Math.random().toString(36).slice(2, 9)}`;
    return {
      id: newId,
      title: "New Quiz Pack",
      description: "Custom trivia board",
      categories: Array.from({ length: 6 }, (_, i) =>
        makeCat(`cat-${newId}-${i}`, `Category ${i + 1}`),
      ),
      createdAt: Date.now(),
    };
  });

  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto-save debounce
  useEffect(() => {
    const t = setTimeout(() => saveQuiz(quiz), 1200);
    return () => clearTimeout(t);
  }, [quiz, saveQuiz]);

  const setField = <K extends keyof Quiz>(k: K, v: Quiz[K]) =>
    setQuiz((p) => ({ ...p, [k]: v }));

  const setCatName = (idx: number, name: string) =>
    setQuiz((p) => {
      const c = [...p.categories];
      c[idx] = { ...c[idx], name };
      return { ...p, categories: c };
    });

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

  const handleImageUpload = (catIdx: number, qIdx: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2 MB");
      return;
    }
    const r = new FileReader();
    r.onload = (e) =>
      setQ(catIdx, qIdx, "mediaUrl", e.target?.result as string);
    r.readAsDataURL(file);
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
        csv += `"${cat.name}",${q.value},"${q.type}","${q.text.replace(/"/g, '""')}","${q.answer.replace(/"/g, '""')}",${!!q.isDailyDouble},"${q.mediaUrl?.startsWith("data:") ? "[embedded]" : (q.mediaUrl ?? "")}"\n`;
      }),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${quiz.title.replace(/\s+/g, "_")}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 min-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.24em] mb-1">
            Quiz Studio
          </p>
          <h2 className="text-2xl font-bold text-text-main m-0">Quiz Editor</h2>
          <p className="text-xs text-text-muted mt-1">
            Changes autosave every 1.2 s
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-danger-accent/15 border border-danger-accent/25 text-danger-accent hover:bg-danger-accent/25 transition"
          >
            <Trash className="w-4 h-4" /> Delete Quiz
          </button>
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition"
          >
            <FileJson className="w-4 h-4 text-primary-accent" /> JSON
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-success-accent" /> CSV
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-primary-accent hover:brightness-110 text-white transition shadow"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save
              </>
            )}
          </button>
          <button
            onClick={onClose}
            title="Close editor"
            aria-label="Close editor"
            className="p-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Metadata */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-text-main border-b border-white/5 pb-2 m-0">
              Quiz Details
            </h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Title
              </label>
              <input
                value={quiz.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Quiz title"
                aria-label="Quiz title"
                className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold outline-none focus:border-primary-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={quiz.description ?? ""}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="Short description"
                aria-label="Quiz description"
                className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-text-main border-b border-white/5 pb-2 m-0">
              Categories
            </h3>
            <div className="space-y-2">
              {quiz.categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCatIdx(idx)}
                  className={`p-3 rounded-xl border flex flex-col gap-3 cursor-pointer transition-all ${
                    activeCatIdx === idx
                      ? "bg-primary-accent/15 border-primary-accent"
                      : "bg-card-bg/30 border-white/5 hover:bg-card-bg/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => setCatName(idx, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      title="Category name"
                      aria-label="Category name"
                      className="flex-1 bg-transparent border-0 text-xs font-bold text-text-main outline-none min-w-0"
                    />
                    <div
                      className="flex gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => swapCats(idx, idx - 1)}
                        disabled={idx === 0}
                        title="Move category up"
                        aria-label="Move category up"
                        className="p-1 rounded text-text-muted disabled:opacity-30 hover:text-text-main"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => swapCats(idx, idx + 1)}
                        disabled={idx === quiz.categories.length - 1}
                        title="Move category down"
                        aria-label="Move category down"
                        className="p-1 rounded text-text-muted disabled:opacity-30 hover:text-text-main"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={cat.description ?? ""}
                    onChange={(e) => setCatDescription(idx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    rows={2}
                    placeholder="Category description"
                    aria-label="Category description"
                    className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-[11px] text-text-main outline-none focus:border-primary-accent resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — questions */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel p-4 rounded-2xl bg-card-bg/30">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.24em] mb-1">
              Active category
            </p>
            <h3 className="font-bold text-base text-text-main m-0">
              Editing:{" "}
              <span className="text-green-500">
                {quiz.categories[activeCatIdx]?.name}
              </span>
            </h3>
          </div>

          {quiz.categories[activeCatIdx]?.questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4"
            >
              <div className="flex flex-col gap-4 border-b border-white/5 pb-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="min-w-30 rounded-2xl border border-[#facc15]/20 bg-[#facc15]/8 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-[#facc15]/80 uppercase tracking-[0.22em]">
                      Question {qIdx + 1}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[#facc15] leading-none">
                      {q.value} Pts
                    </p>
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-semibold text-text-main">
                      Question content
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Keep the question and answer distinct, concise, and easy
                      to scan while editing.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:justify-end">
                  <button
                    onClick={() => clearQ(activeCatIdx, qIdx)}
                    className="p-2 rounded-xl border border-white/5 bg-card-bg/50 text-text-muted hover:text-danger-accent hover:border-danger-accent/20 transition"
                    title="Clear question"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs lg:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-primary-bg/60 p-4 space-y-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.22em]">
                    Question
                  </label>
                  <textarea
                    value={q.text}
                    onChange={(e) =>
                      setQ(activeCatIdx, qIdx, "text", e.target.value)
                    }
                    rows={5}
                    placeholder="Enter question…"
                    className="w-full bg-transparent border-0 px-0 py-0 text-sm text-text-main outline-none resize-none placeholder-text-muted/30 min-h-30"
                  />
                  <p className="text-[10px] text-text-muted">
                    Shown to players when the question opens.
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-primary-bg/60 p-4 space-y-2">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.22em]">
                    Correct answer
                  </label>
                  <textarea
                    value={q.answer}
                    onChange={(e) =>
                      setQ(activeCatIdx, qIdx, "answer", e.target.value)
                    }
                    rows={5}
                    placeholder="Enter answer…"
                    className="w-full bg-transparent border-0 px-0 py-0 text-sm text-text-main outline-none resize-none placeholder-text-muted/30 min-h-30"
                  />
                  <p className="text-[10px] text-text-muted">
                    Used by the host when judging buzzes.
                  </p>
                </div>
              </div>

              {/* Media type + upload */}
              <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-xs">
                <div className="flex bg-card-bg/60 border border-white/5 p-0.5 rounded-xl">
                  {(["text", "image", "both"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQ(activeCatIdx, qIdx, "type", t)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition ${q.type === t ? "bg-rose-600 text-white shadow" : "text-text-muted hover:text-text-main"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {q.type !== "text" && (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={q.mediaUrl || ""}
                      onChange={(e) =>
                        setQ(activeCatIdx, qIdx, "mediaUrl", e.target.value)
                      }
                      className="flex-1 bg-primary-bg border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-text-main outline-none"
                    />
                    <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card-bg border border-white/5 text-text-muted hover:text-text-main cursor-pointer transition text-[10px] font-bold">
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          handleImageUpload(
                            activeCatIdx,
                            qIdx,
                            e.target.files[0],
                          )
                        }
                      />
                      Upload
                    </label>
                    {q.mediaUrl && (
                      <div className="relative w-12 h-9 rounded overflow-hidden border border-white/10">
                        <img
                          src={q.mediaUrl}
                          alt="Question attachment preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            setQ(activeCatIdx, qIdx, "mediaUrl", undefined)
                          }
                          title="Remove attachment"
                          aria-label="Remove attachment"
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
