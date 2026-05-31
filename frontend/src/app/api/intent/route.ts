import { NextResponse } from 'next/server';
import { parseIntent } from '@/server/intent';
import { LLM_API_KEY } from '@/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { intent } = await req.json();
    if (!intent) return NextResponse.json({ error: 'intent is required' }, { status: 400 });
    if (!LLM_API_KEY) return NextResponse.json({ error: 'LLM API key not configured' }, { status: 500 });
    const spec = await parseIntent(intent, LLM_API_KEY);
    return NextResponse.json({ spec });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
