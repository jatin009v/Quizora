import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { CreatePaperSchema } from '@/lib/validation/paper';
import { createOrUpdatePaperDraft, listPapersForAdmin, isUuid } from '@/lib/exam/paperService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const result = await listPapersForAdmin();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (body.id && !isUuid(body.id)) {
      delete body.id;
    }

    const validation = CreatePaperSchema.safeParse(body);

    if (!validation.success) {
      const issue = validation.error.issues[0]?.message || 'Invalid paper input';
      return NextResponse.json({ success: false, error: issue }, { status: 400 });
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Pass authenticated admin profile ID
    const result = await createOrUpdatePaperDraft(auth.profile.id, validation.data);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, paperId: result.paperId, data: result.data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
