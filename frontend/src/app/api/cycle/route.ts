import { NextResponse } from 'next/server';
import { runCycle } from '@/server/cycle';
import { LLM_API_KEY } from '@/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { portfolio, spec } = await req.json();
    if (!portfolio || !spec) return NextResponse.json({ error: 'portfolio and spec are required' }, { status: 400 });
    if (!LLM_API_KEY) return NextResponse.json({ error: 'LLM API key not configured' }, { status: 500 });
    // Returns the full cycle record synchronously (serverless-friendly)
    const cycle = await runCycle(portfolio, spec, LLM_API_KEY);
    return NextResponse.json(cycle);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
