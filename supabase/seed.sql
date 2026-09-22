-- Quizora DCA Quiz Platform — Production Seed Script
-- Run this script in the Supabase SQL Editor after applying all 5 migrations.

-- 1. Create Default Admin and Proctor Profiles
INSERT INTO public.profiles (id, name, course, year, username, role, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'System Administrator', 'DCA Administration', '1st Year', 'admin', 'ADMIN', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000002', 'Chief Exam Proctor', 'DCA Examination Unit', '1st Year', 'proctor', 'PROCTOR', 'ACTIVE')
ON CONFLICT (username) DO NOTHING;

-- 2. Insert Sample Question Bank (DCA Computer Fundamentals & Networking)
INSERT INTO public.questions (id, question_text, question_type, difficulty, option_a, option_b, option_c, option_d, correct_option, explanation, marks)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'What does CPU stand for in Computer Science?',
    'MCQ_SINGLE',
    'EASY',
    'Central Processing Unit',
    'Computer Performance Utility',
    'Central Power Unit',
    'Control Program Unit',
    'A',
    'CPU stands for Central Processing Unit, the primary component that executes instructions.',
    2
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Which memory type is volatile and loses contents when power is turned off?',
    'MCQ_SINGLE',
    'EASY',
    'ROM',
    'RAM',
    'EEPROM',
    'Hard Disk',
    'B',
    'RAM (Random Access Memory) is main memory and is volatile.',
    2
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'What is the standard port number for HTTPS secure web traffic?',
    'MCQ_SINGLE',
    'MEDIUM',
    '80',
    '21',
    '443',
    '8080',
    'C',
    'HTTPS traffic operates over TLS/SSL on port 443.',
    2
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Which OSI layer is responsible for IP routing and packet delivery across networks?',
    'MCQ_SINGLE',
    'MEDIUM',
    'Data Link Layer',
    'Network Layer',
    'Transport Layer',
    'Session Layer',
    'B',
    'The Network Layer (Layer 3) handles IP addressing and logical routing.',
    2
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'What is the binary representation of the decimal number 255?',
    'MCQ_SINGLE',
    'HARD',
    '11111110',
    '10000000',
    '11111111',
    '11100000',
    'C',
    '255 in binary is 8 ones: 11111111.',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Sample Published Exam Paper
INSERT INTO public.papers (id, title, description, course, duration_minutes, total_marks, status, access_code, start_at, end_at, published_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'DCA Computer Science Certification Exam 2026',
  'Official DCA Comprehensive Computer Science & Networking Examination.',
  'DCA Computer Science',
  60,
  10,
  'PUBLISHED',
  'DCA2026',
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '30 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Map Questions to Paper
INSERT INTO public.paper_questions (paper_id, question_id, question_order, marks)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 2),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 2, 2),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 3, 2),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 4, 2),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 5, 2)
ON CONFLICT (paper_id, question_id) DO NOTHING;
