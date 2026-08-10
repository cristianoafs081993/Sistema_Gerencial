import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('manifesto da extensao no Campus', () => {
  it('carrega o bridge na rota Campus com e sem barra final', () => {
    const manifest = JSON.parse(readFileSync(extensionFixturePath('manifest.json'), 'utf8')) as {
      content_scripts: Array<{ matches: string[]; js: string[] }>;
    };
    const campus = manifest.content_scripts.find((entry) => entry.js.includes('siages-plan-sync.js'));
    expect(campus).toEqual({
      matches: ['https://www.siages.com.br/planejamento/campus*'],
      js: ['siages-plan-sync.js'],
      run_at: 'document_idle',
    });
  });
});
