'use client';

import React, { useState, useEffect } from 'react';
import { ExamInterface } from '@/components/exam/ExamInterface';
import { ClientQuestion, ExamAttempt } from '@/types/database';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudentExamRunnerPage({ params }: { params: { attemptId: string } }) {
  const [attemptState, setAttemptState] = useState<{
    attempt: ExamAttempt;
    questions: ClientQuestion[];
    savedAnswers: Record<string, string>;
    lastQuestionIndex: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/exam/attempt/${params.attemptId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setAttemptState(json.data);
        } else {
          setError(json.error || 'Failed to load exam attempt.');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 font-mono font-bold text-slate-600">
        Securing exam runner environment...
      </div>
    );
  }

  if (error || !attemptState) {
    return (
      <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-burnt-orange mx-auto" />
          <h2 className="font-display font-black text-2xl uppercase">Exam Access Error</h2>
          <p className="text-slate-600 text-sm">{error || 'Unauthorized or expired attempt access.'}</p>
          <Link
            href="/student"
            className="inline-block py-2.5 px-4 bg-brand-black text-white rounded-lg font-mono text-xs font-bold uppercase shadow-editorial"
          >
            Return to Student Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-4 md:p-8 noise-bg">
      <ExamInterface
        attempt={attemptState.attempt}
        questions={attemptState.questions}
        initialAnswers={attemptState.savedAnswers}
        initialQuestionIndex={attemptState.lastQuestionIndex}
      />
    </div>
  );
}
