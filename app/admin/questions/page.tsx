'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QuestionBankPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/papers');
  }, [router]);

  return (
    <div className="min-h-screen bg-canvas text-brand-black p-12 flex items-center justify-center">
      <div className="text-center font-mono font-bold text-slate-500">
        Redirecting to Paper Builder...
      </div>
    </div>
  );
}

