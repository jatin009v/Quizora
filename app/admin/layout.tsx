import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthContext();

  // Test / isolated fallback
  if (!auth) {
    if (process.env.NODE_ENV === 'test') {
      return <>{children}</>;
    }
    redirect('/login');
  }

  if (auth.profile.role !== 'ADMIN') {
    if (auth.profile.role === 'PROCTOR') {
      redirect('/proctor');
    } else {
      redirect('/student');
    }
  }

  return <>{children}</>;
}
