'use client';

import React, { useState, useEffect } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { X, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperId: string;
  initialQuestionData?: any;
  onSaveSuccess: () => void;
}

export function AddQuestionModal({
  isOpen,
  onClose,
  paperId,
  initialQuestionData,
  onSaveSuccess,
}: AddQuestionModalProps) {
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [marks, setMarks] = useState<number | ''>(1);
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialQuestionData) {
        const q = initialQuestionData.questions || initialQuestionData;
        setQuestionText(q.question_text || '');
        setDifficulty(q.difficulty || 'MEDIUM');
        setMarks(q.marks || 1);
        setOptionA(q.option_a || '');
        setOptionB(q.option_b || '');
        setOptionC(q.option_c || '');
        setOptionD(q.option_d || '');
        setCorrectOption(q.correct_option || 'A');
        setExplanation(q.explanation || '');
      } else {
        setQuestionText('');
        setDifficulty('MEDIUM');
        setMarks(1);
        setOptionA('');
        setOptionB('');
        setOptionC('');
        setOptionD('');
        setCorrectOption('A');
        setExplanation('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialQuestionData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!questionText.trim()) {
      setErrorMsg('Question statement text is required.');
      return;
    }
    if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setErrorMsg('All 4 answer options (Option A, B, C, and D) are required.');
      return;
    }

    setSubmitting(true);

    try {
      const isEditing = !!initialQuestionData;
      const questionId = initialQuestionData?.question_id || initialQuestionData?.id;
      const url = isEditing
        ? `/api/admin/papers/${paperId}/questions/${questionId}`
        : `/api/admin/papers/${paperId}/questions`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText.trim(),
          difficulty,
          marks: marks !== '' ? Number(marks) : 1,
          option_a: optionA.trim(),
          option_b: optionB.trim(),
          option_c: optionC.trim(),
          option_d: optionD.trim(),
          correct_option: correctOption,
          explanation: explanation.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSaveSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to save question.');
      }
    } catch {
      setErrorMsg('Network error while saving question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 hover:bg-slate-100 rounded-xl border-2 border-brand-black cursor-pointer"
        >
          <X className="w-5 h-5 text-brand-black" />
        </button>

        <div>
          <span className="bg-burnt-orange text-white px-3 py-0.5 rounded font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial">
            QUESTION CREATOR
          </span>
          <h2 className="font-display font-black text-2xl uppercase text-brand-black mt-1">
            {initialQuestionData ? 'Edit Question in Examination' : 'Add Question to Examination'}
          </h2>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1">
              QUESTION TEXT *
            </label>
            <textarea
              placeholder="Enter full MCQ question statement..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              required
              className="w-full p-3 rounded-lg border-2 border-brand-black font-sans focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">
                DIFFICULTY LEVEL
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono text-xs focus:outline-none cursor-pointer bg-white"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">
                DEFAULT MARKS
              </label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t-2 border-slate-200">
            <label className="block text-xs font-mono font-bold uppercase text-brand-black">
              ANSWER OPTIONS *
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-mono font-bold text-slate-500 mb-0.5">Option A</span>
                <input
                  type="text"
                  placeholder="Option A text..."
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                />
              </div>

              <div>
                <span className="block text-[11px] font-mono font-bold text-slate-500 mb-0.5">Option B</span>
                <input
                  type="text"
                  placeholder="Option B text..."
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                />
              </div>

              <div>
                <span className="block text-[11px] font-mono font-bold text-slate-500 mb-0.5">Option C</span>
                <input
                  type="text"
                  placeholder="Option C text..."
                  value={optionC}
                  onChange={(e) => setOptionC(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                />
              </div>

              <div>
                <span className="block text-[11px] font-mono font-bold text-slate-500 mb-0.5">Option D</span>
                <input
                  type="text"
                  placeholder="Option D text..."
                  value={optionD}
                  onChange={(e) => setOptionD(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t-2 border-slate-200">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">
                CORRECT OPTION (SERVER-GRADED) *
              </label>
              <select
                value={correctOption}
                onChange={(e) => setCorrectOption(e.target.value as any)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono text-xs font-bold focus:outline-none cursor-pointer bg-emerald-50 border-emerald-600 text-emerald-800"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">
                EXPLANATION (OPTIONAL)
              </label>
              <input
                type="text"
                placeholder="Rationale for correct answer..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 text-brand-black font-mono font-bold text-xs uppercase rounded-xl border-2 border-brand-black shadow-editorial cursor-pointer"
            >
              Cancel
            </button>

            <MagneticButton variant="primary" size="md" disabled={submitting}>
              {submitting ? 'Saving Question...' : initialQuestionData ? 'Update Question' : 'Add Question to Paper'}
            </MagneticButton>
          </div>
        </form>
      </div>
    </div>
  );
}
