import { NextResponse } from 'next/server';
import { attemptOverspend } from '@/server/proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { riskRedelegation, rootDelegation } = await req.json();
    const result = await attemptOverspend(riskRedelegation, rootDelegation);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
