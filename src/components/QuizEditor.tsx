import React, { useState, useEffect } from 'react';
import type { Quiz, Category, Question } from '../types/jeopardy';
import { useQuizLibrary } from '../context/QuizLibraryContext';
import { Save, FileJson, FileSpreadsheet, Trash, ArrowUp, ArrowDown, Upload, X, Check } from 'lucide-react';

interface QuizEditorProps {
  quizToEdit: Quiz | null;
  onClose: () => void;
}

const makeQ = (id: string, value: number): Question => ({
  id, text: '', answer: '', value, type: 'text',
});

const makeCat = (id: string, name: string): Category => ({
  id,
  name,
  questions: [100, 200, 300, 400, 500].map((v) => makeQ(`q-${id}-${v}`, v)),
});

export const QuizEditor: React.FC<QuizEditorProps> = ({ quizToEdit, onClose }) => {
  const { saveQuiz } = useQuizLibrary();

  const [quiz, setQuiz] = useState<Quiz>(() => {
    if (quizToEdit) return JSON.parse(JSON.stringify(quizToEdit));
    const newId = `quiz-${Math.random().toString(36).slice(2, 9)}`;
    return {
      id: newId,
      title: 'New Quiz Pack',
      description: 'Custom trivia board',
      categories: Array.from({ length: 6 }, (_, i) => makeCat(`cat-${newId}-${i}`, `Category ${i + 1}`)),
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
    setQuiz((p) => { const c = [...p.categories]; c[idx] = { ...c[idx], name }; return { ...p, categories: c }; });

  const setQ = (catIdx: number, qIdx: number, field: keyof Question, val: any) =>
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
    if (!window.confirm('Clear this question?')) return;
    setQ(catIdx, qIdx, 'text', '');
    setQ(catIdx, qIdx, 'answer', '');
    setQ(catIdx, qIdx, 'mediaUrl', undefined);
    setQ(catIdx, qIdx, 'type', 'text');
    setQ(catIdx, qIdx, 'isDailyDouble', false);
  };

  const handleImageUpload = (catIdx: number, qIdx: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return; }
    const r = new FileReader();
    r.onload = (e) => setQ(catIdx, qIdx, 'mediaUrl', e.target?.result as string);
    r.readAsDataURL(file);
  };

  const handleSave = () => { saveQuiz(quiz); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(quiz, null, 2));
    a.download = `${quiz.title.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  const exportCsv = () => {
    let csv = 'Category,Value,Type,Question,Answer,DailyDouble,Media\n';
    quiz.categories.forEach((cat) =>
      cat.questions.forEach((q) => {
        csv += `"${cat.name}",${q.value},"${q.type}","${(q.text).replace(/"/g, '""')}","${(q.answer).replace(/"/g, '""')}",${!!q.isDailyDouble},"${q.mediaUrl?.startsWith('data:') ? '[embedded]' : (q.mediaUrl ?? '')}"\n`;
      })
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${quiz.title.replace(/\s+/g, '_')}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 min-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-text-main m-0">Quiz Editor</h2>
          <p className="text-xs text-text-muted mt-1">Changes autosave every 1.2 s</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportJson} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition">
            <FileJson className="w-4 h-4 text-primary-accent" /> JSON
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition">
            <FileSpreadsheet className="w-4 h-4 text-success-accent" /> CSV
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-primary-accent hover:brightness-110 text-white transition shadow">
            {saveSuccess ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save</>}
          </button>
          <button onClick={onClose} className="p-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Metadata */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-text-main border-b border-white/5 pb-2 m-0">Quiz Details</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Title</label>
              <input value={quiz.title} onChange={(e) => setField('title', e.target.value)}
                className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold outline-none focus:border-primary-accent" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Description</label>
              <textarea value={quiz.description ?? ''} onChange={(e) => setField('description', e.target.value)} rows={2}
                className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none" />
            </div>
          </div>

          {/* Categories */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-sm text-text-main border-b border-white/5 pb-2 m-0">Categories</h3>
            <div className="space-y-2">
              {quiz.categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCatIdx(idx)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    activeCatIdx === idx ? 'bg-primary-accent/15 border-primary-accent' : 'bg-card-bg/30 border-white/5 hover:bg-card-bg/60'
                  }`}
                >
                  <input
                    type="text" value={cat.name}
                    onChange={(e) => setCatName(idx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent border-0 text-xs font-bold text-text-main outline-none min-w-0"
                  />
                  <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => swapCats(idx, idx - 1)} disabled={idx === 0} className="p-1 rounded text-text-muted disabled:opacity-30 hover:text-text-main"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => swapCats(idx, idx + 1)} disabled={idx === quiz.categories.length - 1} className="p-1 rounded text-text-muted disabled:opacity-30 hover:text-text-main"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — questions */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel p-4 rounded-2xl bg-card-bg/30">
            <h3 className="font-extrabold text-base text-text-main m-0">
              Editing: <span className="text-primary-accent">{quiz.categories[activeCatIdx]?.name}</span>
            </h3>
          </div>

          {quiz.categories[activeCatIdx]?.questions.map((q, qIdx) => (
            <div key={q.id} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              {/* Row header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="w-9 h-9 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center font-display font-extrabold text-sm text-[#FACC15]">
                  ${q.value}
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted cursor-pointer select-none">
                    <input type="checkbox" checked={!!q.isDailyDouble} onChange={(e) => setQ(activeCatIdx, qIdx, 'isDailyDouble', e.target.checked)} className="w-3.5 h-3.5" />
                    Daily Double
                  </label>
                  <button onClick={() => clearQ(activeCatIdx, qIdx)} className="p-1.5 rounded-lg text-text-muted hover:text-danger-accent transition">
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Clue (shown to players)</label>
                  <textarea value={q.text} onChange={(e) => setQ(activeCatIdx, qIdx, 'text', e.target.value)}
                    rows={3} placeholder="Enter clue…"
                    className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none placeholder-text-muted/30" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Correct Answer</label>
                  <textarea value={q.answer} onChange={(e) => setQ(activeCatIdx, qIdx, 'answer', e.target.value)}
                    rows={3} placeholder="Enter answer…"
                    className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none placeholder-text-muted/30" />
                </div>
              </div>

              {/* Media type + upload */}
              <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-xs">
                <div className="flex bg-card-bg/60 border border-white/5 p-0.5 rounded-xl">
                  {(['text', 'image', 'both'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setQ(activeCatIdx, qIdx, 'type', t)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition ${q.type === t ? 'bg-primary-accent text-white shadow' : 'text-text-muted hover:text-text-main'}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {q.type !== 'text' && (
                  <div className="flex flex-1 items-center gap-2">
                    <input type="text" placeholder="Image URL" value={q.mediaUrl || ''}
                      onChange={(e) => setQ(activeCatIdx, qIdx, 'mediaUrl', e.target.value)}
                      className="flex-1 bg-primary-bg border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-text-main outline-none" />
                    <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card-bg border border-white/5 text-text-muted hover:text-text-main cursor-pointer transition text-[10px] font-bold">
                      <Upload className="w-3.5 h-3.5" />
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(activeCatIdx, qIdx, e.target.files[0])} />
                      Upload
                    </label>
                    {q.mediaUrl && (
                      <div className="relative w-12 h-9 rounded overflow-hidden border border-white/10">
                        <img src={q.mediaUrl} className="w-full h-full object-cover" />
                        <button onClick={() => setQ(activeCatIdx, qIdx, 'mediaUrl', undefined)}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition">
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
