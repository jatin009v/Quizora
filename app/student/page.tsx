'use client';

import React, { useState, useEffect } from 'react';
import { Paper } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { BookOpen, Award, LogOut, Clock, Key, ShieldCheck, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [publishedPapers, setPublishedPapers] = useState<Paper[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'results'>('available');
  const [loading, setLoading] = useState(true);

  // Access Code Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    setStudentInfo({
      name: 'Rahul Kumar',
      course: 'DCA Computer Science',
      rollNumber: '2026-DCA-001',
      username: 'student001',
    });

    fetch('/api/student/exams/published')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPublishedPapers(data.papers || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleVerifyAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError(null);

    if (!accessCodeInput.trim()) {
      setAccessError('Please enter an exam access code.');
      return;
    }

    setValidatingCode(true);

    try {
      const res = await fetch('/api/student/exams/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: accessCodeInput.trim() }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setShowAccessModal(false);
        // Navigate to Pre-Exam Instructions page
        router.push(`/student/exam/start/${json.data.paperId}`);
      } else {
        setAccessError(json.error || 'Invalid or unavailable exam code.');
      }
    } catch {
      setAccessError('Network error validating code.');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12 noise-bg">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* TOP NAVBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-4 border-brand-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-burnt-orange rounded-xl border-3 border-brand-black shadow-editorial flex items-center justify-center font-display font-black text-2xl text-white">
              Q
            </div>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight text-brand-black uppercase">
                STUDENT PORTAL
              </h1>
              <p className="text-xs font-mono text-slate-500">
                Quizora DCA Examination Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MagneticButton variant="primary" size="sm" onClick={() => setShowAccessModal(true)}>
              <Key className="w-4 h-4 mr-1.5" /> Enter Access Code
            </MagneticButton>

            <button
              onClick={handleLogout}
              className="py-2 px-4 bg-white border-2 border-brand-black rounded-lg font-mono text-xs font-bold uppercase shadow-editorial hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* STUDENT PROFILE CARD */}
        <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial-lg flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-warm-beige border-3 border-brand-black shadow-editorial flex items-center justify-center font-display font-black text-2xl text-burnt-orange">
              {studentInfo?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="font-display font-black text-2xl text-brand-black uppercase">
                {studentInfo?.name || 'Student Name'}
              </h2>
              <p className="text-xs font-mono text-slate-600">
                Course: <strong className="text-brand-black">{studentInfo?.course}</strong> | Roll Number:{' '}
                <strong className="text-brand-black">{studentInfo?.rollNumber}</strong> | Username:{' '}
                <strong className="text-burnt-orange">{studentInfo?.username}</strong>
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-500 px-4 py-2 rounded-xl text-xs font-mono font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Identity Authenticated
          </div>
        </div>

        {/* TABS HEADER */}
        <div className="flex items-center gap-4 border-b-3 border-brand-black pb-2">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-2 px-4 rounded-lg font-display font-bold text-sm uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === 'available'
                ? 'bg-burnt-orange text-white border-brand-black shadow-editorial'
                : 'bg-white text-brand-black border-transparent hover:border-brand-black'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" /> Available Exams ({publishedPapers.length})
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`py-2 px-4 rounded-lg font-display font-bold text-sm uppercase tracking-wider border-2 transition-all cursor-pointer ${
              activeTab === 'results'
                ? 'bg-vibrant-pink text-white border-brand-black shadow-editorial'
                : 'bg-white text-brand-black border-transparent hover:border-brand-black'
            }`}
          >
            <Award className="w-4 h-4 inline mr-2" /> My Results
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'available' ? (
          publishedPapers.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border-4 border-brand-black shadow-editorial text-center space-y-4">
              <Clock className="w-16 h-16 mx-auto text-burnt-orange" />
              <h3 className="font-display font-black text-2xl uppercase">No Scheduled Exams Available</h3>
              <p className="text-slate-600 max-w-md mx-auto text-sm font-medium">
                There are currently no published examination papers scheduled for your course. Please wait for the administrator to issue an access code.
              </p>
              <button
                onClick={() => setShowAccessModal(true)}
                className="py-2.5 px-4 bg-burnt-orange text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial hover:bg-burnt-orange-hover cursor-pointer"
              >
                Enter Exam Access Code Manually
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {publishedPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="bg-emerald-400 text-brand-black border border-brand-black px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase">
                        Active Exam
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {paper.duration_minutes} Minutes
                      </span>
                    </div>

                    <h3 className="font-display font-black text-xl text-brand-black leading-tight">
                      {paper.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {paper.description || 'Official course examination paper.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-warm-beige p-3 rounded-lg border-2 border-brand-black mt-4">
                      <div>
                        <span className="text-slate-500 block">Questions:</span>
                        <span className="font-bold text-brand-black">{paper.required_question_count} Qs</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Total Marks:</span>
                        <span className="font-bold text-burnt-orange">{paper.total_marks} Marks</span>
                      </div>
                    </div>
                  </div>

                  <Link href={`/student/exam/start/${paper.id}`}>
                    <button className="w-full py-2.5 px-4 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial cursor-pointer flex items-center justify-center gap-2">
                      <Key className="w-4 h-4" /> Start / Continue Exam
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial space-y-4">
            <h3 className="font-display font-black text-xl uppercase border-b-2 border-brand-black pb-2">
              Past Exam Scorecards
            </h3>

            <div className="bg-warm-beige p-4 rounded-xl border-2 border-brand-black flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="bg-burnt-orange text-white px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                  DCA Computer Science
                </span>
                <h4 className="font-display font-black text-lg text-brand-black mt-1">
                  DCA Computer Fundamentals Examination
                </h4>
                <p className="text-xs font-mono text-slate-600">Attempt ID: a1b2c3d4-e5f6</p>
              </div>

              <Link href="/student/results/a1b2c3d4-e5f6-7890-abcd-1234567890ab">
                <button className="py-2 px-4 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-lg font-display font-bold text-xs uppercase tracking-wider border-2 border-brand-black shadow-editorial cursor-pointer">
                  View Full Scorecard
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ENTER ACCESS CODE MODAL */}
        {showAccessModal && (
          <div className="fixed inset-0 bg-brand-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-3xl border-4 border-brand-black shadow-editorial-lg p-6 space-y-6 relative">
              <button
                onClick={() => setShowAccessModal(false)}
                className="absolute right-4 top-4 p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b-2 border-brand-black pb-3">
                <Key className="w-6 h-6 text-burnt-orange" />
                <h3 className="font-display font-black text-2xl uppercase">Enter Exam Access Code</h3>
              </div>

              <form onSubmit={handleVerifyAccessCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1.5 text-brand-black">
                    Exam Access Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DCA-7K4P9X"
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl border-2 border-brand-black font-mono font-black text-lg text-burnt-orange tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-burnt-orange"
                  />
                </div>

                {accessError && (
                  <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {accessError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAccessModal(false)}
                    className="flex-1 py-3 px-4 bg-warm-beige hover:bg-warm-beige-dark text-brand-black rounded-xl font-display font-bold text-xs uppercase border-2 border-brand-black shadow-editorial cursor-pointer"
                  >
                    Cancel
                  </button>

                  <MagneticButton
                    variant="primary"
                    size="md"
                    type="submit"
                    disabled={validatingCode}
                    className="flex-1"
                  >
                    {validatingCode ? 'Validating...' : 'Verify Code'}
                  </MagneticButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
