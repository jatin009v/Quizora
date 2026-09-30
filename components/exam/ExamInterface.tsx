'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ClientQuestion, ExamAttempt, ProctorEventType, AttemptStatus } from '@/types/database';
import { answerQueueEngine, SaveStatus } from '@/lib/exam/answerQueue';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  Maximize2,
  X,
  EyeOff,
  Send,
  Award,
} from 'lucide-react';
import { MagneticButton } from '../ui/MagneticButton';
import Link from 'next/link';

interface ExamInterfaceProps {
  attempt: ExamAttempt;
  questions: ClientQuestion[];
  initialAnswers?: Record<string, string>;
  initialQuestionIndex?: number;
  showResultToStudent?: boolean;
}

export function ExamInterface({
  attempt: initialAttempt,
  questions,
  initialAnswers = {},
  initialQuestionIndex = 0,
  showResultToStudent = false,
}: ExamInterfaceProps) {
  const [attempt, setAttempt] = useState<ExamAttempt>(initialAttempt);
  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Status & Lock tracking
  const [attemptStatus, setAttemptStatus] = useState<AttemptStatus>(initialAttempt.status);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(initialAttempt.tab_switch_count || 0);

  // Fullscreen & Overlay States
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Submission States
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    score?: number;
    totalMarks?: number;
    percentage?: number;
    submittedAt?: string;
  } | null>(null);

  const [remainingTime, setRemainingTime] = useState(() => {
    if (initialAttempt.expires_at) {
      return Math.max(0, Math.floor((new Date(initialAttempt.expires_at).getTime() - Date.now()) / 1000));
    }
    return 3600;
  });

  const currentQuestion = questions[currentIndex] || questions[0];
  const isLocked = attemptStatus === 'LOCKED';
  const isUnloadingRef = React.useRef(false);

  // Unload listener: Mark page as unloading so page refresh doesn't trigger false violations
  useEffect(() => {
    const handleUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // Helper to send proctor events to server safely
  const sendProctorEvent = useCallback(
    async (eventType: ProctorEventType, metadata: Record<string, any> = {}) => {
      if (attemptStatus === 'SUBMITTED' || isUnloadingRef.current) return;

      try {
        const res = await fetch('/api/exam/proctor-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: attempt.id,
            eventType,
            questionIndex: currentIndex,
            metadata,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const { tabSwitchCount: updatedCount, isLocked: serverLocked, status: serverStatus, warningMessage: msg } = json.data;

          if (updatedCount !== undefined) setTabSwitchCount(updatedCount);
          if (serverLocked || serverStatus === 'LOCKED') {
            setAttemptStatus('LOCKED');
          }
          if (msg) {
            setWarningMessage(msg);
          }
        }
      } catch {
        // Silently handle background event failure
      }
    },
    [attempt.id, attemptStatus, currentIndex]
  );

  // 1. Subscribe to answer persistence queue updates
  useEffect(() => {
    const unsubscribe = answerQueueEngine.subscribe((payload) => {
      setSaveStatuses((prev) => ({
        ...prev,
        [payload.questionId]: payload.status,
      }));

      if (payload.status === 'SAVED') {
        setLastSavedTime(payload.lastSavedAt || new Date().toLocaleTimeString());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Final Submission Handler
  const executeSubmission = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step A: Attempt to flush pending queue in background
      try {
        await answerQueueEngine.flushPendingAnswers();
      } catch {
        // Continue to submission reconciliation even if queue flush timed out
      }

      // Step B: Send official submit request with client answers dictionary for server-side reconciliation
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          unconfirmedAnswers: answers,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setAttemptStatus('SUBMITTED');
        setShowSubmitModal(false);
        if (json.data) {
          setSubmissionResult({
            score: json.data.score,
            totalMarks: json.data.totalMarks,
            percentage: json.data.percentage,
            submittedAt: json.data.submittedAt,
          });
        }
      } else {
        setSubmitError(json.error || 'Failed to submit exam. Please try again.');
      }
    } catch {
      setSubmitError('Network failure submitting exam. Please check connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt.id, answers]);

  // 3. Timer Countdown & Automatic Server Submission on Expiry
  useEffect(() => {
    if (isLocked || attemptStatus === 'SUBMITTED') return;

    if (remainingTime <= 0) {
      executeSubmission();
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, attemptStatus, remainingTime, executeSubmission]);

  // 4. Status Polling for Proctor Lock/Reopen Synchronization
  useEffect(() => {
    if (attemptStatus === 'SUBMITTED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/exam/attempt/${attempt.id}`);
        const json = await res.json();
        if (res.ok && json.success && json.data?.attempt) {
          const freshAttempt: ExamAttempt = json.data.attempt;
          setAttempt(freshAttempt);
          setAttemptStatus(freshAttempt.status);
          setTabSwitchCount(freshAttempt.tab_switch_count);

          // Update saved answers from server recovery if needed
          if (json.data.savedAnswers) {
            setAnswers((prev) => ({ ...json.data.savedAnswers, ...prev }));
          }

          // Update remaining time from server expires_at
          if (freshAttempt.expires_at) {
            const rem = Math.max(0, Math.floor((new Date(freshAttempt.expires_at).getTime() - Date.now()) / 1000));
            setRemainingTime(rem);
          }
        }
      } catch {
        // Silent polling catch
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [attempt.id, attemptStatus]);

  // 5. Browser Integrity Listeners (Fullscreen, Visibility, Focus/Blur)
  useEffect(() => {
    if (isLocked || attemptStatus === 'SUBMITTED') return;

    setIsFullscreen(!!document.fullscreenElement);

    const handleFullscreenChange = () => {
      if (isUnloadingRef.current) return;
      const inFS = !!document.fullscreenElement;
      setIsFullscreen(inFS);
      if (!inFS) {
        sendProctorEvent('FULLSCREEN_EXIT');
      } else {
        sendProctorEvent('FULLSCREEN_ENTER');
      }
    };

    const handleVisibilityChange = () => {
      if (isUnloadingRef.current) return;
      if (document.visibilityState === 'hidden') {
        sendProctorEvent('TAB_SWITCH');
      }
    };

    const handleBlur = () => {
      if (isUnloadingRef.current) return;
      sendProctorEvent('WINDOW_BLUR');
    };

    const handleFocus = () => {
      if (isUnloadingRef.current) return;
      sendProctorEvent('WINDOW_FOCUS');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLocked, attemptStatus, sendProctorEvent]);

  // Request fullscreen restoration
  const handleRequestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // Permission or browser restriction
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion || isLocked || attemptStatus === 'SUBMITTED') return;

    // 1. Instant UI update
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));

    // 2. Dispatch to Persistence Queue Engine immediately
    answerQueueEngine.enqueueAnswer(attempt.id, currentQuestion.id, option);
  };

  const handleNavigateQuestion = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= questions.length || isLocked) return;
    setCurrentIndex(newIndex);

    try {
      await fetch('/api/exam/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          questionIndex: newIndex,
        }),
      });
    } catch {
      // Non-blocking background persistence
    }
  };

  const currentSaveStatus = currentQuestion ? saveStatuses[currentQuestion.id] || 'IDLE' : 'IDLE';

  // 6. EXAM SUBMITTED VIEW
  if (attemptStatus === 'SUBMITTED') {
    return (
      <div className="relative w-full max-w-3xl mx-auto bg-white rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden my-12 p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 border-4 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="bg-emerald-600 text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider">
            EXAM SUBMITTED
          </span>
          <h2 className="font-display font-black text-3xl md:text-4xl uppercase text-brand-black">
            Examination Complete
          </h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
            Your examination responses have been saved and successfully submitted to the authoritative server.
          </p>
        </div>

        <div className="bg-warm-beige p-6 rounded-xl border-3 border-brand-black text-left space-y-3 font-mono text-sm max-w-lg mx-auto">
          <div className="flex justify-between border-b border-slate-300 pb-2">
            <span className="text-slate-600">Attempt ID:</span>
            <span className="font-bold text-brand-black">{attempt.id}</span>
          </div>
          <div className="flex justify-between border-b border-slate-300 pb-2">
            <span className="text-slate-600">Questions Answered:</span>
            <span className="font-bold text-burnt-orange">
              {Object.keys(answers).length} / {questions.length}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-300 pb-2">
            <span className="text-slate-600">Submitted At:</span>
            <span className="font-bold text-slate-800">
              {submissionResult?.submittedAt
                ? new Date(submissionResult.submittedAt).toLocaleTimeString()
                : new Date().toLocaleTimeString()}
            </span>
          </div>

          {showResultToStudent && submissionResult && (
            <div className="pt-2 border-t-2 border-brand-black space-y-2">
              <div className="flex justify-between font-bold text-base">
                <span>Score Achieved:</span>
                <span className="text-vibrant-pink">
                  {submissionResult.score} / {submissionResult.totalMarks}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Percentage:</span>
                <span className="text-emerald-700">{submissionResult.percentage}%</span>
              </div>
            </div>
          )}
        </div>

        {!showResultToStudent && (
          <p className="text-xs text-slate-500 font-mono italic max-w-md mx-auto">
            Official scores are subject to institutional declaration and paper result visibility policy.
          </p>
        )}

        <div className="pt-4">
          <Link
            href="/student"
            className="inline-flex items-center gap-2 py-3 px-6 bg-brand-black hover:bg-slate-800 text-white rounded-xl font-display font-black text-sm uppercase tracking-wider border-2 border-brand-black shadow-editorial transition-colors"
          >
            <Award className="w-4 h-4 text-burnt-orange" /> Return to Student Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto bg-canvas rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden my-8">
      {/* FULLSCREEN EXIT OVERLAY */}
      {!isFullscreen && (
        <div className="absolute inset-0 z-40 bg-brand-black/90 backdrop-blur-sm flex items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 p-8 rounded-2xl border-4 border-vibrant-pink shadow-editorial max-w-md space-y-6">
            <div className="w-14 h-14 bg-vibrant-pink/20 border-2 border-vibrant-pink rounded-full flex items-center justify-center mx-auto text-vibrant-pink">
              <EyeOff className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="bg-vibrant-pink text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider">
                FULLSCREEN RECOMMENDED
              </span>
              <h3 className="font-display font-black text-2xl uppercase text-warm-beige">
                Exam Content Obscured
              </h3>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              Please return to fullscreen mode to continue your examination cleanly.
            </p>
            <MagneticButton
              variant="primary"
              size="md"
              onClick={handleRequestFullscreen}
              className="w-full flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" /> Return to Fullscreen
            </MagneticButton>
          </div>
        </div>
      )}

      {/* 3. SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="absolute inset-0 z-50 bg-brand-black/90 backdrop-blur-md flex items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 p-8 rounded-2xl border-4 border-emerald-500 shadow-editorial-pink max-w-md space-y-6">
            <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <Send className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="bg-emerald-600 text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider">
                CONFIRM SUBMISSION
              </span>
              <h3 className="font-display font-black text-2xl uppercase text-warm-beige">
                Submit Examination?
              </h3>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              Are you sure you want to submit your exam? You will not be able to change your answers after submission.
            </p>

            <div className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 flex justify-between">
              <span>Total Answered:</span>
              <span className="font-bold text-burnt-orange">
                {Object.keys(answers).length} / {questions.length} Questions
              </span>
            </div>

            {submitError && (
              <div className="bg-red-900/40 border border-red-500 text-red-300 p-3 rounded-xl text-xs font-mono">
                {submitError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-display font-bold text-xs uppercase tracking-wider border border-slate-600"
              >
                CANCEL
              </button>
              <button
                disabled={isSubmitting}
                onClick={executeSubmission}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-display font-black text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> SUBMITTING...
                  </>
                ) : (
                  'SUBMIT'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. INTEGRITY WARNING TOAST */}
      {warningMessage && !isLocked && (
        <div className="bg-burnt-orange text-white px-6 py-3 border-b-2 border-brand-black flex items-center justify-between font-mono text-xs font-bold shadow-editorial z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>{warningMessage}</span>
          </div>
          <button
            onClick={() => setWarningMessage(null)}
            className="p-1 hover:bg-black/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EXAM TOP HEADER */}
      <div className="bg-brand-black text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand-black">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-burnt-orange flex items-center justify-center font-display font-black text-xl border-2 border-white shadow-editorial-pink">
            Q
          </div>
          <div>
            <h2 className="font-display font-black text-lg tracking-wide text-warm-beige uppercase">
              DCA Examination
            </h2>
            <p className="text-xs text-slate-300 font-mono">
              Attempt ID: <span className="text-burnt-orange font-bold">{attempt.id.substring(0, 8)}...</span>
            </p>
          </div>
        </div>

        {/* TIMER & STATUS INDICATOR */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 border-2 border-burnt-orange px-4 py-2 rounded-lg">
            <Clock className="w-4 h-4 text-burnt-orange animate-pulse" />
            <span className="font-mono text-lg font-bold text-warm-beige">
              {formatTime(remainingTime)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-900 border-2 border-slate-700 px-3 py-2 rounded-lg text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-mono">Secure Session</span>
          </div>
        </div>
      </div>

      {/* HUMAN-FRIENDLY SAVE STATUS BAR */}
      <div className="bg-warm-beige px-6 py-2 border-b-2 border-brand-black flex items-center justify-between text-xs font-mono font-bold text-brand-black">
        <div className="flex items-center gap-2">
          <span>STATUS:</span>
          {currentSaveStatus === 'SAVED' && (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved ✓ {lastSavedTime ? `(${lastSavedTime})` : ''}
            </span>
          )}
          {currentSaveStatus === 'SAVING' && (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-400 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
            </span>
          )}
          {currentSaveStatus === 'PENDING_RETRY' && (
            <span className="inline-flex items-center gap-1 text-burnt-orange bg-burnt-orange-light px-2 py-0.5 rounded-full border border-burnt-orange">
              <AlertTriangle className="w-3.5 h-3.5" /> Connection lost — retrying...
            </span>
          )}
          {currentSaveStatus === 'IDLE' && answers[currentQuestion?.id] && (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved ✓
            </span>
          )}
          {currentSaveStatus === 'IDLE' && !answers[currentQuestion?.id] && (
            <span className="text-slate-500">Unanswered</span>
          )}
        </div>

        <div className="text-xs text-slate-600">
          {Object.keys(answers).length} of {questions.length} Answered
        </div>
      </div>

      {/* MAIN EXAM BODY */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-canvas">
        {/* QUESTION CONTENT (LEFT 8 COLS) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          <div>
            {/* QUESTION META */}
            <div className="flex items-center justify-between mb-4 border-b-2 border-brand-black pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-brand-black text-warm-beige px-3 py-1 rounded-md font-display font-black text-sm uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="bg-vibrant-pink-light text-vibrant-pink border border-vibrant-pink px-2.5 py-0.5 rounded-md text-xs font-bold font-mono">
                  {currentQuestion?.marks || 1} Marks
                </span>
              </div>
            </div>

            {/* QUESTION TEXT */}
            <h3 className="text-xl md:text-2xl font-display font-bold text-brand-black leading-relaxed mb-4">
              {currentQuestion?.question_text}
            </h3>

            {/* CODE SNIPPET (IF ANY) */}
            {currentQuestion?.code_snippet && (
              <div className="bg-brand-black text-emerald-400 p-4 rounded-xl border-2 border-brand-black font-mono text-sm overflow-x-auto my-4 shadow-editorial">
                <pre>{currentQuestion.code_snippet}</pre>
              </div>
            )}

            {/* OPTIONS (A, B, C, D) */}
            <div className="space-y-3 mt-6">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const optText =
                  opt === 'A'
                    ? currentQuestion?.option_a
                    : opt === 'B'
                    ? currentQuestion?.option_b
                    : opt === 'C'
                    ? currentQuestion?.option_c
                    : currentQuestion?.option_d;

                const isSelected = answers[currentQuestion?.id] === opt;

                return (
                  <button
                    key={opt}
                    disabled={isLocked}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full text-left p-4 rounded-xl border-3 transition-all flex items-start gap-4 cursor-pointer font-sans text-base font-semibold ${
                      isSelected
                        ? 'bg-burnt-orange text-white border-brand-black shadow-editorial-lg scale-[1.01]'
                        : 'bg-white text-brand-black border-brand-black hover:bg-warm-beige hover:shadow-editorial'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-sm border-2 shrink-0 ${
                        isSelected
                          ? 'bg-white text-burnt-orange border-brand-black'
                          : 'bg-warm-beige text-brand-black border-brand-black'
                      }`}
                    >
                      {opt}
                    </span>
                    <span className="mt-0.5 leading-relaxed">{optText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM CONTROLS */}
          <div className="flex items-center justify-between pt-6 border-t-2 border-brand-black gap-4">
            <MagneticButton
              variant="outline"
              size="md"
              disabled={currentIndex === 0 || isLocked}
              onClick={() => handleNavigateQuestion(currentIndex - 1)}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </MagneticButton>

            {currentIndex === questions.length - 1 ? (
              <MagneticButton
                variant="primary"
                size="md"
                disabled={isLocked}
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                SUBMIT EXAM <Send className="w-4 h-4" />
              </MagneticButton>
            ) : (
              <MagneticButton
                variant="primary"
                size="md"
                disabled={currentIndex === questions.length - 1 || isLocked}
                onClick={() => handleNavigateQuestion(currentIndex + 1)}
                className="flex items-center gap-2"
              >
                Next <ChevronRight className="w-5 h-5" />
              </MagneticButton>
            )}
          </div>
        </div>

        {/* QUESTION SELECTOR MATRIX (RIGHT 4 COLS) */}
        <div className="lg:col-span-4 bg-warm-beige p-5 rounded-xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
          <div>
            <h4 className="font-display font-black text-base text-brand-black uppercase tracking-wider mb-4 border-b-2 border-brand-black pb-2 flex items-center justify-between">
              <span>Question Palette</span>
              <span className="text-xs font-mono font-normal text-slate-600">
                {Object.keys(answers).length} / {questions.length}
              </span>
            </h4>

            {/* GRID OF QUESTIONS 1 TO N */}
            <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    disabled={isLocked}
                    onClick={() => handleNavigateQuestion(idx)}
                    className={`h-10 rounded-lg font-display font-bold text-xs flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-vibrant-pink text-white border-brand-black shadow-editorial scale-105'
                        : isAnswered
                        ? 'bg-burnt-orange text-white border-brand-black'
                        : 'bg-white text-brand-black border-slate-300 hover:border-brand-black'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PALETTE LEGEND */}
          <div className="mt-6 pt-4 border-t-2 border-brand-black space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-burnt-orange border border-brand-black"></span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-vibrant-pink border border-brand-black"></span>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2 font-mono col-span-2">
                <span className="w-3 h-3 rounded bg-white border border-slate-400"></span>
                <span>Unanswered</span>
              </div>
            </div>

            {/* QUICK SUBMIT BUTTON FOR ACCESSIBILITY */}
            <button
              disabled={isLocked}
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 px-3 bg-brand-black hover:bg-slate-800 text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Send className="w-4 h-4 text-burnt-orange" /> Submit Exam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
