'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { ArrowLeft, Plus, Search, Filter, HelpCircle, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Question } from '@/types/database';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('ALL');

  // Modal State for New Question Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [marks, setMarks] = useState(1);
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchQuestions = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDifficulty !== 'ALL') params.set('difficulty', filterDifficulty);
    if (searchQuery) params.set('query', searchQuery);

    fetch(`/api/admin/questions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setQuestions(data.questions || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuestions();
  }, [filterDifficulty, searchQuery]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText,
          difficulty,
          marks: Number(marks),
          option_a: optionA,
          option_b: optionB,
          option_c: optionC,
          option_d: optionD,
          correct_option: correctOption,
          explanation,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Question created successfully in Question Bank!');
        setQuestionText('');
        setOptionA('');
        setOptionB('');
        setOptionC('');
        setOptionD('');
        setExplanation('');
        fetchQuestions();
        setTimeout(() => setShowCreateModal(false), 1200);
      } else {
        setErrorMsg(data.error || 'Failed to create question.');
      }
    } catch {
      setErrorMsg('Network error while creating question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-4 border-brand-black">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-black" />
            </Link>
            <div>
              <span className="bg-deep-blue text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                QUESTION BANK
              </span>
              <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
                MCQ Question Repository
              </h1>
            </div>
          </div>

          <MagneticButton variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add New Question
          </MagneticButton>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white p-4 rounded-xl border-3 border-brand-black shadow-editorial flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search questions by text or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-2 border-brand-black rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="px-3 py-2 bg-slate-50 border-2 border-brand-black rounded-lg font-mono text-xs font-bold uppercase focus:outline-none"
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        {/* QUESTIONS LIST */}
        {loading ? (
          <div className="text-center py-16 font-mono text-sm font-bold text-slate-500">
            Loading Question Bank...
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
            <HelpCircle className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="font-display font-black text-2xl uppercase">No Questions Found</h3>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              No MCQs match your search criteria. Click &quot;Add New Question&quot; to expand your question bank.
            </p>
            <MagneticButton variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add First Question
            </MagneticButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">#Q{idx + 1}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-brand-black ${
                          q.difficulty === 'HARD'
                            ? 'bg-red-100 text-red-700'
                            : q.difficulty === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-bold border border-slate-300">
                        {q.marks || 1} Marks
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-brand-black">{q.question_text}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div className={`p-3 rounded-lg border text-sm font-medium ${q.correct_option === 'A' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="font-mono font-bold mr-2">A.</span> {q.option_a}
                  </div>
                  <div className={`p-3 rounded-lg border text-sm font-medium ${q.correct_option === 'B' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="font-mono font-bold mr-2">B.</span> {q.option_b}
                  </div>
                  <div className={`p-3 rounded-lg border text-sm font-medium ${q.correct_option === 'C' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="font-mono font-bold mr-2">C.</span> {q.option_c}
                  </div>
                  <div className={`p-3 rounded-lg border text-sm font-medium ${q.correct_option === 'D' ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="font-mono font-bold mr-2">D.</span> {q.option_d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CREATE QUESTION MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border-4 border-brand-black rounded-3xl shadow-editorial max-w-2xl w-full p-6 md:p-8 space-y-6 relative my-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 border-2 border-brand-black rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-brand-black" />
              </button>

              <div>
                <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                  QUESTION CREATOR
                </span>
                <h2 className="font-display font-black text-3xl uppercase text-brand-black mt-1">
                  Add New MCQ to Question Bank
                </h2>
              </div>

              {errorMsg && (
                <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-700 text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                    Question Text *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Enter full MCQ question statement..."
                    className="w-full p-3 bg-slate-50 border-2 border-brand-black rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border-2 border-brand-black rounded-xl font-mono text-sm font-bold uppercase focus:outline-none"
                    >
                      <option value="EASY">EASY</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                      Default Marks
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={marks}
                      onChange={(e) => setMarks(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border-2 border-brand-black rounded-xl font-mono text-sm font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                    Answer Options *
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-500">Option A</span>
                      <input
                        required
                        type="text"
                        value={optionA}
                        onChange={(e) => setOptionA(e.target.value)}
                        placeholder="Option A text..."
                        className="w-full p-2.5 bg-slate-50 border-2 border-brand-black rounded-lg text-sm font-medium focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-mono font-bold text-slate-500">Option B</span>
                      <input
                        required
                        type="text"
                        value={optionB}
                        onChange={(e) => setOptionB(e.target.value)}
                        placeholder="Option B text..."
                        className="w-full p-2.5 bg-slate-50 border-2 border-brand-black rounded-lg text-sm font-medium focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-mono font-bold text-slate-500">Option C</span>
                      <input
                        required
                        type="text"
                        value={optionC}
                        onChange={(e) => setOptionC(e.target.value)}
                        placeholder="Option C text..."
                        className="w-full p-2.5 bg-slate-50 border-2 border-brand-black rounded-lg text-sm font-medium focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-mono font-bold text-slate-500">Option D</span>
                      <input
                        required
                        type="text"
                        value={optionD}
                        onChange={(e) => setOptionD(e.target.value)}
                        placeholder="Option D text..."
                        className="w-full p-2.5 bg-slate-50 border-2 border-brand-black rounded-lg text-sm font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                      Correct Option (Server-Graded) *
                    </label>
                    <select
                      value={correctOption}
                      onChange={(e) => setCorrectOption(e.target.value as any)}
                      className="w-full p-3 bg-emerald-50 border-2 border-emerald-600 font-mono font-bold text-emerald-900 rounded-xl focus:outline-none"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                      Explanation (Optional)
                    </label>
                    <input
                      type="text"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Rationale for correct answer..."
                      className="w-full p-3 bg-slate-50 border-2 border-brand-black rounded-xl font-medium text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t-2 border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 bg-slate-100 border-2 border-brand-black rounded-xl font-bold text-sm hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <MagneticButton variant="primary" size="md">
                    {submitting ? 'Saving...' : 'Save Question to Bank'}
                  </MagneticButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
