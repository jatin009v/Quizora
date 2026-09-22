import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { ProctorEventInputSchema } from '@/lib/validation/proctor';
import { logProctorEvent } from '@/lib/proctor/proctorService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = ProctorEventInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid event payload', details: validation.error.format() },
        { status: 400 }
      );
    }

    const result = await logProctorEvent(validation.data, auth.profile.id);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err: any) {
    const message = err.message || 'Failed to log proctor event';
    const status = message.includes('Unauthorized') ? 403 : message.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
