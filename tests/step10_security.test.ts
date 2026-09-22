import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// Mocks
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createServerClient as createSsrClient } from '@supabase/ssr';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GET as getAdminUsers } from '../app/api/admin/users/route';
import { GET as getProctorDashboard } from '../app/api/proctor/dashboard/route';
import { GET as getAuthMe } from '../app/api/auth/me/route';
import { POST as postLogout } from '../app/api/auth/logout/route';

describe('Quizora Step 10 — Critical Authentication, Authorization & Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockAuth = (user: { id: string } | null, profile: any | null) => {
    const mockSupabaseInstance = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : new Error('No session'),
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: profile,
              error: profile ? null : new Error('Profile not found'),
            }),
          }),
        }),
      }),
    };

    (createSsrClient as any).mockReturnValue(mockSupabaseInstance);
    (createServerClient as any).mockReturnValue(mockSupabaseInstance);
    (createAdminClient as any).mockReturnValue(mockSupabaseInstance);
  };

  describe('1. Edge Middleware Route Access Matrix', () => {
    it('redirects unauthenticated user from /admin to /login', async () => {
      setupMockAuth(null, null);
      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?redirect=%2Fadmin');
    });

    it('redirects STUDENT from /admin to /student', async () => {
      setupMockAuth(
        { id: 'user-student-1' },
        { id: 'p-1', role: 'STUDENT', status: 'ACTIVE', auth_user_id: 'user-student-1' }
      );
      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/student');
    });

    it('redirects PROCTOR from /admin to /proctor', async () => {
      setupMockAuth(
        { id: 'user-proctor-1' },
        { id: 'p-2', role: 'PROCTOR', status: 'ACTIVE', auth_user_id: 'user-proctor-1' }
      );
      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/proctor');
    });

    it('allows ADMIN to access /admin', async () => {
      setupMockAuth(
        { id: 'user-admin-1' },
        { id: 'p-3', role: 'ADMIN', status: 'ACTIVE', auth_user_id: 'user-admin-1' }
      );
      const req = new NextRequest('http://localhost:3000/admin');
      const res = await middleware(req);
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('Cache-Control') || '').toContain('no-store');
    });

    it('redirects STUDENT from /proctor to /student', async () => {
      setupMockAuth(
        { id: 'user-student-1' },
        { id: 'p-1', role: 'STUDENT', status: 'ACTIVE', auth_user_id: 'user-student-1' }
      );
      const req = new NextRequest('http://localhost:3000/proctor');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/student');
    });

    it('allows PROCTOR to access /proctor', async () => {
      setupMockAuth(
        { id: 'user-proctor-1' },
        { id: 'p-2', role: 'PROCTOR', status: 'ACTIVE', auth_user_id: 'user-proctor-1' }
      );
      const req = new NextRequest('http://localhost:3000/proctor');
      const res = await middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows ADMIN to access /proctor', async () => {
      setupMockAuth(
        { id: 'user-admin-1' },
        { id: 'p-3', role: 'ADMIN', status: 'ACTIVE', auth_user_id: 'user-admin-1' }
      );
      const req = new NextRequest('http://localhost:3000/proctor');
      const res = await middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects authenticated user away from /login to their role portal', async () => {
      setupMockAuth(
        { id: 'user-admin-1' },
        { id: 'p-3', role: 'ADMIN', status: 'ACTIVE', auth_user_id: 'user-admin-1' }
      );
      const req = new NextRequest('http://localhost:3000/login');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/admin');
    });

    it('blocks DISABLED user and redirects to /login', async () => {
      setupMockAuth(
        { id: 'user-disabled-1' },
        { id: 'p-4', role: 'STUDENT', status: 'DISABLED', auth_user_id: 'user-disabled-1' }
      );
      const req = new NextRequest('http://localhost:3000/student');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=disabled');
    });
  });

  describe('2. Server API Route Security Enforcement', () => {
    it('returns 403 Forbidden for STUDENT attempting GET /api/admin/users', async () => {
      setupMockAuth(
        { id: 'user-student-1' },
        { id: 'p-1', role: 'STUDENT', status: 'ACTIVE', auth_user_id: 'user-student-1' }
      );
      const req = new NextRequest('http://localhost:3000/api/admin/users');
      const res = await getAdminUsers(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Admin authorization required');
    });

    it('returns 403 Forbidden for STUDENT attempting GET /api/proctor/dashboard', async () => {
      setupMockAuth(
        { id: 'user-student-1' },
        { id: 'p-1', role: 'STUDENT', status: 'ACTIVE', auth_user_id: 'user-student-1' }
      );
      const req = new NextRequest('http://localhost:3000/api/proctor/dashboard');
      const res = await getProctorDashboard(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Proctor access required');
    });
  });

  describe('3. Session Logout & Bfcache Revocation', () => {
    it('executes server logout and returns no-store headers', async () => {
      setupMockAuth(
        { id: 'user-admin-1' },
        { id: 'p-3', role: 'ADMIN', status: 'ACTIVE', auth_user_id: 'user-admin-1' }
      );
      const res = await postLogout();
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control') || '').toContain('no-store');
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('returns 401 on /api/auth/me after session is unauthenticated', async () => {
      setupMockAuth(null, null);
      const res = await getAuthMe();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.authenticated).toBe(false);
    });
  });
});
