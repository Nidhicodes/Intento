import { NextResponse } from 'next/server';
import { ensureSetup } from '@/server/proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userSmartAccount } = await req.json();
    const info = await ensureSetup(userSmartAccount);
    return NextResponse.json(info);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
