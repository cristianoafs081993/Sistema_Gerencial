import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('analisar-liquidacao-siafi AI provider config', () => {
  it('uses Gemini credentials for SUAP liquidation summaries', () => {
    const functionSource = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/analisar-liquidacao-siafi/index.ts'),
      'utf8',
    );

    expect(functionSource).toContain("Deno.env.get('GEMINI_API_KEY')");
    expect(functionSource).toContain("Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')");
    expect(functionSource).toContain('generativelanguage.googleapis.com');
    expect(functionSource).not.toContain('OPENAI_API_KEY');
    expect(functionSource).not.toContain('api.openai.com');
  });
});
