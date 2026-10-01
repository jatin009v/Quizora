'use client';

import React, { useState, useEffect } from 'react';
import { MarkingMode } from '@/types/database';
import { MagneticButton } from '../ui/MagneticButton';
import { AddQuestionModal } from './AddQuestionModal';
import { generateSecureAccessCode, normalizeAccessCode } from '@/lib/exam/accessCode';
import { CheckCircle2, AlertCircle, Save, Send, Key, Plus, Trash2, Edit3, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function formatForDateTimeInput(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface PaperBuilderFormProps {
  initialData?: any;
  paperId?: string;
  adminName?: string;
  onRefreshData?: () => void;
}

export function PaperBuilderForm({
  initialData,
  paperId,
  adminName = 'Admin Instructor',
  onRefreshData,
}: PaperBuilderFormProps) {
  const router = useRouter();

  // Paper Details State
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [course, setCourse] = useState(initialData?.course || '');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(
    initialData?.duration_minutes !== undefined ? initialData.duration_minutes : ''
  );
  const [requiredCount, setRequiredCount] = useState<number | ''>(
    initialData?.required_question_count !== undefined ? initialData.required_question_count : ''
  );
  const [totalMarks, setTotalMarks] = useState<number | ''>(
    initialData?.total_marks !== undefined ? initialData.total_marks : ''
  );
  const [markingMode, setMarkingMode] = useState<MarkingMode>(initialData?.marking_mode || 'EQUAL_MARKS');
  const [showResultToStudent, setShowResultToStudent] = useState<boolean>(
    initialData?.show_result_to_student ?? false
  );
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(
    initialData?.shuffle_questions ?? true
  );
  const [startAt, setStartAt] = useState<string>(
    formatForDateTimeInput(initialData?.start_at)
  );
  const [endAt, setEndAt] = useState<string>(
    formatForDateTimeInput(initialData?.end_at)
  );

  // Access Code State
  const [accessCode, setAccessCode] = useState<string>(
    initialData?.access_code || ''
  );

  // Question Management State (Paper-Centric Questions)
  const [paperQuestions, setPaperQuestions] = useState<any[]>(
    initialData?.paperQuestions || []
  );
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);

  // Publish Confirmation Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-generate access code if empty for new papers
  useEffect(() => {
    if (!accessCode && !initialData) {
      setAccessCode(generateSecureAccessCode(course || 'DCA'));
    }
  }, [course]);

  useEffect(() => {
    if (initialData) {
      if (initialData.paperQuestions) {
        setPaperQuestions(initialData.paperQuestions);
      }
      if (initialData.start_at !== undefined) {
        setStartAt(formatForDateTimeInput(initialData.start_at));
      }
      if (initialData.end_at !== undefined) {
        setEndAt(formatForDateTimeInput(initialData.end_at));
      }
    }
  }, [initialData]);

  // Clean numeric change handling without leading zeros
  const handleRequiredCountChange = (valStr: string) => {
    if (valStr === '') {
      setRequiredCount('');
      if (markingMode === 'EQUAL_MARKS') setTotalMarks('');
      return;
    }
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setRequiredCount(parsed);
      if (markingMode === 'EQUAL_MARKS' && (totalMarks === '' || totalMarks === 0)) {
        setTotalMarks(parsed);
      }
    }
  };

  const handleDurationChange = (valStr: string) => {
    if (valStr === '') {
      setDurationMinutes('');
      return;
    }
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setDurationMinutes(parsed);
    }
  };

  const handleTotalMarksChange = (valStr: string) => {
    if (valStr === '') {
      setTotalMarks('');
      return;
    }
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setTotalMarks(parsed);
    }
  };

  const handleGenerateAccessCode = () => {
    const newCode = generateSecureAccessCode(course || 'DCA');
    setAccessCode(newCode);
  };

  const reqNum = typeof requiredCount === 'number' ? requiredCount : 0;
  const totNum = typeof totalMarks === 'number' ? totalMarks : 0;
  const perQuestionMark = reqNum > 0 && totNum > 0 ? (totNum / reqNum).toFixed(2) : '1.00';

  const validatePaperForm = (targetStatus: 'DRAFT' | 'PUBLISHED'): string | null => {
    if (!title.trim()) return 'Quiz Name is required.';

    if (targetStatus === 'PUBLISHED') {
      if (!course.trim()) return 'Course Name is required to publish paper.';
      if (!durationMinutes || Number(durationMinutes) <= 0) return 'Valid exam duration (minutes) is required to publish paper.';
      if (!requiredCount || Number(requiredCount) <= 0) return 'Valid required question count is required to publish paper.';
      if (!startAt || !endAt) return 'Access Start and Access End scheduled dates are required to publish paper.';
      if (new Date(startAt).getTime() >= new Date(endAt).getTime()) return 'Exam access start time must be before end time.';
      if (!accessCode || normalizeAccessCode(accessCode).length < 4) return 'Please create an examination access code before publishing.';
      if (paperQuestions.length !== Number(requiredCount)) {
        return `Cannot publish paper: ${requiredCount} questions required, but ${paperQuestions.length} attached.`;
      }
    } else {
      if (startAt && endAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
        return 'Exam access start time must be before end time.';
      }
    }

    return null;
  };

  const handleSavePaper = async (targetStatus: 'DRAFT' | 'PUBLISHED') => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const valErr = validatePaperForm(targetStatus);
    if (valErr) {
      setErrorMessage(valErr);
      return;
    }

    setSaving(true);
    setShowPublishModal(false);

    try {
      const payload = {
        id: paperId || undefined,
        title: title.trim(),
        description: description.trim(),
        course: course.trim(),
        durationMinutes: durationMinutes !== '' ? Number(durationMinutes) : 0,
        requiredQuestionCount: requiredCount !== '' ? Number(requiredCount) : 0,
        totalMarks: totalMarks !== '' ? Number(totalMarks) : 0,
        markingMode,
        accessCode: normalizeAccessCode(accessCode),
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        showResultToStudent,
        shuffleQuestions,
        status: 'DRAFT', // Always save metadata as DRAFT first
      };

      let activePaperId = paperId;

      if (!activePaperId) {
        // Create new paper draft
        const res = await fetch('/api/admin/papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          activePaperId = data.paperId;
        } else {
          setErrorMessage(data.error || 'Failed to create paper draft');
          setSaving(false);
          return;
        }
      } else {
        // Update existing paper metadata
        const res = await fetch(`/api/admin/papers/${activePaperId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMessage(data.error || 'Failed to update paper details');
          setSaving(false);
          return;
        }
      }

      if (targetStatus === 'PUBLISHED' && activePaperId) {
        // Publish paper via dedicated publish endpoint
        const pubRes = await fetch(`/api/admin/papers/${activePaperId}/publish`, {
          method: 'POST',
        });
        const pubData = await pubRes.json();
        if (pubRes.ok && pubData.success) {
          setSuccessMessage('Paper published successfully!');
          router.replace('/admin/papers');
          router.refresh();
          return;
        } else {
          setErrorMessage(pubData.error || 'Failed to publish paper');
          setSaving(false);
          return;
        }
      }

      // If target status is DRAFT
      setSuccessMessage('Paper draft saved successfully!');
      if (onRefreshData) onRefreshData();
      router.replace('/admin/papers');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Server network error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPublishModal = () => {
    setErrorMessage(null);
    const valErr = validatePaperForm('PUBLISHED');
    if (valErr) {
      if (!paperId && paperQuestions.length !== Number(requiredCount)) {
        // Automatically save draft first if new paper
        handleSavePaper('DRAFT');
        return;
      }
      setErrorMessage(valErr);
      return;
    }
    setShowPublishModal(true);
  };

  // Question Delete inside paper
  const handleDeleteQuestion = async (questionId: string) => {
    if (!paperId) return;

    try {
      const res = await fetch(`/api/admin/papers/${paperId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Question removed from paper.');
        if (onRefreshData) onRefreshData();
      } else {
        setErrorMessage(data.error || 'Failed to delete question.');
      }
    } catch {
      setErrorMessage('Network error removing question.');
    }
  };

  const selectedQuestionIds = paperQuestions.map((pq) => pq.question_id || pq.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT FORM & SECTIONS (8 COLS) */}
      <div className="lg:col-span-8 space-y-8">
        {/* 1. EXAMINATION PAPER DETAILS */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
          <h2 className="font-display font-black text-2xl uppercase border-b-2 border-brand-black pb-3">
            1. Examination Paper Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Quiz Name *</label>
              <input
                type="text"
                placeholder="Enter examination name (e.g. DCA Computer Fundamentals)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Course Name *</label>
              <input
                type="text"
                placeholder="Enter course name (e.g. DCA Computer Science)"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1">Description</label>
            <textarea
              placeholder="Enter exam description or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-3 rounded-lg border-2 border-brand-black font-sans focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          {/* MARKS & DURATION STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t-2 border-slate-200">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Required Questions *</label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={requiredCount}
                onChange={(e) => handleRequiredCountChange(e.target.value)}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Duration (Minutes) *</label>
              <input
                type="number"
                placeholder="e.g. 60"
                value={durationMinutes}
                onChange={(e) => handleDurationChange(e.target.value)}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Total Marks *</label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={totalMarks}
                onChange={(e) => handleTotalMarksChange(e.target.value)}
                min={1}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold text-burnt-orange focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. EXAM ACCESS SCHEDULE */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
          <h2 className="font-display font-black text-2xl uppercase border-b-2 border-brand-black pb-3">
            2. Exam Access Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-600 mb-1">Access Start *</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange bg-canvas/40"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-600 mb-1">Access End *</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono text-xs focus:outline-none focus:ring-2 focus:ring-burnt-orange bg-canvas/40"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Students can enter the examination access code only during this scheduled access window.
          </p>
        </div>

        {/* 3. EXAM ACCESS CODE */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-4">
          <div className="flex items-center justify-between border-b-2 border-brand-black pb-3">
            <h2 className="font-display font-black text-2xl uppercase flex items-center gap-2">
              <Key className="w-5 h-5 text-burnt-orange" /> 3. Exam Access Code
            </h2>
            <button
              type="button"
              onClick={handleGenerateAccessCode}
              className="px-3 py-1.5 bg-warm-beige hover:bg-warm-beige-dark font-mono font-bold text-xs uppercase rounded-lg border-2 border-brand-black shadow-editorial flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Generate Secure Code
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold uppercase text-brand-black">ACCESS CODE *</label>
            <input
              type="text"
              placeholder="e.g. DCA7X9P2"
              value={accessCode}
              onChange={(e) => setAccessCode(normalizeAccessCode(e.target.value))}
              maxLength={20}
              className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-black text-lg tracking-widest uppercase bg-warm-beige/30 focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
            <p className="text-xs text-slate-500 font-sans">
              Students must enter this official access code to unlock and start the examination.
            </p>
          </div>
        </div>

        {/* 4. RESULT VISIBILITY */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-black text-2xl uppercase">4. Result Visibility</h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Allow students to view their result immediately after submitting the examination.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResultToStudent(!showResultToStudent)}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial transition-all shrink-0 cursor-pointer ${
                showResultToStudent
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {showResultToStudent ? '[ ON ] Visible to Students' : '[ OFF ] Hidden from Students'}
            </button>
          </div>
        </div>

        {/* 5. QUESTION ORDER SHUFFLE */}
        <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-black text-2xl uppercase">5. Question Order</h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Each student will receive questions in a randomized, shuffle-order sequence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShuffleQuestions(!shuffleQuestions)}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase border-2 border-brand-black shadow-editorial transition-all shrink-0 cursor-pointer ${
                shuffleQuestions
                  ? 'bg-burnt-orange text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {shuffleQuestions ? '[✓] Shuffle Enabled' : '[ ] Shuffle Disabled'}
            </button>
          </div>
        </div>

        {/* 6. QUESTIONS (PAPER-CENTRIC QUESTION MANAGEMENT) */}
        {paperId && (
          <div className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-brand-black pb-3">
              <div>
                <h2 className="font-display font-black text-2xl uppercase">6. Questions</h2>
                <p className="text-xs font-mono text-slate-600 mt-1">
                  {paperQuestions.length} / {reqNum} Questions Added
                </p>
              </div>

              <button
                type="button"
                disabled={paperQuestions.length >= reqNum && reqNum > 0}
                onClick={() => {
                  setEditingQuestion(null);
                  setIsQuestionModalOpen(true);
                }}
                className="py-2.5 px-4 bg-burnt-orange hover:bg-burnt-orange-hover disabled:opacity-50 text-white font-mono font-bold text-xs uppercase rounded-xl border-2 border-brand-black shadow-editorial flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> {paperQuestions.length >= reqNum && reqNum > 0 ? 'Limit Reached' : '+ ADD QUESTION'}
              </button>
            </div>

            {paperQuestions.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl space-y-2">
                <p className="font-mono text-xs font-bold text-slate-600">No questions added directly to this paper yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsQuestionModalOpen(true);
                  }}
                  className="py-2 px-3 bg-warm-beige hover:bg-warm-beige-dark font-mono font-bold text-xs uppercase rounded-lg border-2 border-brand-black shadow-editorial cursor-pointer"
                >
                  Click [+ ADD QUESTION] to create MCQ
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paperQuestions.map((pq, idx) => {
                  const q = pq.questions || pq;

                  return (
                    <div
                      key={q.id || idx}
                      className="p-4 bg-canvas/30 rounded-xl border-2 border-brand-black shadow-editorial flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="bg-brand-black text-white px-2.5 py-1 rounded text-xs font-mono font-bold">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-warm-beige text-brand-black px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border border-brand-black">
                              {q.question_type || 'SINGLE_CHOICE'}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{q.marks || 1} Mark(s)</span>
                          </div>
                          <p className="font-sans font-semibold text-sm text-brand-black leading-snug">
                            {q.question_text}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestion(q);
                            setIsQuestionModalOpen(true);
                          }}
                          className="p-1.5 bg-white hover:bg-slate-100 border-2 border-brand-black rounded-lg cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit3 className="w-4 h-4 text-brand-black" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 border-2 border-red-500 rounded-lg cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR (4 COLS) — SUMMARY & ACTIONS */}
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
              <span className="font-bold text-brand-black">{course || '[ Empty ]'}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Required Questions:</span>
              <span className="font-bold text-brand-black">
                {requiredCount !== '' ? `${requiredCount} Qs` : '[ Empty ]'}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Attached Questions:</span>
              <span
                className={`font-bold ${
                  paperQuestions.length === reqNum && reqNum > 0 ? 'text-emerald-700' : 'text-burnt-orange'
                }`}
              >
                {paperQuestions.length} / {reqNum || 0}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Total Marks:</span>
              <span className="font-bold text-burnt-orange text-sm">
                {totalMarks !== '' ? `${totalMarks} Marks` : '[ Empty ]'}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Duration:</span>
              <span className="font-bold text-brand-black">
                {durationMinutes !== '' ? `${durationMinutes} Mins` : '[ Empty ]'}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-300">
              <span className="text-slate-600">Access Code:</span>
              <span className="font-bold text-deep-blue tracking-wider">{accessCode || '[ Unset ]'}</span>
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

          {/* ACTIONS */}
          <div className="space-y-3 pt-2">
            <MagneticButton
              variant="primary"
              size="lg"
              onClick={handleOpenPublishModal}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" /> PUBLISH PAPER
            </MagneticButton>

            <button
              type="button"
              onClick={() => handleSavePaper('DRAFT')}
              disabled={saving}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-brand-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-brand-black shadow-editorial flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'SAVE DRAFT'}
            </button>
          </div>
        </div>
      </div>

      {/* ADD / EDIT QUESTION MODAL */}
      {paperId && (
        <AddQuestionModal
          isOpen={isQuestionModalOpen}
          onClose={() => setIsQuestionModalOpen(false)}
          paperId={paperId}
          initialQuestionData={editingQuestion}
          onSaveSuccess={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-brand-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6 relative">
            <button
              onClick={() => setShowPublishModal(false)}
              className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b-2 border-brand-black pb-3">
              <Send className="w-6 h-6 text-burnt-orange" />
              <h3 className="font-display font-black text-2xl uppercase">Publish Examination</h3>
            </div>

            <p className="text-sm font-sans text-slate-700">
              Are you sure you want to publish <strong className="text-brand-black">{title}</strong>? Once published, students can enter the examination using the access code during the scheduled access window.
            </p>

            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600">Exam Title:</span>
                <span className="font-bold text-brand-black">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Questions:</span>
                <span className="font-bold text-brand-black">{paperQuestions.length} / {reqNum} Qs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Duration:</span>
                <span className="font-bold text-brand-black">{durationMinutes} Mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Access Window:</span>
                <span className="font-bold text-brand-black font-xs">
                  {startAt && endAt ? `${startAt.replace('T', ' ')} to ${endAt.replace('T', ' ')}` : 'Scheduled Window'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Result Visibility:</span>
                <span className={`font-bold ${showResultToStudent ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {showResultToStudent ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Question Shuffle:</span>
                <span className="font-bold text-burnt-orange">{shuffleQuestions ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300 text-sm">
                <span className="text-slate-700 font-bold">Access Code:</span>
                <span className="font-bold text-deep-blue tracking-widest">{accessCode}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-3 px-4 bg-warm-beige hover:bg-warm-beige-dark text-brand-black rounded-xl font-display font-bold text-xs uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
              >
                Cancel
              </button>

              <MagneticButton
                variant="primary"
                size="md"
                onClick={() => handleSavePaper('PUBLISHED')}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Publishing...' : 'CONFIRM & PUBLISH'}
              </MagneticButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
