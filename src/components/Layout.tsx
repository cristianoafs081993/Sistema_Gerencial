import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Banknote,
  ChevronRight,
  Clock3,
  FileStack,
  FileText,
  Landmark,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings2,
  Zap,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { AIAssistantWidget } from '@/components/ai/AIAssistantWidget';
import { appScreenGroups, appScreens, type AppScreenGroupId } from '@/lib/appScreens';
import { APP_BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

type NavigationLeaf = {
  name: string;
  href: string;
  screenId: string;
};

type NavigationItem = NavigationLeaf & {
  children?: NavigationLeaf[];
};

type NavigationSection = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
};

const groupIcons: Record<AppScreenGroupId, React.ComponentType<{ className?: string }>> = {
  orcamentario: Landmark,
  financeiro: Banknote,
  contratos: FileStack,
  licitacoes: ScrollText,
  energia: Zap,
  documentos: FileText,
  automacoes: Clock3,
  administracao: Settings2,
};

const nestedNavigation: Record<string, NavigationLeaf[]> = {
  planejamento: [
    { name: 'Campus', href: '/planejamento/campus', screenId: 'planejamento-campus' },
    { name: 'Sistêmico', href: '/planejamento/sistemico', screenId: 'planejamento-sistemico' },
    { name: 'Emendas parlamentares', href: '/planejamento/emendas-parlamentares', screenId: 'planejamento-emendas' },
  ],
  'editor-documentos': [
    { name: 'Despacho de Liquidação', href: '/editor-documentos/despacho-liquidacao', screenId: 'editor-documentos-despacho' },
    { name: 'ETP — Serviços Contínuos', href: '/editor-documentos/estudo-tecnico-preliminar-servicos-continuos', screenId: 'editor-documentos-etp' },
    { name: 'Mapa de Risco', href: '/editor-documentos/mapa-riscos-licitacao', screenId: 'editor-documentos-mapa-riscos' },
    { name: 'Termo de Referência', href: '/editor-documentos/termo-referencia-compras', screenId: 'editor-documentos-termo' },
    { name: 'Contrato de Serviço IFRN', href: '/editor-documentos/contrato-servico-ifrn', screenId: 'editor-documentos-contrato' },
  ],
};

function buildNavigationSections(canAccessScreen: (screenId: string) => boolean): NavigationSection[] {
  return appScreenGroups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((group) => {
      const items = appScreens
        .filter((screen) => screen.groupId === group.id && !screen.hiddenFromNavigation && canAccessScreen(screen.id))
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((screen) => ({
          name: screen.name,
          href: screen.path,
          screenId: screen.id,
          children: nestedNavigation[screen.id],
        }));

      return { title: group.name, icon: groupIcons[group.id], items };
    })
    .filter((section) => section.items.length > 0);
}

function isPathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/planejamento') return pathname.startsWith('/planejamento') || pathname.startsWith('/atividades');
  // Para o pai editor-documentos: ativo apenas quando a rota é exatamente /editor-documentos
  // (sem modelo na URL). Quando um filho está ativo, só o filho deve ser destacado.
  if (href === '/editor-documentos') return pathname === '/editor-documentos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isItemActive(pathname: string, item: NavigationItem) {
  return isPathActive(pathname, item.href) || Boolean(item.children?.some((child) => isPathActive(pathname, child.href)));
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isLoading: isAuthLoading, session, signOut, canAccessScreen } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [navigationSearch, setNavigationSearch] = useState('');
  const navigationSections = useMemo(() => buildNavigationSections(canAccessScreen), [canAccessScreen]);
  const defaultPasswordToastRef = useRef<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navigationSections.forEach((section) => {
      initial[section.title] = section.items.some((item) => isItemActive(location.pathname, item));
    });
    return initial;
  });
  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navigationSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.length) initial[item.screenId] = isItemActive(location.pathname, item);
      });
    });
    return initial;
  });
  const isConsultor = location.pathname === '/consultor';
  const userEmail = session?.user.email || null;

  useEffect(() => {
    const userId = session?.user.id || null;
    const usesDefaultPassword = session?.user.user_metadata?.uses_default_password === true;

    if (!userId || !usesDefaultPassword || defaultPasswordToastRef.current === userId) return;

    defaultPasswordToastRef.current = userId;
    toast.warning('Sua conta foi criada com a senha padrão "ifrn". Recomenda-se trocar a senha no próximo acesso.');
  }, [session?.user.id, session?.user.user_metadata?.uses_default_password]);

  useEffect(() => {
    setExpandedSections((current) => {
      const next = { ...current };
      let changed = false;

      navigationSections.forEach((section) => {
        const hasActiveItem = section.items.some((item) => isItemActive(location.pathname, item));
        if (hasActiveItem && !next[section.title]) {
          next[section.title] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });

    setExpandedSubmenus((current) => {
      const next = { ...current };
      let changed = false;

      navigationSections.forEach((section) => {
        section.items.forEach((item) => {
          if (item.children?.length && isItemActive(location.pathname, item) && !next[item.screenId]) {
            next[item.screenId] = true;
            changed = true;
          }
        });
      });

      return changed ? next : current;
    });
  }, [location.pathname, navigationSections]);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      const error = await signOut();
      if (error) throw error;

      toast.success('Sessão encerrada.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao encerrar a sessão.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const toggleSection = (title: string) => {
    setExpandedSections((current) => ({ ...current, [title]: !current[title] }));
  };

  const toggleSubmenu = (screenId: string) => {
    setExpandedSubmenus((current) => ({ ...current, [screenId]: !current[screenId] }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f7] text-[#222222]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[248px] shrink-0 flex-col overflow-hidden border-r border-[#dddddd] bg-white transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#dddddd] px-[14px]">
          <Link to="/" className="flex min-w-0 items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <img
              src={APP_BRAND.iconPath}
              alt=""
              aria-hidden="true"
              className="h-[26px] w-[26px] shrink-0 rounded-[7px] object-contain"
            />
            <span className="truncate text-sm font-bold tracking-[-0.3px] text-[#222222]">{APP_BRAND.name}</span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#6a6a6a] hover:bg-[#f7f7f7] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-2 scrollbar-thin">
          {navigationSections.map((section) => {
            const sectionExpanded = expandedSections[section.title] ?? true;
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="mb-0.5">
                <button
                  type="button"
                  className={cn(
                    'mb-0.5 flex w-full cursor-pointer select-none items-center justify-between rounded-[7px] px-2.5 py-[7px] text-left text-[13px] font-medium text-[#6a6a6a] transition-colors duration-100 hover:bg-[#f7f7f7] hover:text-[#222222]',
                    sectionExpanded && 'bg-[#f7f7f7] text-[#222222]',
                  )}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SectionIcon className={cn('h-4 w-4 shrink-0 text-[#9a9996]', sectionExpanded && 'text-[#2f9e41]')} />
                    <span className="truncate">{section.title}</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 shrink-0 text-[#c1c1c1] transition-transform duration-150',
                      sectionExpanded ? 'rotate-90' : 'rotate-0',
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'overflow-hidden pl-2 transition-[max-height,opacity] duration-200 ease-out',
                    sectionExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  {section.items.map((item) => {
                    const active = isItemActive(location.pathname, item);
                    // Para itens com filhos, o destaque visual aparece somente quando a rota
                    // é exatamente o href do pai, nunca quando um filho está ativo.
                    const parentDirectlyActive = item.children?.length
                      ? isPathActive(location.pathname, item.href)
                      : active;
                    const submenuExpanded = expandedSubmenus[item.screenId] ?? false;

                    if (item.children?.length) {
                      return (
                        <div key={item.screenId}>
                          <button
                            type="button"
                            className={cn(
                              'relative mb-px flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-left text-[13px] font-medium text-[#6a6a6a] transition-colors duration-100 hover:bg-[#f7f7f7] hover:text-[#222222]',
                              parentDirectlyActive && 'bg-[#f7f7f7] font-semibold text-[#222222]',
                            )}
                            onClick={() => toggleSubmenu(item.screenId)}
                          >
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <ChevronRight
                              className={cn(
                                'h-3 w-3 shrink-0 text-[#c1c1c1] transition-transform duration-150',
                                submenuExpanded && 'rotate-90',
                              )}
                            />
                          </button>

                          <div
                            className={cn(
                              'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
                              submenuExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
                            )}
                          >
                            {item.children.map((child) => {
                              const childActive = isPathActive(location.pathname, child.href);

                              return (
                                <Link
                                  key={child.screenId}
                                  to={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={cn(
                                    'relative mb-px flex items-center gap-2 rounded-[7px] py-1.5 pl-[22px] pr-2.5 text-xs font-normal text-[#6a6a6a] transition-colors duration-100 hover:bg-[#f7f7f7] hover:text-[#222222]',
                                    childActive && 'bg-[#f7f7f7] font-semibold text-[#222222]',
                                  )}
                                >
                                  <span className={cn('h-1 w-1 shrink-0 rounded-full bg-[#dddddd]', childActive && 'bg-[#858481]')} />
                                  <span className="truncate">{child.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.screenId}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'relative mb-px flex items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-[#6a6a6a] no-underline transition-colors duration-100 hover:bg-[#f7f7f7] hover:text-[#222222]',
                          active && 'bg-[#f7f7f7] font-semibold text-[#222222]',
                        )}
                      >
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[#dddddd] px-2.5 py-2.5">
          {isAuthLoading ? (
            <div className="h-[42px] animate-pulse rounded-lg bg-[#f7f7f7]" />
          ) : session ? (
            <div className="space-y-2">
              <div className="flex min-w-0 cursor-pointer items-center gap-[9px] rounded-lg px-2 py-[7px] transition-colors duration-100 hover:bg-[#f7f7f7]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#222222]">{userEmail || 'Sessão autenticada'}</div>
                  <div className="truncate text-[10px] text-[#6a6a6a]">Conta ativa</div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                className="h-9 w-full justify-start rounded-lg border-[#dddddd] bg-white text-xs text-[#6a6a6a] hover:bg-[#f7f7f7] hover:text-[#222222]"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? 'Saindo...' : 'Sair'}
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#dddddd] bg-white/90 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <label className="hidden min-w-[220px] max-w-[360px] flex-1 items-center gap-[7px] rounded-[7px] bg-[#f7f7f7] px-2.5 py-[7px] sm:flex">
              <Search className="h-[13px] w-[13px] shrink-0 text-[#c1c1c1]" />
              <input
                aria-label="Buscar módulo"
                type="search"
                value={navigationSearch}
                onChange={(event) => setNavigationSearch(event.target.value)}
                placeholder="Buscar módulo..."
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-medium text-[#222222] outline-none placeholder:text-[#c1c1c1] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>

            <div className="min-w-0">
              <div id="header-subtitle" className="truncate text-sm font-semibold text-[#34322d] empty:hidden" />
            </div>
          </div>

          <div id="header-actions" className="flex items-center gap-2" />
        </header>

        <main className={cn('min-h-0 flex-1 overflow-y-auto app-bg-soft', isConsultor ? 'p-0' : 'p-4 sm:p-6 lg:p-8')}>
          <div className={cn('mx-auto w-full max-w-[1600px]', isConsultor && 'max-w-none')}>{children}</div>
        </main>
      </div>
      <AIAssistantWidget />
    </div>
  );
}
