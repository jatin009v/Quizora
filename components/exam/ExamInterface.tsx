'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Zap,
  Lock,
  Maximize2,
  X,
  EyeOff,
} from 'lucide-react';
import { MagneticButton } from '../ui/MagneticButton';

interface ExamInterfaceProps {
  attempt: ExamAttempt;
  questions: ClientQuestion[];
  initialAnswers?: Record<string, string>;
  initialQuestionIndex?: number;
}

export function ExamInterface({
  attempt: initialAttempt,
  questions,
  initialAnswers = {},
  initialQuestionIndex = 0,
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
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);

  const [remainingTime, setRemainingTime] = useState(() => {
    if (initialAttempt.expires_at) {
      return Math.max(0, Math.floor((new Date(initialAttempt.expires_at).getTime() - Date.now()) / 1000));
    }
    return 3600;
  });

  const currentQuestion = questions[currentIndex] || questions[0];
  const isLocked = attemptStatus === 'LOCKED';

  // Helper to send proctor events to server safely
  const sendProctorEvent = useCallback(
    async (eventType: ProctorEventType, metadata: Record<string, any> = {}) => {
      if (attemptStatus === 'SUBMITTED') return;

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

  // 2. Timer Countdown
  useEffect(() => {
    if (isLocked || attemptStatus === 'SUBMITTED') return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, attemptStatus]);

  // 3. Status Polling for Proctor Lock/Reopen Synchronization
  useEffect(() => {
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
  }, [attempt.id]);

  // 4. Browser Integrity Listeners (Fullscreen, Visibility, Focus/Blur)
  useEffect(() => {
    if (isLocked || attemptStatus === 'SUBMITTED') return;

    // Check initial fullscreen status
    setIsFullscreen(!!document.fullscreenElement);

    const handleFullscreenChange = () => {
      const inFS = !!document.fullscreenElement;
      setIsFullscreen(inFS);
      if (!inFS) {
        sendProctorEvent('FULLSCREEN_EXIT');
      } else {
        sendProctorEvent('FULLSCREEN_ENTER');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendProctorEvent('TAB_SWITCH');
      }
    };

    const handleBlur = () => {
      sendProctorEvent('WINDOW_BLUR');
    };

    const handleFocus = () => {
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

    // 2. Dispatch to Persistence Queue Engine
    if (isSimulatingOffline) {
      setSaveStatuses((prev) => ({
        ...prev,
        [currentQuestion.id]: 'PENDING_RETRY',
      }));
    } else {
      answerQueueEngine.enqueueAnswer(attempt.id, currentQuestion.id, option);
    }
  };

  const handleNavigateQuestion = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= questions.length || isLocked) return;
    setCurrentIndex(newIndex);

    // Persist current question index to server asynchronously
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

  return (
    <div className="relative w-full max-w-6xl mx-auto bg-canvas rounded-2xl border-4 border-brand-black shadow-editorial-lg overflow-hidden my-8">
      {/* 1. EXAM LOCKED OVERLAY */}
      {isLocked && (
        <div className="absolute inset-0 z-50 bg-brand-black/95 backdrop-blur-md flex items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 p-8 md:p-12 rounded-2xl border-4 border-burnt-orange shadow-editorial-pink max-w-lg space-y-6">
            <div className="w-16 h-16 bg-burnt-orange/20 border-2 border-burnt-orange rounded-full flex items-center justify-center mx-auto text-burnt-orange">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider">
                EXAM LOCKED
              </span>
              <h2 className="font-display font-black text-2xl md:text-4xl uppercase text-warm-beige">
                Attempt Temporarily Locked
              </h2>
            </div>
            <p className="text-slate-300 font-sans text-sm leading-relaxed">
              Your examination has been temporarily locked because multiple exam-integrity events were detected.
              Please contact the exam proctor to review and reopen your attempt.
            </p>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-xs font-mono text-slate-400 space-y-1">
              <div>Attempt ID: <span className="text-burnt-orange font-bold">{attempt.id}</span></div>
              <div>Events Recorded: <span className="text-vibrant-pink font-bold">{tabSwitchCount} Events</span></div>
              <div>Saved Answers Status: <span className="text-emerald-400 font-bold">Safely Preserved ✓</span></div>
            </div>
            <p className="text-xs text-slate-400 font-mono italic animate-pulse">
              Syncing with Proctor Dashboard... When reopened, your exam will resume automatically.
            </p>
          </div>
        </div>
      )}

      {/* 2. FULLSCREEN EXIT OVERLAY (OBSCURES EXAM CONTENT) */}
      {!isFullscreen && !isLocked && (
        <div className="absolute inset-0 z-40 bg-brand-black/90 backdrop-blur-sm flex items-center justify-center p-6 text-center text-white">
          <div className="bg-slate-900 p-8 rounded-2xl border-4 border-vibrant-pink shadow-editorial max-w-md space-y-6">
            <div className="w-14 h-14 bg-vibrant-pink/20 border-2 border-vibrant-pink rounded-full flex items-center justify-center mx-auto text-vibrant-pink">
              <EyeOff className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="bg-vibrant-pink text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider">
                FULLSCREEN REQUIRED
              </span>
              <h3 className="font-display font-black text-2xl uppercase text-warm-beige">
                Exam Content Obscured
              </h3>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              Please return to fullscreen mode to continue your examination. Content is obscured until fullscreen mode is restored.
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

      {/* 3. INTEGRITY WARNING TOAST / BANNER */}
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
              DCA Examination Runner
            </h2>
            <p className="text-xs text-slate-300">
              Attempt ID: <span className="font-mono text-burnt-orange font-bold">{attempt.id.substring(0, 8)}...</span> | Integrity Signals: <span className="text-vibrant-pink font-bold">{tabSwitchCount} Events</span>
            </p>
          </div>
        </div>

        {/* TIMER & SYNC STATUS */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 border-2 border-burnt-orange px-4 py-2 rounded-lg">
            <Clock className="w-4 h-4 text-burnt-orange animate-pulse" />
            <span className="font-mono text-lg font-bold text-warm-beige">
              {formatTime(remainingTime)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-900 border-2 border-slate-700 px-3 py-2 rounded-lg text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Authoritative Clock</span>
          </div>
        </div>
      </div>

      {/* PERSISTENCE & INTEGRITY BAR */}
      <div className="bg-warm-beige px-6 py-2 border-b-2 border-brand-black flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-bold text-brand-black">
        <div className="flex items-center gap-2">
          <span>SYNC STATUS:</span>
          {currentSaveStatus === 'SAVED' && (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved ✓ {lastSavedTime ? `(${lastSavedTime})` : ''}
            </span>
          )}
          {currentSaveStatus === 'SAVING' && (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-400 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving to Supabase...
            </span>
          )}
          {currentSaveStatus === 'PENDING_RETRY' && (
            <span className="inline-flex items-center gap-1 text-burnt-orange bg-burnt-orange-light px-2 py-0.5 rounded-full border border-burnt-orange">
              <AlertTriangle className="w-3.5 h-3.5" /> Network issue, pending retry...
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

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-brand-black select-none">
            <input
              type="checkbox"
              checked={isSimulatingOffline}
              onChange={(e) => setIsSimulatingOffline(e.target.checked)}
              className="accent-burnt-orange w-4 h-4 cursor-pointer"
            />
            <span>Simulate Network Glitch</span>
          </label>
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
                <span className="bg-warm-beige text-brand-black border border-brand-black px-2.5 py-0.5 rounded-md text-xs font-bold font-mono uppercase">
                  {currentQuestion?.difficulty || 'MEDIUM'}
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

            <span className="text-xs font-mono text-slate-500 font-bold hidden sm:inline">
              Immediate Save Active • No &quot;Submit&quot; required for answers
            </span>

            <MagneticButton
              variant="primary"
              size="md"
              disabled={currentIndex === questions.length - 1 || isLocked}
              onClick={() => handleNavigateQuestion(currentIndex + 1)}
              className="flex items-center gap-2"
            >
              Next <ChevronRight className="w-5 h-5" />
            </MagneticButton>
          </div>
        </div>

        {/* QUESTION SELECTOR MATRIX (RIGHT 4 COLS) */}
        <div className="lg:col-span-4 bg-warm-beige p-5 rounded-xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
          <div>
            <h4 className="font-display font-black text-base text-brand-black uppercase tracking-wider mb-4 border-b-2 border-brand-black pb-2 flex items-center justify-between">
              <span>Question Palette</span>
              <span className="text-xs font-mono font-normal text-slate-600">
                {Object.keys(answers).length} / {questions.length} Answered
              </span>
            </h4>

            {/* GRID OF QUESTIONS 1 TO 50 */}
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

          {/* LEGEND & RECOVERY */}
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
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-white border border-slate-400"></span>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500 border border-brand-black"></span>
                <span>Saved ✓</span>
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-3 bg-deep-blue text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial hover:bg-deep-blue-dark flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-vibrant-pink" /> Test Refresh Recovery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
