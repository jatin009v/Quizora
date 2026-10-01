'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { ExamInterface } from '@/components/exam/ExamInterface';
import { LogIn, PlayCircle, Shield } from 'lucide-react';
import { ClientQuestion, ExamAttempt } from '@/types/database';
import Link from 'next/link';

// Sample 50-Question DCA Demo Dataset for immediate testing
const generateSampleQuestions = (): ClientQuestion[] => {
  const topics = [
    { text: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) principle?', opts: ['Queue', 'Stack', 'Linked List', 'Binary Tree'], snippet: 'class Stack {\n  constructor() { this.items = []; }\n  push(item) { this.items.push(item); }\n}' },
    { text: 'What is the worst-case time complexity of QuickSort algorithm?', opts: ['O(n log n)', 'O(n)', 'O(n²)', 'O(1)'], snippet: null },
    { text: 'In SQL, which constraint is used to ensure all values in a column are unique and uniquely identify a row?', opts: ['FOREIGN KEY', 'PRIMARY KEY', 'CHECK', 'DEFAULT'], snippet: null },
    { text: 'Which HTTP status code corresponds to "Unauthorized Access"?', opts: ['400 Bad Request', '401 Unauthorized', '403 Forbidden', '404 Not Found'], snippet: null },
    { text: 'What does CSS specificity rule dictate when two conflicting styles apply to the same element?', opts: ['Inline > ID > Class > Element', 'Element > Class > ID > Inline', 'Order in file only', 'Alphabetical order'], snippet: null },
  ];

  const questions: ClientQuestion[] = [];
  for (let i = 1; i <= 50; i++) {
    const base = topics[(i - 1) % topics.length];
    questions.push({
      id: `q-${i}`,
      question_text: `[DCA Q${i}] ${base.text}`,
      question_type: 'MCQ_SINGLE',
      option_a: base.opts[0],
      option_b: base.opts[1],
      option_c: base.opts[2],
      option_d: base.opts[3],
      marks: (i % 5) + 1,
      code_snippet: base.snippet || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return questions;
};

const demoQuestions = generateSampleQuestions();

const demoAttempt: ExamAttempt = {
  id: 'demo-attempt-001',
  user_id: 'usr-demo-student',
  paper_id: 'paper-demo-2026',
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
  const heroRef = useRef<HTMLDivElement>(null);
  const examSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-badge', { y: -20, opacity: 0, duration: 0.7, ease: 'back.out(1.7)' });
      gsap.from('.hero-title', { y: 30, opacity: 0, duration: 0.8, delay: 0.15, ease: 'power3.out' });
      gsap.from('.hero-sub', { y: 20, opacity: 0, duration: 0.7, delay: 0.3, ease: 'power2.out' });
      gsap.from('.hero-cta', { scale: 0.95, opacity: 0, duration: 0.5, delay: 0.45, ease: 'power2.out' });
    });

    return () => ctx.revert();
  }, []);

  const scrollToExam = () => {
    examSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-canvas text-brand-black flex flex-col justify-between">
      {/* NAVBAR */}
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
            <Link href="/login">
              <MagneticButton variant="primary" size="sm" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" /> LOGIN
              </MagneticButton>
            </Link>

            <MagneticButton variant="outline" size="sm" onClick={scrollToExam} className="hidden sm:inline-flex">
              LIVE DEMO EXAM
            </MagneticButton>
          </div>
        </div>
      </nav>

      {/* LOGIN-FIRST HERO SECTION */}
      <section ref={heroRef} className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center relative flex-1 flex flex-col items-center justify-center">
        <div className="hero-badge inline-flex items-center gap-2 bg-burnt-orange/10 border-2 border-burnt-orange px-4 py-1.5 rounded-full text-xs font-mono font-bold text-burnt-orange uppercase mb-6 shadow-editorial">
          <Shield className="w-4 h-4 text-burnt-orange" /> Quizora DCA • Online Examination Platform
        </div>

        <h1 className="hero-title font-display font-black text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight uppercase text-brand-black leading-none mb-6">
          QUIZORA <span className="text-burnt-orange underline decoration-brand-black decoration-wavy">DCA</span>
        </h1>

        <p className="hero-sub max-w-2xl mx-auto text-lg md:text-xl text-slate-700 font-sans font-medium mb-10 leading-relaxed">
          Secure and seamless online examinations for students.
        </p>

        <div className="hero-cta flex flex-wrap items-center justify-center gap-4">
          <Link href="/login">
            <MagneticButton variant="primary" size="lg" className="px-8 py-4 text-lg font-black tracking-wide flex items-center gap-3">
              <LogIn className="w-6 h-6" /> LOGIN TO EXAMINATION
            </MagneticButton>
          </Link>

          <MagneticButton
            variant="outline"
            size="lg"
            onClick={scrollToExam}
            className="px-6 py-4 text-base font-bold flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5 text-burnt-orange" /> LIVE DEMO EXAM
          </MagneticButton>
        </div>
      </section>

      {/* LIVE ENVIRONMENT SECTION */}
      <section ref={examSectionRef} id="demo-exam" className="bg-warm-beige py-16 border-t-4 border-b-4 border-brand-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 space-y-2">
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              Live Interactive Demo
            </span>
            <h2 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black">
              Student Exam Interface Demo
            </h2>
            <p className="text-slate-700 max-w-xl mx-auto text-sm font-medium">
              Explore the real-time student environment, interactive question palette, timer countdown, and answer saving flow.
            </p>
          </div>

          <ExamInterface attempt={demoAttempt} questions={demoQuestions} />
        </div>
      </section>

      {/* MINIMAL PUBLIC FOOTER */}
      <footer className="bg-brand-black text-white py-8 border-t-4 border-brand-black text-center font-mono text-xs text-slate-300 space-y-1">
        <p>© 2026 Quizora DCA</p>
        <p className="text-slate-400">Developed by Jatin Gupta</p>
      </footer>
    </main>
  );
}
