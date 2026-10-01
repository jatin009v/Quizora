'use client';

import React, { useState, useEffect } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { X, AlertCircle, CheckSquare, CircleDot, Code } from 'lucide-react';
import { QuestionType } from '@/types/database';

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
  const [questionType, setQuestionType] = useState<QuestionType>('SINGLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [marks, setMarks] = useState<number | ''>(1);

  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');

  // Single choice / True-False correct option string ('A', 'B', 'C', 'D')
  const [correctOption, setCorrectOption] = useState<string>('A');

  // Multiple choice correct options array (e.g. ['A', 'C', 'D'])
  const [correctOptionsMultiple, setCorrectOptionsMultiple] = useState<string[]>(['A']);

  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialQuestionData) {
        const q = initialQuestionData.questions || initialQuestionData;
        const qType: QuestionType = (q.question_type || 'SINGLE_CHOICE') as QuestionType;
        setQuestionType(qType);
        setQuestionText(q.question_text || '');
        setCodeSnippet(q.code_snippet || '');
        setMarks(q.marks || 1);
        setOptionA(q.option_a || '');
        setOptionB(q.option_b || '');
        setOptionC(q.option_c || '');
        setOptionD(q.option_d || '');
        setExplanation(q.explanation || '');

        const rawCorr = String(q.correct_option || 'A').toUpperCase().trim();
        if (qType === 'MULTIPLE_CHOICE' || qType === 'MCQ_MULTIPLE') {
          const list = rawCorr.split(',').map((s) => s.trim()).filter(Boolean);
          setCorrectOptionsMultiple(list.length > 0 ? list : ['A']);
          setCorrectOption(rawCorr);
        } else {
          setCorrectOption(rawCorr);
        }
      } else {
        setQuestionType('SINGLE_CHOICE');
        setQuestionText('');
        setCodeSnippet('');
        setMarks(1);
        setOptionA('');
        setOptionB('');
        setOptionC('');
        setOptionD('');
        setCorrectOption('A');
        setCorrectOptionsMultiple(['A']);
        setExplanation('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialQuestionData]);

  // Handle Question Type Switching Defaults
  const handleQuestionTypeChange = (type: QuestionType) => {
    setQuestionType(type);
    if (type === 'TRUE_FALSE') {
      if (!optionA) setOptionA('True');
      if (!optionB) setOptionB('False');
      setOptionC('-');
      setOptionD('-');
      if (correctOption !== 'A' && correctOption !== 'B') {
        setCorrectOption('A');
      }
    } else {
      if (optionA === 'True') setOptionA('');
      if (optionB === 'False') setOptionB('');
      if (optionC === '-') setOptionC('');
      if (optionD === '-') setOptionD('');
    }
  };

  const toggleMultipleOption = (opt: 'A' | 'B' | 'C' | 'D') => {
    setCorrectOptionsMultiple((prev) => {
      if (prev.includes(opt)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((o) => o !== opt);
      } else {
        return [...prev, opt].sort();
      }
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!questionText.trim()) {
      setErrorMsg('Question statement text is required.');
      return;
    }

    if (questionType === 'TRUE_FALSE') {
      const optA = optionA.trim() || 'True';
      const optB = optionB.trim() || 'False';
      if (!['A', 'B'].includes(correctOption)) {
        setErrorMsg('Please select True or False as the correct option.');
        return;
      }
    } else {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        setErrorMsg('All 4 answer options (Option A, B, C, and D) are required.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const isEditing = !!initialQuestionData;
      const questionId = initialQuestionData?.question_id || initialQuestionData?.id;
      const url = isEditing
        ? `/api/admin/papers/${paperId}/questions/${questionId}`
        : `/api/admin/papers/${paperId}/questions`;
      const method = isEditing ? 'PUT' : 'POST';

      let payloadCorrect = correctOption;
      if (questionType === 'MULTIPLE_CHOICE' || questionType === 'MCQ_MULTIPLE') {
        payloadCorrect = correctOptionsMultiple.sort().join(',');
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText.trim(),
          question_type: questionType,
          marks: marks !== '' ? Number(marks) : 1,
          option_a: questionType === 'TRUE_FALSE' ? (optionA.trim() || 'True') : optionA.trim(),
          option_b: questionType === 'TRUE_FALSE' ? (optionB.trim() || 'False') : optionB.trim(),
          option_c: questionType === 'TRUE_FALSE' ? '-' : optionC.trim(),
          option_d: questionType === 'TRUE_FALSE' ? '-' : optionD.trim(),
          correct_option: payloadCorrect,
          code_snippet: codeSnippet.trim() || null,
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
      <div className="bg-white max-w-3xl w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 hover:bg-slate-100 rounded-xl border-2 border-brand-black cursor-pointer"
        >
          <X className="w-5 h-5 text-brand-black" />
        </button>

        <div>
          <span className="bg-burnt-orange text-white px-3 py-0.5 rounded font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial">
            NEW QUESTION AUTHORING SYSTEM
          </span>
          <h2 className="font-display font-black text-2xl uppercase text-brand-black mt-1">
            {initialQuestionData ? 'Edit Question in Paper' : 'Add New Question to Paper'}
          </h2>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* QUESTION TYPE & MARKS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase mb-1 text-brand-black">
                QUESTION TYPE *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuestionTypeChange('SINGLE_CHOICE')}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    questionType === 'SINGLE_CHOICE' || questionType === 'MCQ_SINGLE'
                      ? 'bg-burnt-orange text-white border-brand-black shadow-editorial'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-brand-black'
                  }`}
                >
                  <CircleDot className="w-3.5 h-3.5" /> Single
                </button>

                <button
                  type="button"
                  onClick={() => handleQuestionTypeChange('MULTIPLE_CHOICE')}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    questionType === 'MULTIPLE_CHOICE' || questionType === 'MCQ_MULTIPLE'
                      ? 'bg-vibrant-pink text-white border-brand-black shadow-editorial'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-brand-black'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Multiple
                </button>

                <button
                  type="button"
                  onClick={() => handleQuestionTypeChange('TRUE_FALSE')}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    questionType === 'TRUE_FALSE'
                      ? 'bg-deep-blue text-white border-brand-black shadow-editorial'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-brand-black'
                  }`}
                >
                  True / False
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1 text-brand-black">
                MARKS *
              </label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                min={1}
                className="w-full p-2.5 rounded-xl border-2 border-brand-black font-mono text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* QUESTION TEXT STATEMENT (MULTILINE) */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1">
              QUESTION TEXT STATEMENT *
            </label>
            <textarea
              placeholder="Enter full question statement (supports multiline text & formatting)..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={4}
              required
              className="w-full p-3.5 rounded-xl border-2 border-brand-black font-sans text-sm focus:outline-none focus:ring-2 focus:ring-burnt-orange leading-relaxed"
            />
          </div>

          {/* CODE / CODE-BASED QUESTION CONTENT */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1 text-slate-700 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-burnt-orange" /> CODE BLOCK / PROGRAM SNIPPET (MULTILINE CODE)
            </label>
            <textarea
              placeholder="Paste multiline code snippet here (e.g. #include <stdio.h> \n int main() { ... })..."
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              rows={4}
              className="w-full p-3.5 rounded-xl border-2 border-brand-black font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-normal"
            />
          </div>

          {/* ANSWER OPTIONS INPUTS */}
          {questionType === 'TRUE_FALSE' ? (
            <div className="space-y-3 pt-2 border-t-2 border-slate-200">
              <label className="block text-xs font-mono font-bold uppercase text-brand-black">
                TRUE / FALSE OPTIONS
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-100 p-3 rounded-xl border-2 border-brand-black font-mono text-sm font-bold text-emerald-700">
                  Option A: True
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border-2 border-brand-black font-mono text-sm font-bold text-rose-700">
                  Option B: False
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t-2 border-slate-200">
              <label className="block text-xs font-mono font-bold uppercase text-brand-black">
                ANSWER OPTIONS (MULTILINE CODE & TEXT SUPPORTED) *
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] font-mono font-bold text-slate-600 mb-1">Option A</span>
                  <textarea
                    placeholder="Option A content..."
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2.5 rounded-xl border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>

                <div>
                  <span className="block text-[11px] font-mono font-bold text-slate-600 mb-1">Option B</span>
                  <textarea
                    placeholder="Option B content..."
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2.5 rounded-xl border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>

                <div>
                  <span className="block text-[11px] font-mono font-bold text-slate-600 mb-1">Option C</span>
                  <textarea
                    placeholder="Option C content..."
                    value={optionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2.5 rounded-xl border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>

                <div>
                  <span className="block text-[11px] font-mono font-bold text-slate-600 mb-1">Option D</span>
                  <textarea
                    placeholder="Option D content..."
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2.5 rounded-xl border-2 border-brand-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CORRECT ANSWER SELECTOR */}
          <div className="pt-3 border-t-2 border-slate-200">
            <label className="block text-xs font-mono font-bold uppercase mb-2 text-brand-black">
              CORRECT ANSWER CONFIGURATION (SERVER-GRADED) *
            </label>

            {questionType === 'TRUE_FALSE' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCorrectOption('A')}
                  className={`p-3 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    correctOption === 'A'
                      ? 'bg-emerald-600 text-white border-brand-black shadow-editorial'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <CircleDot className="w-4 h-4" /> Correct: True (A)
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectOption('B')}
                  className={`p-3 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    correctOption === 'B'
                      ? 'bg-emerald-600 text-white border-brand-black shadow-editorial'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <CircleDot className="w-4 h-4" /> Correct: False (B)
                </button>
              </div>
            ) : questionType === 'MULTIPLE_CHOICE' || questionType === 'MCQ_MULTIPLE' ? (
              <div>
                <p className="text-xs text-slate-600 mb-2 font-mono">
                  Select ALL correct options (Checkboxes):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const isChecked = correctOptionsMultiple.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMultipleOption(opt)}
                        className={`p-3 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-vibrant-pink text-white border-brand-black shadow-editorial'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-brand-black'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4" /> Option {opt}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-mono text-vibrant-pink font-bold mt-2">
                  Selected Correct Options: {correctOptionsMultiple.sort().join(' + ')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCorrectOption(opt)}
                    className={`p-3 rounded-xl border-2 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      correctOption === opt
                        ? 'bg-emerald-600 text-white border-brand-black shadow-editorial'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-brand-black'
                    }`}
                  >
                    <CircleDot className="w-4 h-4" /> Option {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* EXPLANATION */}
          <div className="pt-2 border-t-2 border-slate-200">
            <label className="block text-xs font-mono font-bold uppercase mb-1">
              EXPLANATION (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="Rationale / explanation for the correct answer..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-brand-black font-sans text-xs focus:outline-none"
            />
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
