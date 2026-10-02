import ExcelJS from 'exceljs';
import { TRANSACTION_CATEGORIES } from '@/data/types';
import { parseStatementCsv } from '@/lib/import/csv';
import type { ImportResult, ImportRow } from '@/lib/import/types';
import { AiError, aiConfigured, chatJson } from './openai';
import { AI_ENABLED } from '../features';

const MAX_TEXT_CHARS = 150_000;
const KINDS = ['one-off', 'fixed', 'subscription', 'transfer'] as const;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows', 'warnings'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'description', 'amount', 'type', 'category', 'kind'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          description: { type: 'string', description: 'Comerciante ou descrição curta e legível' },
          amount: { type: 'number', description: 'Valor absoluto, sempre positivo' },
          type: { type: 'string', enum: ['expense', 'income'] },
          category: { type: 'string', enum: [...TRANSACTION_CATEGORIES] },
          kind: { type: 'string', enum: [...KINDS] },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

const SYSTEM = `És um assistente que lê extratos bancários portugueses e extrai TODOS os movimentos.
Regras:
- Uma linha por movimento; ignora saldos, totais, cabeçalhos e linhas informativas.
- date no formato YYYY-MM-DD (a data do movimento, não a data-valor se forem diferentes).
- amount sempre positivo; type "expense" para débitos/saídas e "income" para créditos/entradas.
- description: nome do comerciante ou descrição curta e legível (ex.: "COMPRA 1234 PINGO DOCE LISBOA" → "Pingo Doce").
- category: uma de ${TRANSACTION_CATEGORIES.join(', ')} (usa "Outros" se não souberes).
- kind: "transfer" para transferências entre contas próprias, levantamentos, MB WAY entre pessoas e salário recebido;
  "subscription" para serviços cobrados periodicamente (streaming, ginásio, software, telemóvel);
  "fixed" para contas fixas (renda, luz, água, gás, seguros, prestações); "one-off" para o resto.
- Em warnings, indica em português problemas como páginas ilegíveis ou valores ambíguos. Lista vazia se não houver.`;

/** Converts the first sheets of an .xlsx file into ';'-separated text. */
async function xlsxToText(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const lines: string[] = [];
  wb.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1).map((v) => {
        if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, '0')}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${v.getUTCFullYear()}`;
        if (v && typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result ?? '');
        if (v && typeof v === 'object' && 'text' in v) return String((v as { text: unknown }).text ?? '');
        return v === null || v === undefined ? '' : String(v).replace(/;/g, ',');
      });
      lines.push(values.join(';'));
    });
  });
  return lines.join('\n');
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps only well-formed rows from the model's answer. */
function clean(rows: ImportRow[]): ImportRow[] {
  return rows
    .filter((r) => ISO.test(r.date) && Number.isFinite(r.amount) && r.amount > 0 && r.description?.trim())
    .map((r) => ({
      ...r,
      amount: Math.round(r.amount * 100) / 100,
      description: r.description.trim().slice(0, 120),
      category: (TRANSACTION_CATEGORIES as readonly string[]).includes(r.category) ? r.category : 'Outros',
      kind: (KINDS as readonly string[]).includes(r.kind) ? r.kind : 'one-off',
      type: r.type === 'income' ? 'income' : 'expense',
    }));
}

export type FileKind = 'pdf' | 'text' | 'xlsx';

export function fileKind(name: string, type: string): FileKind | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (['csv', 'txt', 'tsv'].includes(ext) || type.startsWith('text/')) return 'text';
  if (ext === 'xlsx') return 'xlsx';
  return null;
}

/** Reads a statement file into movements: with AI when configured, otherwise (CSV/Excel) with the local parser. */
export async function readStatement(name: string, kind: FileKind, buffer: ArrayBuffer): Promise<ImportResult> {
  const text = kind === 'pdf' ? null : kind === 'xlsx' ? await xlsxToText(buffer) : new TextDecoder('utf-8').decode(buffer);

  if (!aiConfigured()) {
    if (text === null) throw new AiError(AI_ENABLED ? 'Para ler PDFs é preciso configurar a IA (OPENAI_API_KEY). Exporta o extrato em CSV ou Excel, ou configura a chave.' : 'A leitura de PDFs com IA está bloqueada por agora. Exporta o extrato do banco em CSV ou Excel.', 503);
    const rows = parseStatementCsv(text);
    if (!rows.length) throw new AiError(AI_ENABLED ? 'Não reconhecemos as colunas deste ficheiro. Configura a IA (OPENAI_API_KEY) para ler qualquer formato.' : 'Não reconhecemos as colunas deste ficheiro. Confirma que tem data, descrição e valor (ou débito/crédito).', 422);
    return { rows, source: 'csv', warnings: ['Lido sem IA: as categorias são sugestões a partir da descrição.'] };
  }

  const userContent =
    text === null
      ? [
          { type: 'text' as const, text: `Extrato bancário em PDF: ${name}` },
          { type: 'file' as const, file: { filename: name, file_data: `data:application/pdf;base64,${Buffer.from(buffer).toString('base64')}` } },
        ]
      : `Extrato bancário (${name}):\n\n${text.slice(0, MAX_TEXT_CHARS)}`;

  try {
    const result = await chatJson<{ rows: ImportRow[]; warnings: string[] }>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
      'statement',
      SCHEMA,
    );
    const warnings = [...(result.warnings ?? [])];
    if (text && text.length > MAX_TEXT_CHARS) warnings.push('O ficheiro é muito longo: só a primeira parte foi lida. Divide o extrato por meses.');
    return { rows: clean(result.rows ?? []), source: 'ai', warnings };
  } catch (err) {
    // If the AI is down but the file is a readable CSV, still give the user something to review.
    const local = text ? parseStatementCsv(text) : [];
    if (local.length) return { rows: local, source: 'csv', warnings: [`A IA falhou (${(err as Error).message}); usámos a leitura local.`] };
    throw err;
  }
}
