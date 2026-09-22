'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { ExamInterface } from '@/components/exam/ExamInterface';
import {
  ShieldCheck,
  Database,
  Lock,
  Zap,
  Layers,
  Cpu,
  CheckCircle2,
  Terminal,
  Activity,
  Award,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { ClientQuestion, ExamAttempt } from '@/types/database';

// Sample 50-Question DCA Demo Dataset for immediate testing
const generateSampleQuestions = (): ClientQuestion[] => {
  const topics = [
    { text: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) principle?', opts: ['Queue', 'Stack', 'Linked List', 'Binary Tree'], snippet: 'class Stack {\n  constructor() { this.items = []; }\n  push(item) { this.items.push(item); }\n}' },
    { text: 'What is the worst-case time complexity of QuickSort algorithm?', opts: ['O(n log n)', 'O(n)', 'O(n²)', 'O(1)'], snippet: null },
    { text: 'In SQL, which constraint is used to ensure all values in a column are unique and uniquely identify a row?', opts: ['FOREIGN KEY', 'PRIMARY KEY', 'CHECK', 'DEFAULT'], snippet: 'CREATE TABLE answers (\n  CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)\n);' },
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
      difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY',
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
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const examSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Hero entrance timeline
      gsap.from('.hero-badge', { y: -30, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' });
      gsap.from('.hero-title', { y: 40, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out' });
      gsap.from('.hero-sub', { y: 20, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power2.out' });
      gsap.from('.hero-cta', { scale: 0.9, opacity: 0, duration: 0.6, delay: 0.6, ease: 'power2.out' });

      // Cards staggered animation
      gsap.from('.arch-card', {
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
      });
    });

    return () => ctx.revert();
  }, []);

  const scrollToExam = () => {
    examSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen">
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
              <span className="hidden md:inline-block ml-3 px-2 py-0.5 bg-vibrant-pink text-white rounded font-mono text-xs font-bold uppercase">
                Step 1 Complete
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#architecture"
              className="font-display font-bold text-sm text-brand-black hover:text-burnt-orange uppercase tracking-wider hidden sm:block"
            >
              DB Architecture
            </a>
            <MagneticButton variant="primary" size="sm" onClick={scrollToExam}>
              Live Demo Exam
            </MagneticButton>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section ref={heroRef} className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center relative">
        <div className="hero-badge inline-flex items-center gap-2 bg-vibrant-pink-light border-2 border-vibrant-pink px-4 py-1.5 rounded-full text-xs font-mono font-bold text-vibrant-pink uppercase mb-6 shadow-editorial-pink">
          <Sparkles className="w-4 h-4 animate-spin" /> High-Concurrency Exam Architecture Engine
        </div>

        <h1 className="hero-title font-display font-black text-5xl md:text-7xl lg:text-8xl tracking-tight uppercase text-brand-black leading-none mb-6">
          PREMIUM <span className="text-burnt-orange underline decoration-brand-black decoration-wavy">EXAMINATION</span> PLATFORM
        </h1>

        <p className="hero-sub max-w-3xl mx-auto text-lg md:text-xl text-slate-700 font-sans font-medium mb-10 leading-relaxed">
          Engineered for 200+ concurrent students with immediate Supabase PostgreSQL answer persistence, optimistic concurrency control, and zero student exposure to grading data.
        </p>

        <div className="hero-cta flex flex-wrap items-center justify-center gap-4">
          <MagneticButton variant="primary" size="lg" onClick={scrollToExam}>
            <Zap className="w-5 h-5 mr-2" /> Launch Interactive Exam
          </MagneticButton>

          <MagneticButton
            variant="outline"
            size="lg"
            onClick={() => {
              window.open('/api/exam/attempt/a1b2c3d4-e5f6-7890-abcd-1234567890ab', '_blank');
            }}
          >
            <Terminal className="w-5 h-5 mr-2 text-deep-blue" /> View API JSON Endpoint
          </MagneticButton>
        </div>

        {/* METRICS STRIP */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Concurrency Target</p>
            <p className="font-display font-black text-3xl text-burnt-orange mt-1">200+ Students</p>
            <p className="text-xs text-slate-600 mt-1">Simultaneous exam takers</p>
          </div>
          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Answer Constraint</p>
            <p className="font-display font-black text-3xl text-vibrant-pink mt-1">1 Row / Q</p>
            <p className="text-xs text-slate-600 mt-1">UNIQUE(attempt_id, question_id)</p>
          </div>
          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Save Latency</p>
            <p className="font-display font-black text-3xl text-deep-blue mt-1">Immediate</p>
            <p className="text-xs text-slate-600 mt-1">Per-option click persistence</p>
          </div>
          <div className="bg-white p-5 rounded-xl border-3 border-brand-black shadow-editorial">
            <p className="font-mono text-xs font-bold text-slate-500 uppercase">Security Policy</p>
            <p className="font-display font-black text-3xl text-emerald-600 mt-1">Zero Leaks</p>
            <p className="text-xs text-slate-600 mt-1">`correct_option` stripped at DB/API</p>
          </div>
        </div>
      </section>

      {/* LIVE DEMO EXAM SECTION */}
      <section ref={examSectionRef} className="bg-warm-beige py-16 border-t-4 border-b-4 border-brand-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="bg-burnt-orange text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
              Interactive Test Environment
            </span>
            <h2 className="font-display font-black text-3xl md:text-5xl uppercase text-brand-black mt-3">
              Live MCQ Exam Persistence Engine
            </h2>
            <p className="text-slate-700 max-w-2xl mx-auto mt-2 font-medium">
              Click options to test immediate answer persistence (`Saved ✓`), test out-of-order changes (A → B → C), or simulate network glitches to verify retry queuing.
            </p>
          </div>

          <ExamInterface attempt={demoAttempt} questions={demoQuestions} />
        </div>
      </section>

      {/* DATABASE & SECURITY ARCHITECTURE SECTION */}
      <section id="architecture" ref={cardRef} className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="bg-vibrant-pink text-white px-3 py-1 rounded font-mono text-xs font-bold uppercase tracking-wider border-2 border-brand-black shadow-editorial">
            Database Architecture & Security
          </span>
          <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-brand-black mt-3">
            Supabase PostgreSQL Foundation
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CARD 1: 8 SCHEMA TABLES */}
          <div className="arch-card bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-burnt-orange text-white flex items-center justify-center mb-4 border-2 border-brand-black shadow-editorial">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-brand-black uppercase">8 Core Tables</h3>
              <p className="text-sm text-slate-600 mt-2">
                `profiles`, `questions`, `papers`, `paper_questions`, `exam_attempts`, `answers`, `proctor_events`, `admin_audit_logs`.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-slate-200 text-xs font-mono text-burnt-orange font-bold">
              ✓ Fully Migrated
            </div>
          </div>

          {/* CARD 2: RLS POLICIES */}
          <div className="arch-card bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-vibrant-pink text-white flex items-center justify-center mb-4 border-2 border-brand-black shadow-editorial">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-brand-black uppercase">Strict RLS Isolation</h3>
              <p className="text-sm text-slate-600 mt-2">
                Students can strictly access only their own attempts and answers. No `USING (true)` wildcards.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-slate-200 text-xs font-mono text-vibrant-pink font-bold">
              ✓ Policy Verified
            </div>
          </div>

          {/* CARD 3: CONCURRENCY LOCK */}
          <div className="arch-card bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-deep-blue text-white flex items-center justify-center mb-4 border-2 border-brand-black shadow-editorial">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-brand-black uppercase">1 Answer / Question</h3>
              <p className="text-sm text-slate-600 mt-2">
                Database-level `UNIQUE(attempt_id, question_id)` constraint ensures idempotent upsert without duplicates.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-slate-200 text-xs font-mono text-deep-blue font-bold">
              ✓ Constraint Enforced
            </div>
          </div>

          {/* CARD 4: RECOVERY ENGINE */}
          <div className="arch-card bg-white p-6 rounded-2xl border-3 border-brand-black shadow-editorial flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-4 border-2 border-brand-black shadow-editorial">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-xl text-brand-black uppercase">State Recovery</h3>
              <p className="text-sm text-slate-600 mt-2">
                Restores `last_question_index`, saved answers, and remaining time on refresh without resetting exam.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t-2 border-slate-200 text-xs font-mono text-emerald-700 font-bold">
              ✓ Recovery Tested
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-brand-black text-white border-t-4 border-brand-black py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-display font-black text-2xl uppercase tracking-wider text-warm-beige">
              QUIZORA <span className="text-burnt-orange">DCA</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Production-Grade MCQ Examination Architecture • Step 1 Complete
            </p>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Next.js App Router • Supabase PostgreSQL • TypeScript Strict
          </div>
        </div>
      </footer>
    </main>
  );
}
