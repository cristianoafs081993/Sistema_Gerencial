import { describe, expect, it } from 'vitest';

import { parseJsonResponse, repairJsonControlCharacters } from '../../../supabase/functions/_shared/json_response';

describe('parseJsonResponse', () => {
  it('repairs literal control characters inside Gemini string values', () => {
    const response = '{"summary":"Primeira linha\nSegunda linha","finding":"Campo:\tvalor\\r\\n"}';

    expect(parseJsonResponse(response)).toEqual({
      summary: 'Primeira linha\nSegunda linha',
      finding: 'Campo:\tvalor\r\n',
    });
  });

  it('repairs control characters after a literal backslash without changing JSON structure', () => {
    const response = '{"text":"C:\\\n\tcontinua"}';

    expect(parseJsonResponse(response)).toEqual({ text: 'C:' + String.fromCharCode(92, 10, 9) + 'continua' });
  });

  it('keeps valid fenced JSON behavior', () => {
    expect(parseJsonResponse('```json\n{"status":"ok"}\n```')).toEqual({ status: 'ok' });
  });

  it('does not alter valid escaped sequences', () => {
    const response = '{"text":"linha 1\\nlinha 2\\tok"}';

    expect(repairJsonControlCharacters(response)).toBe(response);
    expect(parseJsonResponse(response)).toEqual({ text: 'linha 1\nlinha 2\tok' });
  });
});
