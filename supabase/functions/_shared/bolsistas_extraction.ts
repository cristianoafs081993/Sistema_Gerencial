// Normalizacao da resposta de IA para a lista de bolsistas de um processo de bolsa (LC).
// Mantido sem dependencias de Deno para ser testado com `deno test`.

export type BolsistaIa = {
  nome: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta: string;
  valor?: number;
};

export type BolsistasIaResult = {
  bolsistas: BolsistaIa[];
  declaredCount?: number;
  /** CPFs descartados por digito verificador invalido (provavel erro de leitura). */
  discardedInvalidCpf: number;
};

export const MAX_TEXT_CHARS = 200_000;

function text(value: unknown, max = 200): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Agencia/conta: mantem digitos, X do DV, ponto e hifen; remove tipo ("(Conta corrente)") e espacos. */
function bankField(value: unknown): string {
  return text(value, 40)
    .replace(/\(.*?\)/g, "")
    .replace(/[^0-9A-Za-z.-]/g, "")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toUpperCase();
}

function money(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
  const raw = text(value, 40).replace(/[^\d,.-]/g, "");
  if (!raw) return undefined;
  // "1.234,56" (pt-BR) ou "1234.56"
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : undefined;
}

export function normalizeBolsistasIaResponse(raw: unknown): BolsistasIaResult {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const items = Array.isArray(source.bolsistas) ? source.bolsistas : [];
  const seen = new Set<string>();
  const bolsistas: BolsistaIa[] = [];
  let discardedInvalidCpf = 0;

  for (const item of items.slice(0, 500)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const cpfDigits = text(entry.cpf, 20).replace(/\D/g, "");
    if (!cpfDigits) continue;
    if (!isValidCpf(cpfDigits)) {
      discardedInvalidCpf += 1;
      continue;
    }
    if (seen.has(cpfDigits)) continue;
    seen.add(cpfDigits);

    const valor = money(entry.valor);
    bolsistas.push({
      nome: text(entry.nome, 120).replace(/\s*\(\d{6,}\)\s*$/, ""),
      cpf: formatCpf(cpfDigits),
      banco: text(entry.bancoCodigo, 3).replace(/\D/g, "") || text(entry.banco, 80),
      agencia: bankField(entry.agencia),
      conta: bankField(entry.conta),
      ...(valor !== undefined ? { valor } : {}),
    });
  }

  const declared = Number(source.declaredCount);
  return {
    bolsistas,
    ...(Number.isInteger(declared) && declared > 0 && declared < 1000 ? { declaredCount: declared } : {}),
    discardedInvalidCpf,
  };
}

export function buildBolsistasPrompt(title: string, processNumber: string, expectedCount?: number): string {
  return [
    "Você extrai dados de pagamento de bolsas estudantis de um documento de processo do IFRN (ofício, relação ou planilha).",
    `Documento: ${title || "não informado"}. Processo: ${processNumber || "não informado"}.`,
    expectedCount ? `O documento declara ${expectedCount} bolsa(s).` : "",
    "Liste cada aluno bolsista com: nome (sem a matrícula), cpf, banco (como escrito), bancoCodigo (código COMPE de 3 dígitos quando o documento trouxer ou quando o nome do banco for inequívoco; caso contrário, vazio), agencia, conta (com dígito verificador, inclusive X) e valor da bolsa em reais.",
    "Quando o valor é único para todos (por exemplo, 'corresponde a R$ 400,00 por pessoa'), repita-o em cada aluno.",
    "Regras: use somente o que está no documento; não invente nem complete dados ausentes (deixe vazio); ignore servidores, assinantes e chefias; não repita alunos.",
    "declaredCount: total de bolsas declarado no texto (ex.: '10 (dez) bolsas'), ou null.",
    'Retorne exclusivamente JSON: {"declaredCount": number|null, "bolsistas": [{"nome":"","cpf":"","banco":"","bancoCodigo":"","agencia":"","conta":"","valor":0}]}.',
  ].filter(Boolean).join("\n");
}

export const BOLSISTAS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    declaredCount: { type: "INTEGER", nullable: true },
    bolsistas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          cpf: { type: "STRING" },
          banco: { type: "STRING" },
          bancoCodigo: { type: "STRING" },
          agencia: { type: "STRING" },
          conta: { type: "STRING" },
          valor: { type: "NUMBER", nullable: true },
        },
        required: ["nome", "cpf", "agencia", "conta"],
      },
    },
  },
  required: ["bolsistas"],
} as const;
