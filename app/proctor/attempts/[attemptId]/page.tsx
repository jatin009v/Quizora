'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProctorAttemptDetailPage({ params }: { params: { attemptId: string } }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAttemptDetails = async () => {
    try {
      const res = await fetch(`/api/proctor/attempts/${params.attemptId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load attempt details.');
      }
    } catch {
      setError('Network error loading attempt details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttemptDetails();
  }, [params.attemptId]);

  const handleLockAttempt = async () => {
    if (!confirm('Are you sure you want to manually lock this student examination attempt?')) return;
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/proctor/attempts/${params.attemptId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Proctor manual lock from detail view' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Attempt successfully locked by Proctor.');
        await fetchAttemptDetails();
      } else {
        setError(json.error || 'Failed to lock attempt.');
      }
    } catch {
      setError('Network error executing lock action.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenAttempt = async () => {
    if (!confirm('Reopening this attempt will allow the student to resume from their exact current question with all answers intact. Proceed?')) return;
    setActionLoading(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/proctor/attempts/${params.attemptId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Proctor manual reopen from detail view' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionSuccess('Attempt successfully reopened. Student can resume exam.');
        await fetchAttemptDetails();
      } else {
        setError(json.error || 'Failed to reopen attempt.');
      }
    } catch {
      setError('Network error executing reopen action.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 font-mono font-bold text-slate-600">
        Loading Student Integrity Timeline...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-burnt-orange mx-auto" />
          <h2 className="font-display font-black text-2xl uppercase">Timeline Error</h2>
          <p className="text-slate-600 text-sm">{error}</p>
          <Link
            href="/proctor"
            className="inline-block py-2.5 px-4 bg-brand-black text-white rounded-lg font-mono text-xs font-bold uppercase shadow-editorial"
          >
            Return to Proctor Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { attempt, student, paper, events } = data;

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-4 md:p-8 noise-bg space-y-8">
      {/* TOP HEADER */}
      <div className="flex items-center gap-4 border-b-4 border-brand-black pb-6">
        <Link
          href="/proctor"
          className="p-2.5 bg-white border-2 border-brand-black rounded-xl shadow-editorial hover:bg-warm-beige transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-brand-black" />
        </Link>
        <div>
          <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
            STUDENT ATTEMPT AUDIT & TIMELINE
          </span>
          <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
            {student?.name} (@{student?.username})
          </h1>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-100 border-2 border-emerald-500 rounded-xl font-mono text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {actionSuccess}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 border-2 border-red-500 rounded-xl font-mono text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" /> {error}
        </div>
      )}

      {/* METRICS & PROCTOR CONTROL BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* STUDENT & ATTEMPT INFO */}
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-4">
          <h3 className="font-display font-black text-xl uppercase border-b-2 border-brand-black pb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-burnt-orange" /> Student Profile
          </h3>
          <div className="space-y-2 font-mono text-xs">
            <div><span className="text-slate-500">Name:</span> <strong className="text-brand-black">{student?.name}</strong></div>
            <div><span className="text-slate-500">Username:</span> <strong className="text-brand-black">{student?.username}</strong></div>
            <div><span className="text-slate-500">Academic Year:</span> <strong className="text-brand-black">{student?.year}</strong></div>
            <div><span className="text-slate-500">Course:</span> <strong className="text-brand-black">{student?.course}</strong></div>
          </div>
        </div>

        {/* PAPER & EXAM METRICS */}
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-4">
          <h3 className="font-display font-black text-xl uppercase border-b-2 border-brand-black pb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-vibrant-pink" /> Quiz Overview
          </h3>
          <div className="space-y-2 font-mono text-xs">
            <div><span className="text-slate-500">Quiz Title:</span> <strong className="text-brand-black">{paper?.title}</strong></div>
            <div><span className="text-slate-500">Current Question:</span> <strong className="text-burnt-orange">Q{attempt?.lastQuestionIndex + 1}</strong></div>
            <div><span className="text-slate-500">Answers Saved:</span> <strong className="text-emerald-700">{attempt?.answeredCount} / {paper?.requiredQuestionCount || 50} Qs</strong></div>
            <div><span className="text-slate-500">Integrity Signals:</span> <strong className="text-vibrant-pink">{attempt?.tabSwitchCount} Events</strong></div>
          </div>
        </div>

        {/* STATUS & ACTIONS */}
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-black text-xl uppercase border-b-2 border-brand-black pb-2 flex items-center justify-between">
              <span>Attempt Status</span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${attempt?.status === 'LOCKED' ? 'bg-burnt-orange text-white' : attempt?.status === 'SUBMITTED' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                {attempt?.status}
              </span>
            </h3>
            <div className="mt-3 font-mono text-xs text-slate-600 space-y-1">
              <div>Started: {attempt?.startedAt ? new Date(attempt.startedAt).toLocaleTimeString() : 'N/A'}</div>
              <div>Expires: {attempt?.expiresAt ? new Date(attempt.expiresAt).toLocaleTimeString() : 'N/A'}</div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-brand-black flex items-center gap-3">
            {attempt?.status === 'LOCKED' ? (
              <button
                onClick={handleReopenAttempt}
                disabled={actionLoading}
                className="w-full py-3 px-4 bg-emerald-600 text-white rounded-xl font-display font-black text-sm uppercase tracking-wider border-2 border-brand-black shadow-editorial hover:bg-emerald-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                {actionLoading ? 'Reopening Exam...' : 'Reopen Exam Attempt'}
              </button>
            ) : attempt?.status === 'IN_PROGRESS' ? (
              <button
                onClick={handleLockAttempt}
                disabled={actionLoading}
                className="w-full py-3 px-4 bg-burnt-orange text-white rounded-xl font-display font-black text-sm uppercase tracking-wider border-2 border-brand-black shadow-editorial hover:bg-burnt-orange-dark flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {actionLoading ? 'Locking Attempt...' : 'Lock Attempt'}
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 italic">No further actions available for submitted attempt.</span>
            )}
          </div>
        </div>
      </div>

      {/* CHRONOLOGICAL INTEGRITY EVENT TIMELINE */}
      <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial-lg space-y-6">
        <h2 className="font-display font-black text-2xl uppercase border-b-4 border-brand-black pb-3 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" /> Chronological Integrity Event Timeline ({events.length} Events)
        </h2>

        <div className="relative border-l-4 border-brand-black ml-4 pl-6 space-y-6">
          {events.length === 0 ? (
            <div className="font-mono text-xs text-slate-500 font-bold py-4">
              No integrity events recorded for this exam attempt.
            </div>
          ) : (
            events.map((ev: any) => {
              const isViolation = ['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT'].includes(ev.eventType);
              const isLock = ev.eventType === 'EXAM_LOCKED';
              const isReopen = ev.eventType === 'EXAM_REOPENED';

              return (
                <div key={ev.id} className="relative">
                  {/* TIMELINE BULLET */}
                  <span
                    className={`absolute -left-[35px] top-1 w-5 h-5 rounded-full border-2 border-brand-black shadow-editorial ${
                      isLock
                        ? 'bg-burnt-orange'
                        : isReopen
                        ? 'bg-emerald-500'
                        : isViolation
                        ? 'bg-amber-500'
                        : 'bg-warm-beige'
                    }`}
                  />

                  <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className={`font-bold px-2 py-0.5 rounded border ${isLock ? 'bg-burnt-orange text-white border-brand-black' : isReopen ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : isViolation ? 'bg-amber-100 text-amber-800 border-amber-400' : 'bg-white text-brand-black border-slate-300'}`}>
                        {ev.eventType}
                      </span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(ev.eventTime).toLocaleTimeString()} ({new Date(ev.eventTime).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="font-mono text-xs text-slate-700">
                      Logged at <strong>Question {ev.questionIndex + 1}</strong>
                    </div>

                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-600">
                        <pre>{JSON.stringify(ev.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
