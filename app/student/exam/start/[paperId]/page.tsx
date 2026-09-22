'use client';

import React, { useState, useEffect } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Clock, HelpCircle, Award, ShieldCheck, ArrowLeft, Play, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PreExamStartPage({ params }: { params: { paperId: string } }) {
  const router = useRouter();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In dev / unseeded execution, generate fallback paper info
    setPaper({
      id: params.paperId,
      title: 'DCA Computer Fundamentals Examination',
      description: 'Official online examination covering Data Structures, Web Development, Operating Systems, and SQL Database design.',
      course: 'DCA Computer Science',
      durationMinutes: 60,
      totalMarks: 50,
      requiredQuestionCount: 50,
      startAt: null,
      endAt: null,
    });
    setLoading(false);
  }, [params.paperId]);

  const handleStartExam = async () => {
    setStarting(true);
    setError(null);

    // Request browser fullscreen before starting exam
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setError('Fullscreen mode is required to take this examination. Please allow fullscreen in your browser to proceed.');
      setStarting(false);
      return;
    }

    try {
      const res = await fetch('/api/student/exams/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: params.paperId }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Navigate to secure exam runner
        router.push(`/student/exam/${json.data.attemptId}`);
      } else {
        setError(json.error || 'Failed to initialize exam attempt.');
      }
    } catch {
      setError('Network error initializing exam.');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 font-mono font-bold text-slate-600">
        Loading examination instructions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12 noise-bg">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex items-center gap-4 border-b-4 border-brand-black pb-6">
          <Link
            href="/student"
            className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div>
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              PRE-EXAM INSTRUCTIONS
            </span>
            <h1 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-1">
              {paper?.title}
            </h1>
          </div>
        </div>

        {/* METRICS & INSTRUCTIONS CARD */}
        <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial-lg space-y-6">
          <p className="text-slate-700 font-sans font-medium leading-relaxed">
            {paper?.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black">
              <span className="text-slate-500 block">Course:</span>
              <span className="font-bold text-brand-black">{paper?.course}</span>
            </div>
            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black">
              <span className="text-slate-500 block">Questions:</span>
              <span className="font-bold text-brand-black">{paper?.requiredQuestionCount} Qs</span>
            </div>
            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black">
              <span className="text-slate-500 block">Total Marks:</span>
              <span className="font-bold text-burnt-orange">{paper?.totalMarks} Marks</span>
            </div>
            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black">
              <span className="text-slate-500 block">Duration:</span>
              <span className="font-bold text-vibrant-pink">{paper?.durationMinutes} Mins</span>
            </div>
          </div>

          {/* RULES LIST */}
          <div className="bg-warm-beige/50 p-6 rounded-xl border-3 border-brand-black space-y-3">
            <h3 className="font-display font-black text-lg uppercase text-brand-black flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Examination Rules & Policies
            </h3>
            <ul className="space-y-2 text-xs font-sans text-slate-700 list-disc list-inside font-medium">
              <li>Read each question carefully before selecting an answer.</li>
              <li>Answers are saved <strong>immediately per option click</strong> to the server (`Saved ✓`).</li>
              <li>Do not close or reload the browser unnecessarily during an active attempt. If disconnected, your saved state will be recovered automatically.</li>
              <li>Timer countdown starts immediately upon clicking &quot;Start Exam Now&quot;. The server clock is authoritative for timing and expiry.</li>
            </ul>
          </div>

          {error && (
            <div className="p-4 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end">
            <MagneticButton
              variant="primary"
              size="lg"
              onClick={handleStartExam}
              disabled={starting}
              className="w-full md:w-auto flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              {starting ? 'Initializing Exam Attempt...' : 'Start Exam Now'}
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
}
