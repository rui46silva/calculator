import { NextResponse } from 'next/server';
import { sessionUser } from '@/lib/server/userData';
import { AiError } from '@/lib/server/openai';
import { fileKind, readStatement } from '@/lib/server/statement';

export const maxDuration = 60;

const MAX_FILE_BYTES = 4_000_000;

/** Reads an uploaded bank statement and returns the movements for the user to review (nothing is saved here). */
export async function POST(req: Request) {
  if (!(await sessionUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Ficheiro demasiado grande (máximo 4 MB). Divide o extrato por meses.' }, { status: 413 });
  const kind = fileKind(file.name, file.type);
  if (!kind) return NextResponse.json({ error: 'Formato não suportado. Usa PDF, CSV ou Excel (.xlsx).' }, { status: 415 });

  try {
    const result = await readStatement(file.name, kind, await file.arrayBuffer());
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = err instanceof AiError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message || 'Erro ao ler o extrato.' }, { status });
  }
}
