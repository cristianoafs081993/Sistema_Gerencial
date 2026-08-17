import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuapThemeSwitcher, SUAP_THEMES, applySuapTheme } from '../SuapThemeSwitcher';

describe('SuapThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-suap-theme');
    document.documentElement.classList.remove('dark');
  });

  it('renders all 8 SUAP themes', () => {
    expect(SUAP_THEMES).toHaveLength(8);
    expect(SUAP_THEMES.map((t) => t.id)).toEqual([
      'padrao',
      'ifs',
      'aurora',
      'dunas',
      'govbr',
      'luna',
      'alto-contraste',
      'modo-daltonismo',
    ]);
  });

  it('applies default padrao theme on mount', () => {
    render(<SuapThemeSwitcher />);
    expect(document.documentElement.getAttribute('data-suap-theme')).toBe('padrao');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark class when luna theme is applied', () => {
    applySuapTheme('luna');
    expect(document.documentElement.getAttribute('data-suap-theme')).toBe('luna');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies dark class when alto-contraste is applied and removes for ifs', () => {
    applySuapTheme('alto-contraste');
    expect(document.documentElement.getAttribute('data-suap-theme')).toBe('alto-contraste');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applySuapTheme('ifs');
    expect(document.documentElement.getAttribute('data-suap-theme')).toBe('ifs');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('renders button trigger with current theme name', () => {
    render(<SuapThemeSwitcher />);
    expect(screen.getByText('Padrão (SUAP)')).toBeDefined();
  });
});
