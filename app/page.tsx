'use client';

import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { ExamInterface } from '@/components/exam/ExamInterface';
import {
  LogIn,
  Play,
  ShieldCheck,
  Zap,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { ClientQuestion, ExamAttempt } from '@/types/database';

// Sample DCA Demo Dataset for live preview
const generateSampleQuestions = (): ClientQuestion[] => {
  const topics = [
    {
      text: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) principle?',
      opts: ['Queue', 'Stack', 'Linked List', 'Binary Tree'],
    },
    {
      text: 'What is the worst-case time complexity of QuickSort algorithm?',
      opts: ['O(n log n)', 'O(n)', 'O(n²)', 'O(1)'],
    },
    {
      text: 'In relational databases, which key uniquely identifies each record in a table?',
      opts: ['Foreign Key', 'Primary Key', 'Candidate Key', 'Composite Key'],
    },
    {
      text: 'Which HTTP status code corresponds to "Unauthorized Access"?',
      opts: ['400 Bad Request', '401 Unauthorized', '403 Forbidden', '404 Not Found'],
    },
    {
      text: 'What does CSS specificity rule dictate when two conflicting styles apply to an element?',
      opts: ['Inline > ID > Class > Element', 'Element > Class > ID > Inline', 'Order in file only', 'Alphabetical order'],
    },
  ];

  const questions: ClientQuestion[] = [];
  for (let i = 1; i <= 50; i++) {
    const base = topics[(i - 1) % topics.length];
    questions.push({
      id: `q-${i}`,
      question_text: `[DCA Q${i}] ${base.text}`,
      question_type: 'MCQ_SINGLE',
      difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY',
      option_a: base.opts[0],
      option_b: base.opts[1],
      option_c: base.opts[2],
      option_d: base.opts[3],
      marks: (i % 5) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return questions;
};

const demoQuestions = generateSampleQuestions();

const demoAttempt: ExamAttempt = {
  id: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
  user_id: 'usr-student-001',
  paper_id: 'paper-dca-2026',
  status: 'IN_PROGRESS',
  started_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  submitted_at: null,
  locked_at: null,
  score: null,
  total_marks: 50,
  tab_switch_count: 0,
  fullscreen_exit_count: 0,
  last_question_index: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function Home() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const examSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-badge', { y: -20, opacity: 0, duration: 0.7, ease: 'power2.out' });
      gsap.from('.hero-title', { y: 30, opacity: 0, duration: 0.8, delay: 0.15, ease: 'power3.out' });
      gsap.from('.hero-sub', { y: 20, opacity: 0, duration: 0.7, delay: 0.3, ease: 'power2.out' });
      gsap.from('.hero-cta', { scale: 0.95, opacity: 0, duration: 0.5, delay: 0.45, ease: 'power2.out' });
    });

    return () => ctx.revert();
  }, []);

  const scrollToExam = () => {
    examSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavigateLogin = () => {
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-canvas text-brand-black flex flex-col justify-between">
      {/* STICKY HEADER */}
      <nav className="w-full bg-warm-beige border-b-4 border-brand-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-burnt-orange rounded-xl border-3 border-brand-black shadow-editorial flex items-center justify-center font-display font-black text-2xl text-white">
              Q
            </div>
            <div>
              <span className="font-display font-black text-2xl tracking-tighter uppercase text-brand-black">
                QUIZORA <span className="text-burnt-orange">DCA</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MagneticButton variant="outline" size="sm" onClick={scrollToExam}>
              <Play className="w-4 h-4 mr-1.5 inline text-burnt-orange" />
              Live Demo Exam
            </MagneticButton>
            <MagneticButton variant="primary" size="sm" onClick={handleNavigateLogin}>
              <LogIn className="w-4 h-4 mr-1.5 inline" />
              Login
            </MagneticButton>
          </div>
        </div>
      </nav>

      {/* HERO SECTION (LOGIN FIRST) */}
      <section ref={heroRef} className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center relative flex-1">
        <div className="hero-badge inline-flex items-center gap-2 bg-burnt-orange/10 border-2 border-burnt-orange px-4 py-1.5 rounded-full text-xs font-mono font-bold text-burnt-orange uppercase mb-6 shadow-editorial">
          <BookOpen className="w-4 h-4" /> Online Examination Platform
        </div>

        <h1 className="hero-title font-display font-black text-5xl md:text-7xl lg:text-8xl tracking-tight uppercase text-brand-black leading-none mb-6">
          QUIZORA <span className="text-burnt-orange underline decoration-brand-black decoration-wavy">DCA</span>
        </h1>

        <p className="hero-sub max-w-2xl mx-auto text-lg md:text-2xl text-slate-700 font-sans font-medium mb-10 leading-relaxed">
          &ldquo;Secure and seamless online examinations for students.&rdquo;
        </p>

        <div className="hero-cta flex flex-wrap items-center justify-center gap-4">
          <MagneticButton variant="primary" size="lg" onClick={handleNavigateLogin}>
            <LogIn className="w-5 h-5 mr-2" /> Login to Exam Portal
          </MagneticButton>

          <MagneticButton variant="outline" size="lg" onClick={scrollToExam}>
            <Play className="w-5 h-5 mr-2 text-burnt-orange" /> Live Demo Exam
          </MagneticButton>
        </div>

        {/* STUDENT FEATURES STRIP */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
          <div className="bg-white p-6 rounded-xl border-3 border-brand-black shadow-editorial flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-burnt-orange/10 border-2 border-burnt-orange text-burnt-orange flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg uppercase text-brand-black">Secure Testing</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Clean, distraction-free environment for fair and transparent evaluations.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border-3 border-brand-black shadow-editorial flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-vibrant-pink/10 border-2 border-vibrant-pink text-vibrant-pink flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg uppercase text-brand-black">Instant Results</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Immediate authoritative scoring and detailed score breakdowns upon submission.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border-3 border-brand-black shadow-editorial flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border-2 border-emerald-600 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg uppercase text-brand-black">Seamless Progress</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Automatic response persistence ensures your progress is safely stored.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO EXAM SECTION */}
      <section ref={examSectionRef} className="bg-warm-beige py-16 border-t-4 border-b-4 border-brand-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 space-y-3">
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              Interactive Practice
            </span>
            <h2 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black">
              Live Demo Examination
            </h2>
            <p className="text-slate-700 max-w-xl mx-auto text-sm md:text-base font-medium">
              Experience the student examination interface firsthand in this interactive demo session.
            </p>
          </div>

          <ExamInterface attempt={demoAttempt} questions={demoQuestions} />
        </div>
      </section>

      {/* SIMPLE MINIMAL FOOTER */}
      <footer className="bg-brand-black text-white py-8 border-t-4 border-brand-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-burnt-orange rounded-lg border-2 border-white flex items-center justify-center font-display font-black text-lg text-white">
              Q
            </div>
            <span className="font-display font-black text-xl tracking-wider text-warm-beige uppercase">
              QUIZORA <span className="text-burnt-orange">DCA</span>
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400 space-y-1">
            <p>&copy; 2026 Quizora DCA</p>
            <p className="text-slate-500">Developed by Jatin Gupta</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
