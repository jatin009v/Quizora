import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { deleteAllParticipants } from '@/lib/auth/userService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE PARTICIPANTS') {
      return NextResponse.json(
        { success: false, error: 'Invalid confirmation phrase. Please type "DELETE PARTICIPANTS".' },
        { status: 400 }
      );
    }

    const result = await deleteAllParticipants(auth.profile.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        deletedCount: result.deletedCount,
        failedCount: result.failedCount,
        message: `Successfully deleted ${result.deletedCount} participant(s).`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
