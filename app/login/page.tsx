'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { Lock, User, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect based on profile role
        if (data.role === 'ADMIN') {
          router.push('/admin/papers');
        } else if (data.role === 'PROCTOR') {
          router.push('/proctor');
        } else {
          router.push('/student');
        }
      } else {
        // Generic failure message to prevent username enumeration
        setErrorMessage(data.error || 'Invalid username or password.');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-brand-black flex items-center justify-center p-6 noise-bg">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border-4 border-brand-black shadow-editorial-lg space-y-6 relative overflow-hidden">
        {/* CORNER BADGE */}
        <div className="flex items-center justify-between border-b-3 border-brand-black pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-burnt-orange rounded-xl border-3 border-brand-black shadow-editorial flex items-center justify-center font-display font-black text-2xl text-white">
              Q
            </div>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight text-brand-black uppercase">
                QUIZORA <span className="text-burnt-orange">DCA</span>
              </h1>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                Examination Portal Login
              </p>
            </div>
          </div>

          <span className="bg-warm-beige text-brand-black px-2.5 py-1 rounded font-mono text-[10px] font-bold border-2 border-brand-black uppercase">
            Step 3 Auth
          </span>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1.5 text-brand-black">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Enter assigned username (e.g. jatin001)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-brand-black font-sans font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-burnt-orange bg-canvas/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase mb-1.5 text-brand-black">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-brand-black font-sans font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-burnt-orange bg-canvas/50"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-xs font-mono font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          <MagneticButton
            variant="primary"
            size="lg"
            type="submit"
            disabled={loading}
            className="w-full mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </MagneticButton>
        </form>

        {/* FOOTER & DEMO HELPER */}
        <div className="pt-4 border-t-2 border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-500 font-sans">
            Credentials are provided by your institution administrator.
          </p>
          <div className="bg-warm-beige p-3 rounded-xl border-2 border-brand-black text-[11px] font-mono text-left space-y-1">
            <span className="font-bold text-brand-black block">Quick Test Logins:</span>
            <div className="text-slate-700 flex justify-between">
              <span>Admin: <strong className="text-burnt-orange">admin</strong></span>
              <span>Student: <strong className="text-vibrant-pink">riyapandey</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
