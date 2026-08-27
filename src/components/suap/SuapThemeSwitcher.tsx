import { useEffect, useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export type SuapThemeId =
  | 'padrao'
  | 'ifs'
  | 'aurora'
  | 'dunas'
  | 'govbr'
  | 'luna'
  | 'alto-contraste'
  | 'modo-daltonismo';

export interface SuapThemeOption {
  id: SuapThemeId;
  name: string;
  description: string;
  primaryColor: string;
  badgeBg: string;
}

export const SUAP_THEMES: SuapThemeOption[] = [
  {
    id: 'padrao',
    name: 'Padrão (SUAP)',
    description: 'Verde-azulado institucional do SUAP',
    primaryColor: '#0A7F70',
    badgeBg: '#CCFFF8',
  },
  {
    id: 'ifs',
    name: 'IFs / IFRN',
    description: 'Identidade visual dos Institutos Federais',
    primaryColor: '#1F7A2D',
    badgeBg: '#D6F5DB',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Degradê suave e acolhedor em tons de roxo',
    primaryColor: '#4456BB',
    badgeBg: '#DADDF1',
  },
  {
    id: 'dunas',
    name: 'Dunas',
    description: 'Cores harmônicas de areia do deserto',
    primaryColor: '#B98746',
    badgeBg: '#F1E7DA',
  },
  {
    id: 'govbr',
    name: 'Gov.br',
    description: 'Padrão federal azul do Governo Brasileiro',
    primaryColor: '#1351B4',
    badgeBg: '#D4E5FF',
  },
  {
    id: 'luna',
    name: 'Luna (Dark)',
    description: 'Modo escuro com ciano contrastado',
    primaryColor: '#14B8AA',
    badgeBg: '#1A1A1A',
  },
  {
    id: 'alto-contraste',
    name: 'Alto Contraste',
    description: 'Amarelo sobre preto para baixa visão',
    primaryColor: '#FFFF00',
    badgeBg: '#000000',
  },
  {
    id: 'modo-daltonismo',
    name: 'Modo Daltonismo',
    description: 'Otimizado para discromatopsia',
    primaryColor: '#B94686',
    badgeBg: '#F1DAE7',
  },
];

export const SUAP_THEME_STORAGE_KEY = 'suap_theme_selected';

export function getSavedSuapTheme(): SuapThemeId {
  if (typeof window === 'undefined') return 'padrao';
  try {
    const saved = localStorage.getItem(SUAP_THEME_STORAGE_KEY) as SuapThemeId;
    return SUAP_THEMES.some((t) => t.id === saved) ? saved : 'padrao';
  } catch {
    return 'padrao';
  }
}

export function applySuapTheme(themeId: SuapThemeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-suap-theme', themeId);
  
  // Se for Luna ou Alto Contraste, também aplica dark mode
  if (themeId === 'luna' || themeId === 'alto-contraste') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function initSuapTheme(): SuapThemeId {
  const theme = getSavedSuapTheme();
  applySuapTheme(theme);
  return theme;
}

export function useSuapTheme() {
  const [currentTheme, setCurrentTheme] = useState<SuapThemeId>(() => getSavedSuapTheme());

  useEffect(() => {
    applySuapTheme(currentTheme);
    try {
      localStorage.setItem(SUAP_THEME_STORAGE_KEY, currentTheme);
    } catch {
      // ignore storage errors
    }
  }, [currentTheme]);

  const setTheme = (themeId: SuapThemeId) => {
    setCurrentTheme(themeId);
    applySuapTheme(themeId);
    try {
      localStorage.setItem(SUAP_THEME_STORAGE_KEY, themeId);
    } catch {
      // ignore storage errors
    }
  };

  const activeTheme = SUAP_THEMES.find((t) => t.id === currentTheme) || SUAP_THEMES[0];

  return {
    currentTheme,
    activeTheme,
    setTheme,
    themes: SUAP_THEMES,
  };
}

export function SuapThemeSubMenu() {
  const { currentTheme, activeTheme, setTheme, themes } = useSuapTheme();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
        <Palette className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
        <span className="flex-1 text-left">Padrão de design (SUAP)</span>
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/15 shadow-xs"
          style={{ backgroundColor: activeTheme.primaryColor }}
          title={activeTheme.name}
        />
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="w-64 p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Padrões de Design SUAP</span>
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="space-y-0.5 max-h-[360px] overflow-y-auto scrollbar-thin">
          {themes.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <DropdownMenuItem
                key={theme.id}
                onSelect={() => setTheme(theme.id)}
                onClick={() => setTheme(theme.id)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-4 w-4 rounded-full shrink-0 border border-black/15 shadow-xs"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-none m-0 truncate">
                      {theme.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight m-0 mt-0.5 truncate">
                      {theme.description}
                    </p>
                  </div>
                </div>

                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export interface SuapThemeSwitcherProps {
  variant?: 'submenu' | 'button';
}

export function SuapThemeSwitcher({ variant = 'button' }: SuapThemeSwitcherProps) {
  const { currentTheme, activeTheme, setTheme, themes } = useSuapTheme();

  if (variant === 'submenu') {
    return <SuapThemeSubMenu />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold border-border/80 bg-card hover:bg-muted"
          title="Alternar Tema do SUAP Design System"
        >
          <span
            className="h-3 w-3 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: activeTheme.primaryColor }}
          />
          <span className="hidden sm:inline font-medium">{activeTheme.name}</span>
          <Palette className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-lg">
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Temas SUAP Design System</span>
          <Sparkles className="h-3 w-3 text-primary" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="space-y-0.5 max-h-[380px] overflow-y-auto scrollbar-thin">
          {themes.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <DropdownMenuItem
                key={theme.id}
                onSelect={() => setTheme(theme.id)}
                onClick={() => setTheme(theme.id)}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-4 w-4 rounded-full shrink-0 border border-black/15 shadow-xs"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-none m-0 truncate">
                      {theme.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight m-0 mt-0.5 truncate">
                      {theme.description}
                    </p>
                  </div>
                </div>

                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
