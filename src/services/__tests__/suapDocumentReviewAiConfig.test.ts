import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('analisar-documento-licitacao AI provider config', () => {
  it('uses OpenAI as the primary provider and Gemini as fallback', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/analisar-documento-licitacao/index.ts'),
      'utf8',
    );

    expect(source).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(source).toContain('Deno.env.get("OPENAI_SUAP_DOCUMENT_REVIEW_MODEL") ?? "gpt-5.6-luna"');
    expect(source).toContain('https://api.openai.com/v1/responses');
    expect(source).toContain('type: "input_file"');
    expect(source).toContain('await requestOpenAi(');
    expect(source).toContain('await requestGemini(');
    expect(source.indexOf('await requestOpenAi(')).toBeLessThan(source.indexOf('await requestGemini('));
    expect(source).toContain('Gemini será usado como fallback');
  });
});
