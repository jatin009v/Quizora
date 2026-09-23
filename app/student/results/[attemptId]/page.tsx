'use client';

import React, { useState, useEffect } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Award, Clock, CheckCircle2, FileText, ArrowLeft, Trophy, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function StudentResultPage({ params }: { params: { attemptId: string } }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/student/results/${params.attemptId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setResult(json.data);
        } else {
          setError(json.error || 'Failed to load examination result');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 font-mono text-slate-600 font-bold">
        Retrieving examination scorecard...
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial text-center max-w-md">
          <FileText className="w-12 h-12 text-burnt-orange mx-auto mb-4" />
          <h2 className="font-display font-black text-2xl uppercase">Result Unavailable</h2>
          <p className="text-slate-600 text-sm mt-2 mb-6">{error || 'Could not find requested exam attempt.'}</p>
          <Link href="/">
            <MagneticButton variant="primary" size="md">
              Return to Home
            </MagneticButton>
          </Link>
        </div>
      </div>
    );
  }

  const formatCompletionTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4 border-b-4 border-brand-black pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-brand-black" />
            </Link>
            <div>
              <span className="bg-vibrant-pink text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                EXAMINATION SCORECARD
              </span>
              <h1 className="font-display font-black text-3xl md:text-4xl uppercase text-brand-black mt-1">
                {result.paperTitle}
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-warm-beige border-2 border-brand-black px-3 py-1.5 rounded-lg text-xs font-mono font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Server Authoritative
          </div>
        </div>

        {/* HERO SCORE CARD OR SUBMISSION CONFIRMATION */}
        {result.resultHidden ? (
          <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial-lg text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-600 text-white font-display font-black text-4xl border-3 border-brand-black shadow-editorial mx-auto">
              ✓
            </div>

            <div>
              <h2 className="font-display font-black text-3xl uppercase text-brand-black">
                Exam Submitted Successfully
              </h2>
              <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto font-sans">
                {result.message || 'Score & detailed results for this examination will be published by your administrator.'}
              </p>
            </div>

            <div className="pt-4 border-t-2 border-slate-200">
              <Link href="/student">
                <MagneticButton variant="primary" size="md">
                  Return to Student Portal
                </MagneticButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial-lg text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-burnt-orange text-white font-display font-black text-4xl border-3 border-brand-black shadow-editorial-pink mx-auto">
              Q
            </div>

            <div>
              <h2 className="font-display font-black text-3xl uppercase text-brand-black">
                {result.studentName}
              </h2>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Course: <span className="font-bold text-brand-black">{result.course}</span>
              </p>
            </div>

            {/* SCORE NUMBERS */}
            <div className="bg-warm-beige p-6 rounded-xl border-3 border-brand-black grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-center">
              <div>
                <p className="font-mono text-xs font-bold text-slate-500 uppercase">Final Score</p>
                <p className="font-display font-black text-4xl text-burnt-orange mt-1">
                  {result.score} <span className="text-sm font-sans text-slate-600">/ {result.totalMarks}</span>
                </p>
              </div>

              <div>
                <p className="font-mono text-xs font-bold text-slate-500 uppercase">Percentage</p>
                <p className="font-display font-black text-4xl text-vibrant-pink mt-1">
                  {result.percentage}%
                </p>
              </div>

              <div>
                <p className="font-mono text-xs font-bold text-slate-500 uppercase">Questions Attempted</p>
                <p className="font-display font-black text-4xl text-deep-blue mt-1">
                  {result.attemptedQuestions} <span className="text-sm font-sans text-slate-600">/ {result.totalQuestions}</span>
                </p>
              </div>
            </div>

            {/* TIME TIMESTAMPS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left text-xs font-mono">
              <div className="bg-white p-4 rounded-lg border-2 border-brand-black flex items-center justify-between">
                <span className="text-slate-500">Completion Duration:</span>
                <span className="font-bold text-brand-black">{formatCompletionTime(result.completionTimeSeconds)}</span>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-brand-black flex items-center justify-between">
                <span className="text-slate-500">Submission Timestamp:</span>
                <span className="font-bold text-brand-black">
                  {result.submittedAt ? new Date(result.submittedAt).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
