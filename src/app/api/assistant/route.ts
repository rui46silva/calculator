import { NextResponse } from 'next/server';
import { emptyData } from '@/data/types';
import { buildContext, ASSISTANT_SYSTEM } from '@/lib/server/aiContext';
import { AiError, aiConfigured, chatText, type ChatMessage } from '@/lib/server/openai';
import { dataKeyFor, loadData, sessionUser } from '@/lib/server/userData';
import { monthReport } from '@/lib/report';

export const maxDuration = 60;

const MAX_TURNS = 12;
const MAX_CHARS = 2000;

/** Whether the assistant is available (no secrets exposed). */
export async function GET() {
  if (!(await sessionUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ configured: aiConfigured() });
}

interface Body {
  messages?: { role: string; content: string }[];
  /** "report": comment on a month's review instead of chatting. */
  mode?: 'chat' | 'report';
  month?: string;
}

/** Answers questions about the user's own data, read on the server (the client can't inject other data). */
export async function POST(req: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  const data = { ...emptyData(), ...((await loadData(await dataKeyFor(user.id))) ?? {}) };
  const context = buildContext(data);

  const messages: ChatMessage[] = [{ role: 'system', content: `${ASSISTANT_SYSTEM}\n\nNome do utilizador: ${user.name || 'utilizador'}\n\n# Dados do utilizador\n${context}` }];
  if (body.mode === 'report') {
    const month = /^\d{4}-\d{2}$/.test(body.month ?? '') ? body.month! : new Date().toISOString().slice(0, 7);
    const report = monthReport(data, month);
    messages.push({
      role: 'user',
      content: `Escreve um comentário ao mês ${month} em 4 a 6 frases: o que correu bem, o que merece atenção e 2 sugestões concretas para o próximo mês. Resumo calculado pela app: ${JSON.stringify(report)}`,
    });
  } else {
    const turns = (body.messages ?? [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_CHARS) }));
    if (!turns.length || turns[turns.length - 1].role !== 'user') return NextResponse.json({ error: 'Pergunta vazia.' }, { status: 400 });
    messages.push(...turns);
  }

  try {
    return NextResponse.json({ answer: await chatText(messages) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: err instanceof AiError ? err.status : 500 });
  }
}
