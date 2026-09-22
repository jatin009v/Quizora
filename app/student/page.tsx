'use client';

import React, { useState, useEffect } from 'react';
import { Paper } from '@/types/database';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { BookOpen, Award, LogOut, Clock, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<{ name: string; course: string; year?: string } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [publishedPapers, setPublishedPapers] = useState<Paper[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'results'>('available');
  const [loading, setLoading] = useState(true);

  // Access Code Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch authenticated student profile
    fetch('/api/student/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile) {
          setStudentInfo({
            name: data.profile.name,
            course: data.profile.course,
            year: data.profile.year,
          });
        } else {
          setProfileError(data.error || 'Unable to load your profile. Please sign in again or contact the administrator.');
        }
      })
      .catch(() => {
        setProfileError('Unable to load your profile. Please sign in again or contact the administrator.');
      });

    // 2. Fetch available published exam papers
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

        {/* PROFILE ERROR OR PROFILE CARD */}
        {profileError ? (
          <div className="bg-red-50 p-6 rounded-2xl border-4 border-red-500 shadow-editorial text-red-700 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <p className="font-bold text-sm">{profileError}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-red-700"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial-lg flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-warm-beige border-3 border-brand-black shadow-editorial flex items-center justify-center font-display font-black text-2xl text-burnt-orange uppercase">
                {studentInfo?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <h2 className="font-display font-black text-3xl text-brand-black uppercase">
                  {studentInfo?.name || 'Loading Student...'}
                </h2>
                <p className="text-sm font-bold text-slate-600 uppercase mt-0.5">
                  Course: <span className="text-burnt-orange">{studentInfo?.course || '—'}</span>
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border-2 border-emerald-500 px-4 py-2 rounded-xl text-xs font-mono font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Authenticated Identity
            </div>
          </div>
        )}

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
                  className="bg-white p-6 rounded-2xl border-4 border-brand-black shadow-editorial flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <span className="bg-vibrant-pink text-white px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider border border-brand-black">
                      PUBLISHED EXAM
                    </span>
                    <h3 className="font-display font-black text-xl uppercase text-brand-black">{paper.title}</h3>
                    <p className="text-xs text-slate-600 font-medium">{paper.description}</p>
                  </div>

                  <div className="pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                    <div className="text-xs font-mono font-bold text-slate-500">
                      Duration: {paper.duration_minutes} Mins | Marks: {paper.total_marks}
                    </div>
                    <MagneticButton variant="primary" size="sm" onClick={() => setShowAccessModal(true)}>
                      Start Exam
                    </MagneticButton>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial text-center">
            <p className="font-mono text-sm font-bold text-slate-600">Select an exam paper above to view detailed score breakdown.</p>
          </div>
        )}

        {/* ACCESS CODE MODAL */}
        {showAccessModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-4 border-brand-black rounded-3xl shadow-editorial max-w-md w-full p-6 space-y-6 relative">
              <button
                onClick={() => setShowAccessModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 border-2 border-brand-black rounded-lg hover:bg-slate-200"
              >
                ✕
              </button>

              <div>
                <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
                  SECURITY VERIFICATION
                </span>
                <h2 className="font-display font-black text-2xl uppercase text-brand-black mt-2">
                  Enter Examination Access Code
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  Ask your invigilator or administrator for the official access code.
                </p>
              </div>

              {accessError && (
                <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-red-700 text-xs font-bold">
                  {accessError}
                </div>
              )}

              <form onSubmit={handleVerifyAccessCode} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="e.g. DCA2026"
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                  className="w-full p-4 bg-slate-50 border-3 border-brand-black rounded-xl font-mono text-center font-bold text-2xl tracking-widest text-burnt-orange focus:outline-none focus:ring-2 focus:ring-burnt-orange uppercase"
                />

                <MagneticButton variant="primary" size="lg" className="w-full justify-center">
                  {validatingCode ? 'Verifying Code...' : 'Verify Access Code & Begin'}
                </MagneticButton>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
