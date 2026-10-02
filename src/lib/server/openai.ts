/**
 * Minimal OpenAI Chat Completions client (fetch only, no SDK). The key never leaves the server.
 * OPENAI_BASE_URL allows any OpenAI-compatible endpoint (and a local mock in tests).
 */
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const TIMEOUT_MS = 55_000;

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

async function complete(messages: ChatMessage[], extra: Record<string, unknown> = {}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiError('A IA não está configurada: define OPENAI_API_KEY no Vercel.', 503);
  const base = (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL, messages, ...extra }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AiError(`Não foi possível contactar a OpenAI: ${(err as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | null; refusal?: string | null } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new AiError(`OpenAI respondeu ${res.status}: ${body.error?.message ?? 'erro desconhecido'}`, res.status === 429 ? 429 : 502);
  const msg = body.choices?.[0]?.message;
  if (msg?.refusal) throw new AiError(`A IA recusou o pedido: ${msg.refusal}`);
  if (!msg?.content) throw new AiError('A IA não devolveu resposta.');
  return msg.content;
}

export function chatText(messages: ChatMessage[]): Promise<string> {
  return complete(messages, { temperature: 0.3 });
}

/** Structured output: the model must return JSON matching `schema`. */
export async function chatJson<T>(messages: ChatMessage[], name: string, schema: Record<string, unknown>): Promise<T> {
  const content = await complete(messages, {
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
  });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiError('A IA devolveu um formato inválido. Tenta novamente.');
  }
}
