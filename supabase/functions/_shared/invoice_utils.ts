export type InvoiceRecord = {
  numero: string | null;
  data_emissao: string | null;
  valor: string | null;
};

function cleanInvoiceValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const normalized = cleaned.toLowerCase();
  if (normalized === "-" || normalized === "null" || normalized === "undefined" || normalized === "nao extraido") {
    return null;
  }
  return cleaned;
}

export function normalizeInvoiceList(value: unknown): InvoiceRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({
      numero: cleanInvoiceValue(item.numero),
      data_emissao: cleanInvoiceValue(item.data_emissao),
      valor: cleanInvoiceValue(item.valor),
    }))
    .filter((invoice) => Boolean(invoice.numero || invoice.data_emissao || invoice.valor));
}

export function mergeInvoiceLists(existing: InvoiceRecord[], incoming: InvoiceRecord[]): InvoiceRecord[] {
  const seen = new Set<string>();
  const merged: InvoiceRecord[] = [];

  for (const invoice of [...existing, ...incoming]) {
    const key = [invoice.numero, invoice.data_emissao, invoice.valor]
      .map((value) => (value || "").trim().toLowerCase())
      .join("|");
    if (!key.replace(/\|/g, "") || seen.has(key)) continue;
    seen.add(key);
    merged.push(invoice);
  }

  return merged;
}
