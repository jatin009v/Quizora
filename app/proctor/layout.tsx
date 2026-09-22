import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProctorLayout({
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

  if (auth.profile.role !== 'PROCTOR' && auth.profile.role !== 'ADMIN') {
    redirect('/student');
  }

  return <>{children}</>;
}
