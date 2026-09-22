'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useBfcacheProtection() {
  const router = useRouter();

  useEffect(() => {
    async function revalidateSession() {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) {
          window.location.href = '/login';
        }
      } catch (err) {
        // Network failure during revalidation
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        revalidateSession();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateSession();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  return { handleLogout };
}
