'use client';

import React, { useState, useEffect } from 'react';
import { Question } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Search, Filter, X, Check, ChevronLeft, ChevronRight, AlertCircle, HelpCircle } from 'lucide-react';

interface QuestionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCount: number;
  currentlySelectedIds: string[];
  onSaveSelectedQuestions: (selectedIds: string[]) => void;
}

export function QuestionSelectorModal({
  isOpen,
  onClose,
  requiredCount,
  currentlySelectedIds,
  onSaveSelectedQuestions,
}: QuestionSelectorModalProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('ALL');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(currentlySelectedIds);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(currentlySelectedIds);
      setErrorMsg(null);
    }
  }, [isOpen, currentlySelectedIds]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '10');
    if (searchQuery.trim()) params.set('query', searchQuery.trim());
    if (filterDifficulty !== 'ALL') params.set('difficulty', filterDifficulty);

    fetch(`/api/admin/questions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setQuestions(data.questions || []);
          setTotalPages(data.totalPages || 1);
          setTotalQuestions(data.total || 0);
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMsg('Failed to load question bank data.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, page, searchQuery, filterDifficulty]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setErrorMsg(null);
    setLocalSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= requiredCount) {
          setErrorMsg(`Cannot add more than the required question count (${requiredCount} questions).`);
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleSave = () => {
    onSaveSelectedQuestions(localSelectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-brand-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white max-w-4xl w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg flex flex-col max-h-[90vh] relative">
        {/* HEADER */}
        <div className="p-6 border-b-3 border-brand-black flex items-center justify-between bg-canvas/40 rounded-t-[22px]">
          <div>
            <span className="bg-burnt-orange text-white px-3 py-0.5 rounded font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial">
              QUESTION MANAGEMENT
            </span>
            <h2 className="font-display font-black text-2xl uppercase text-brand-black mt-1">
              Select Questions for Examination
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl border-2 border-brand-black shadow-editorial cursor-pointer transition-colors"
          >
            <X className="w-5 h-5 text-brand-black" />
          </button>
        </div>

        {/* COUNTER STRIP & SEARCH BAR */}
        <div className="p-6 pb-4 border-b-2 border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-warm-beige p-4 rounded-2xl border-2 border-brand-black">
            <div>
              <span className="text-xs font-mono text-slate-600 block uppercase font-bold">Selection Progress</span>
              <span
                className={`font-display font-black text-xl ${
                  localSelectedIds.length === requiredCount ? 'text-emerald-700' : 'text-burnt-orange'
                }`}
              >
                {localSelectedIds.length} / {requiredCount} Questions Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLocalSelectedIds([])}
                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white hover:bg-slate-100 text-brand-black rounded-lg border-2 border-brand-black cursor-pointer shadow-editorial"
              >
                Clear All
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
            </div>
          )}

          {/* SEARCH & FILTERS */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border-2 border-brand-black font-mono focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterDifficulty}
                onChange={(e) => {
                  setFilterDifficulty(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 text-xs rounded-xl border-2 border-brand-black font-mono focus:outline-none cursor-pointer bg-white"
              >
                <option value="ALL">Difficulty: All</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
        </div>

        {/* QUESTIONS LIST */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-12 font-mono text-slate-500 font-bold">
              Loading lazy paginated questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-2xl">
              <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="font-mono text-sm font-bold text-slate-600">No questions found matching filter criteria.</p>
            </div>
          ) : (
            questions.map((q) => {
              const isSelected = localSelectedIds.includes(q.id);

              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                    isSelected
                      ? 'bg-warm-beige border-brand-black shadow-editorial'
                      : 'bg-white border-slate-300 hover:border-brand-black'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="accent-burnt-orange w-5 h-5 mt-1 cursor-pointer"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-brand-black text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                        {q.difficulty}
                      </span>
                      <span className="text-xs font-mono text-slate-500">{q.marks} Mark(s)</span>
                    </div>

                    <p className="font-sans font-semibold text-sm text-brand-black leading-relaxed">
                      {q.question_text}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px] font-mono text-slate-600">
                      <div>A: {q.option_a}</div>
                      <div>B: {q.option_b}</div>
                      <div>C: {q.option_c}</div>
                      <div>D: {q.option_d}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER & PAGINATION */}
        <div className="p-6 border-t-3 border-brand-black bg-canvas/30 rounded-b-[22px] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-lg border-2 border-brand-black bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-brand-black">
              Page {page} of {totalPages} ({totalQuestions} Total)
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg border-2 border-brand-black bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 text-brand-black rounded-xl font-display font-bold text-xs uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
            >
              Cancel
            </button>

            <MagneticButton variant="primary" size="md" onClick={handleSave}>
              Save Question Selection ({localSelectedIds.length})
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
}
