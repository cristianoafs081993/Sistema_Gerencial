type SupabaseFunctionErrorLike = {
  context?: unknown;
  message?: unknown;
};

async function readResponseError(response: Response): Promise<string | null> {
  const cloned = response.clone();

  try {
    const body = await cloned.json();
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
      if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
    }
  } catch {
    // Fall through to text parsing.
  }

  try {
    const text = await response.clone().text();
    return text.trim() || null;
  } catch {
    return null;
  }
}

export async function getSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
  const record = error && typeof error === 'object' ? (error as SupabaseFunctionErrorLike) : null;
  const context = record?.context;

  if (context instanceof Response) {
    const responseMessage = await readResponseError(context);
    if (responseMessage) return responseMessage;
  }

  if (typeof record?.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  return 'Falha ao executar a Edge Function.';
}
