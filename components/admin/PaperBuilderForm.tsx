'use client';

import React, { useState, useEffect } from 'react';
import { Question, MarkingMode } from '@/types/database';
import { MagneticButton } from '../ui/MagneticButton';
import {
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PaperBuilderFormProps {
  initialData?: any;
  paperId?: string;
  adminName?: string;
}

export function PaperBuilderForm({
  initialData,
  paperId,
  adminName = 'Admin Instructor',
}: PaperBuilderFormProps) {
  const router = useRouter();

  // Paper Details State
  const [title, setTitle] = useState(initialData?.title || 'DCA Computer Fundamentals Examination');
  const [description, setDescription] = useState(initialData?.description || 'Comprehensive exam covering Data Structures, SQL, Web Dev, and Operating Systems.');
  const [course, setCourse] = useState(initialData?.course || 'DCA Computer Science');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.duration_minutes || 60);
  const [requiredCount, setRequiredCount] = useState(initialData?.required_question_count || 50);
  const [totalMarks, setTotalMarks] = useState(initialData?.total_marks || 50);
  const [markingMode, setMarkingMode] = useState<MarkingMode>(initialData?.marking_mode || 'EQUAL_MARKS');

  // Question Bank & Selection State
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    initialData?.paperQuestions?.map((pq: any) => pq.question_id) || []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Question Bank
  useEffect(() => {
    fetch('/api/admin/questions')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAvailableQuestions(data.questions || []);
        }
      })
      .catch(() => {
        // Generate mock fallback questions if DB is unseeded
        const mockQs: Question[] = [];
        for (let i = 1; i <= 60; i++) {
          mockQs.push({
            id: `q-${i}-uuid`,
            question_text: `[DCA Q${i}] Sample question item for test paper generation?`,
            question_type: 'MCQ_SINGLE',
            difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY',
            option_a: 'Option A answer',
            option_b: 'Option B answer',
            option_c: 'Option C answer',
            option_d: 'Option D answer',
            marks: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setAvailableQuestions(mockQs);

        // Auto-select first N questions if creating new
        if (!initialData) {
          setSelectedQuestionIds(mockQs.slice(0, 50).map((q) => q.id));
        }
      });
  }, [initialData]);

  // Handle Default Marks calculation rule (50 questions = 50 marks default)
  const handleRequiredCountChange = (val: number) => {
    setRequiredCount(val);
    if (markingMode === 'EQUAL_MARKS') {
      setTotalMarks(val); // 1:1 default rule
    }
  };

  const perQuestionMark = requiredCount > 0 ? (totalMarks / requiredCount).toFixed(2) : '1.00';

  const toggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      if (prev.includes(qId)) {
        return prev.filter((id) => id !== qId);
      } else {
        if (prev.length >= requiredCount) {
          setErrorMessage(`You have reached the required limit of ${requiredCount} questions.`);
          return prev;
        }
        setErrorMessage(null);
        return [...prev, qId];
      }
    });
  };

  const moveQuestionOrder = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === selectedQuestionIds.length - 1)
    ) {
      return;
    }

    const newArr = [...selectedQuestionIds];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setSelectedQuestionIds(newArr);
  };

  const handleSaveDraft = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (selectedQuestionIds.length !== requiredCount) {
      setErrorMessage(`Please select exactly ${requiredCount} questions (Currently selected: ${selectedQuestionIds.length}).`);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        id: paperId,
        title,
        description,
        course,
        durationMinutes: Number(durationMinutes),
        requiredQuestionCount: Number(requiredCount),
        totalMarks: Number(totalMarks),
        markingMode,
        status: 'DRAFT',
        selectedQuestions: selectedQuestionIds.map((qId, idx) => ({
          questionId: qId,
          questionOrder: idx + 1,
          marks: Number(perQuestionMark),
        })),
      };

      const url = paperId ? `/api/admin/papers/${paperId}` : '/api/admin/papers';
      const method = paperId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage('Paper draft saved successfully!');
        setTimeout(() => {
          router.push('/admin/papers');
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Failed to save paper draft');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Server network error');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Question Bank
  const filteredQuestions = availableQuestions.filter((q) => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = filterDifficulty === 'ALL' || q.difficulty === filterDifficulty;
    const matchesType = filterType === 'ALL' || q.question_type === filterType;
    return matchesSearch && matchesDifficulty && matchesType;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT FORM & SELECTION (8 COLS) */}
      <div className="lg:col-span-8 space-y-8">
        {/* PAPER DETAILS CARD */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
          <h2 className="font-display font-black text-2xl uppercase border-b-2 border-brand-black pb-3">
            1. Examination Paper Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Quiz Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Course Name</label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-3 rounded-lg border-2 border-brand-black font-sans focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          {/* MARKS & DURATION CALCULATOR STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t-2 border-slate-200">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Required Questions</label>
              <input
                type="number"
                value={requiredCount}
                onChange={(e) => handleRequiredCountChange(Number(e.target.value))}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Duration (Minutes)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold text-burnt-orange focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* QUESTION BANK SELECTOR */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-brand-black pb-3">
            <div>
              <h2 className="font-display font-black text-2xl uppercase">2. Question Bank Selection</h2>
              <p className="text-xs text-slate-500 font-mono">
                Selected {selectedQuestionIds.length} / {requiredCount} Questions
              </p>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs rounded-lg border-2 border-brand-black font-mono focus:outline-none"
                />
              </div>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="py-2 px-3 text-xs rounded-lg border-2 border-brand-black font-mono focus:outline-none cursor-pointer"
              >
                <option value="ALL">Difficulty: All</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          {/* QUESTIONS CATALOG LIST */}
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestionIds.includes(q.id);

              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelectQuestion(q.id)}
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
                      <span className="text-xs font-mono text-slate-500">{q.marks} Mark</span>
                    </div>

                    <p className="font-sans font-semibold text-sm text-brand-black leading-relaxed">
                      {q.question_text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR (4 COLS) — LIVE SUMMARY PANEL */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-warm-beige p-6 rounded-2xl border-3 border-brand-black shadow-editorial sticky top-24 space-y-6">
          <h3 className="font-display font-black text-xl uppercase border-b-2 border-brand-black pb-2">
            Paper Summary Panel
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Created By:</span>
              <span className="font-bold text-brand-black">{adminName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Target Course:</span>
              <span className="font-bold text-brand-black">{course}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Required Questions:</span>
              <span className="font-bold text-brand-black">{requiredCount} Qs</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Selected Questions:</span>
              <span
                className={`font-bold ${
                  selectedQuestionIds.length === requiredCount
                    ? 'text-emerald-700'
                    : 'text-burnt-orange'
                }`}
              >
                {selectedQuestionIds.length} / {requiredCount}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Total Marks:</span>
              <span className="font-bold text-burnt-orange text-sm">{totalMarks} Marks</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Marks Per Question:</span>
              <span className="font-bold text-vibrant-pink text-sm">{perQuestionMark} Marks/Q</span>
            </div>
          </div>

          {/* STATUS NOTIFICATIONS */}
          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 rounded-lg text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-100 border-2 border-emerald-500 rounded-lg text-xs font-mono font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMessage}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <MagneticButton
              variant="primary"
              size="lg"
              onClick={handleSaveDraft}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> {saving ? 'Saving Draft...' : 'Save Paper Draft'}
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
}
