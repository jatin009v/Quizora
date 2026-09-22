-- Quizora DCA Quiz Platform Database Architecture (Step 8 Migration)
-- Student Profile Cleanup: Add Academic Year and Remove Obsolete Roll Number

-- 1. ADD YEAR COLUMN TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS year VARCHAR(50) NOT NULL DEFAULT '1st Year';

-- 2. DROP OBSOLETE ROLL_NUMBER COLUMN FROM PROFILES
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS roll_number;
