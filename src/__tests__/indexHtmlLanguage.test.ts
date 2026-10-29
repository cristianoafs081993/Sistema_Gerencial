// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

// Com lang="en" o Chrome oferecia/aplicava tradução automática para português,
// trocando rótulos da sidebar (ex.: "Dashboard" -> "Painel", "Planejamento" -> "Ó").
describe('index.html', () => {
  it('declara o documento como pt-BR', () => {
    expect(indexHtml).toMatch(/<html[^>]*\blang="pt-BR"/);
  });

  it('desativa a tradução automática do navegador', () => {
    expect(indexHtml).toMatch(/<html[^>]*\btranslate="no"/);
    expect(indexHtml).toContain('<meta name="google" content="notranslate" />');
  });
});
