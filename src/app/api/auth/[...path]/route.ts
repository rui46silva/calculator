import { NextResponse } from 'next/server';
import { authConfigProblems, getAuth } from '@/lib/server/auth';

type Context = { params: Promise<{ path: string[] }> };

const notConfigured = () =>
  NextResponse.json(
    {
      code: 'AUTH_NOT_CONFIGURED',
      message: `A autenticação não está configurada: ${authConfigProblems().join('; ')}. Define as variáveis no Vercel e faz Redeploy.`,
    },
    { status: 503 },
  );

export const GET = (req: Request, ctx: Context) => getAuth()?.handler().GET(req, ctx) ?? notConfigured();
export const POST = (req: Request, ctx: Context) => getAuth()?.handler().POST(req, ctx) ?? notConfigured();
