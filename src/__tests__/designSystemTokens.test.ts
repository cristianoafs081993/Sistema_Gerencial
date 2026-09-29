import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buttonVariants } from '@/components/ui/button';

const root = resolve(__dirname, '..', '..');
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('design system Paretto Institucional', () => {
  const css = read('src/index.css');
  const tailwindConfig = read('tailwind.config.ts');
  const html = read('index.html');

  it('define um tema único, sem os temas SUAP nem o seletor de temas', () => {
    expect(css).not.toMatch(/data-suap-theme/);
    expect(css).not.toMatch(/\.dark\s*[,{]/);
    expect(existsSync(resolve(root, 'src/components/suap/SuapThemeSwitcher.tsx'))).toBe(false);
    expect(read('src/main.tsx')).not.toMatch(/SuapTheme/);
    expect(read('src/components/Layout.tsx')).not.toMatch(/SuapTheme/);
  });

  it('declara a paleta navy/teal/lima e as cores semânticas no :root', () => {
    for (const token of [
      '--primary: 187 100% 28%',
      '--brand-navy: 209 72% 16%',
      '--brand-lime: 77 85% 67%',
      '--brand-cyan: 190 100% 43%',
      '--success:',
      '--warning:',
      '--info:',
      '--destructive:',
    ]) {
      expect(css).toContain(token);
    }
    expect(tailwindConfig).toContain('"brand-navy"');
    expect(tailwindConfig).toContain('"brand-lime"');
    expect(tailwindConfig).not.toMatch(/suap-(teal|aurora|dunas|govbr|luna)/);
  });

  it('usa Manrope na interface e IBM Plex Mono para dados', () => {
    expect(css).toMatch(/font-family: 'Manrope'/);
    expect(css).not.toMatch(/Open Sans/);
    expect(tailwindConfig).toMatch(/sans: \["Manrope"/);
    expect(html).toContain('family=Manrope');
    expect(html).toContain('family=IBM+Plex+Mono');
    expect(html).not.toContain('Figtree');
  });

  it('mantém botões com cantos de 8px e ação principal em navy', () => {
    const primary = buttonVariants();
    expect(primary).toContain('rounded-lg');
    expect(primary).toContain('bg-brand-navy');
    expect(primary).not.toContain('rounded-full');
    expect(buttonVariants({ variant: 'suap' })).toContain('bg-brand-navy');
  });

  it('não usa o mascote do Paretto', () => {
    const sources = [css, html, read('src/components/Layout.tsx'), read('src/components/Logo.tsx')].join('\n');
    expect(sources).not.toMatch(/mentor-paretto/i);
    expect(existsSync(resolve(root, 'public/mentor-paretto.png'))).toBe(false);
  });
});
