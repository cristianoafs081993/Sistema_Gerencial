// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('analisar-documento-licitacao AI provider config', () => {
  it('uses only Gemini and never calls OpenAI', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/analisar-documento-licitacao/index.ts'),
      'utf8',
    );

    expect(source).toContain('Deno.env.get("GEMINI_SUAP_DOCUMENT_REVIEW_MODEL") ?? "gemini-2.5-flash"');
    expect(source).toContain('await requestGemini(');
    expect(source.toLowerCase()).not.toContain('openai');
  });
});

describe('extrair-bolsistas-documento AI provider config', () => {
  it('uses only Gemini and never calls OpenAI', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/extrair-bolsistas-documento/index.ts'),
      'utf8',
    );

    expect(source).toContain('await requestGemini(');
    expect(source.toLowerCase()).not.toContain('openai');
  });
});
