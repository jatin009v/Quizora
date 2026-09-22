import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quizora DCA — High-Concurrency Online MCQ Examination Platform',
  description:
    'Production-grade online examination engine with immediate answer persistence, Supabase PostgreSQL, optimistic concurrency control, and zero student correct-option leaks.',
  keywords: ['Quizora', 'DCA Exam', 'MCQ Platform', 'Supabase', 'Next.js', 'Online Exam'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-canvas text-brand-black antialiased noise-bg">
        {children}
      </body>
    </html>
  );
}
