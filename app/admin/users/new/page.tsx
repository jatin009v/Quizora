'use client';

import React, { useState } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { ArrowLeft, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewUserPage() {
  const [name, setName] = useState('');
  const [course, setCourse] = useState('DCA Computer Science');
  const [year, setYear] = useState('1st Year');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessData(null);

    setSaving(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          course: course.trim(),
          year,
          username: username.trim(),
          password,
          role: 'STUDENT',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessData(data.data);
        setName('');
        setUsername('');
        setPassword('');
      } else {
        setErrorMessage(data.error || 'Failed to create student account.');
      }
    } catch {
      setErrorMessage('Network error while creating student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b-4 border-brand-black pb-6">
          <Link
            href="/admin/users"
            className="p-2.5 bg-white border-2 border-brand-black rounded-lg shadow-editorial hover:bg-warm-beige transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-brand-black" />
          </Link>
          <div>
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              MANUAL CREATION
            </span>
            <h1 className="font-display font-black text-3xl md:text-4xl uppercase text-brand-black mt-1">
              Create Single Student Account
            </h1>
          </div>
        </div>

        {/* SUCCESS CONFIRMATION BOX */}
        {successData && (
          <div className="bg-emerald-50 border-3 border-emerald-500 p-6 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-display font-black text-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Student Account Created Successfully!
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-emerald-400 font-mono text-xs space-y-1 text-slate-700">
              <p>Name: <strong className="text-brand-black">{successData.name}</strong></p>
              <p>Assigned Username: <strong className="text-burnt-orange">{successData.username}</strong></p>
              <p className="text-slate-500 pt-1 text-[11px]">
                Note: Passwords are password-hashed directly inside Supabase Auth and never shown again.
              </p>
            </div>
          </div>
        )}

        {/* FORM CARD */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border-4 border-brand-black shadow-editorial-lg space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Student Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Riya Pandey"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Target Course *</label>
              <input
                type="text"
                placeholder="e.g. MCA or DCA Computer Science"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                required
                className="w-full p-3 rounded-lg border-2 border-brand-black font-sans font-semibold focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Academic Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-burnt-orange uppercase"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="Final Year">Final Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase mb-1">Assigned Username *</label>
              <input
                type="text"
                placeholder="e.g. riyapandey"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full p-3 rounded-lg border-2 border-brand-black font-mono font-bold text-burnt-orange focus:outline-none focus:ring-2 focus:ring-burnt-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1">Temporary Initial Password *</label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 rounded-lg border-2 border-brand-black font-sans focus:outline-none focus:ring-2 focus:ring-burnt-orange"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 rounded-lg text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          <div className="pt-2">
            <MagneticButton
              variant="primary"
              size="lg"
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" /> {saving ? 'Creating Account...' : 'Create Student Account'}
            </MagneticButton>
          </div>
        </form>
      </div>
    </div>
  );
}
