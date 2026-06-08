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
    <div className="flex h-screen overflow-hidden bg-background text-[#222222]">
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
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[248px] shrink-0 flex-col overflow-hidden border-r border-[#e5e5e0]/60 bg-[#f9fafb] transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e5e0]/60 px-[16px]">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <img
              src={APP_BRAND.iconPath}
              alt=""
              aria-hidden="true"
              className="h-[28px] w-[28px] shrink-0 rounded-lg object-contain shadow-sm border border-[#e5e5e0]/40"
            />
            <span className="truncate text-[15px] font-bold tracking-[-0.4px] text-[#1a1a19]">{APP_BRAND.name}</span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#6a6a6a] hover:bg-[#f3f4f6]/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-3.5 scrollbar-thin">
          {navigationSections.map((section) => {
            const sectionExpanded = expandedSections[section.title] ?? true;
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="mb-2">
                <button
                  type="button"
                  className={cn(
                    'mb-1 flex w-full cursor-pointer select-none items-center justify-between rounded-[7px] px-2.5 py-[6px] text-left text-[11px] font-bold tracking-[0.06em] text-[#8e8d8a] uppercase transition-all duration-200 hover:bg-[#f3f4f6]/60 hover:text-[#222222]',
                    sectionExpanded && 'text-[#222222]',
                  )}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SectionIcon className={cn('h-3.5 w-3.5 shrink-0 text-[#9a9996] transition-colors duration-200', sectionExpanded && 'text-[#2f9e41]')} />
                    <span className="truncate">{section.title}</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 shrink-0 text-[#c1c1c1] transition-transform duration-200 ease-out',
                      sectionExpanded ? 'rotate-90' : 'rotate-0',
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'overflow-hidden pl-0.5 transition-[max-height,opacity] duration-300 ease-out',
                    sectionExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  {section.items.map((item) => {
                    const active = isItemActive(location.pathname, item);
                    const parentDirectlyActive = item.children?.length
                      ? location.pathname === item.href
                      : active;
                    const submenuExpanded = expandedSubmenus[item.screenId] ?? false;

                    if (item.children?.length) {
                      return (
                        <div key={item.screenId} className="mb-px">
                          <button
                            type="button; cursor-pointer"
                            className={cn(
                              'relative mb-px flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-[7.5px] text-left text-[13px] font-medium text-[#5c5b57] transition-all duration-200 hover:bg-[#f3f4f6]/80 hover:text-[#222222]',
                              parentDirectlyActive && 'bg-white shadow-sm border border-[#2f9e41]/10 font-semibold text-[#2f9e41] before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[3px] before:rounded-r-full before:bg-[#2f9e41]',
                            )}
                            onClick={() => toggleSubmenu(item.screenId)}
                          >
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <ChevronRight
                              className={cn(
                                'h-3 w-3 shrink-0 text-[#c1c1c1] transition-transform duration-200 ease-out',
                                submenuExpanded && 'rotate-90',
                              )}
                            />
                          </button>

                          <div
                            className={cn(
                              'overflow-hidden border-l border-[#e5e5e0] ml-[18px] pl-1.5 transition-[max-height,opacity] duration-300 ease-out',
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
                                    'relative mb-px flex items-center gap-2 rounded-[7px] py-1.5 pl-[12px] pr-2.5 text-xs font-normal text-[#6a6a6a] transition-all duration-200 hover:bg-[#f3f4f6]/80 hover:text-[#222222]',
                                    childActive && 'bg-white shadow-xs border border-[#2f9e41]/5 font-semibold text-[#2f9e41] before:absolute before:left-0 before:top-[4px] before:bottom-[4px] before:w-[2px] before:rounded-r-full before:bg-[#2f9e41]',
                                  )}
                                >
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-[#dddddd] transition-colors duration-200', childActive && 'bg-[#2f9e41]')} />
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
                          'relative mb-px flex items-center gap-[9px] rounded-lg px-2.5 py-[7.5px] text-[13px] font-medium text-[#5c5b57] no-underline transition-all duration-200 hover:bg-[#f3f4f6]/80 hover:text-[#222222]',
                          active && 'bg-white shadow-sm border border-[#2f9e41]/10 font-semibold text-[#2f9e41] before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[3px] before:rounded-r-full before:bg-[#2f9e41]',
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

        <div className="shrink-0 border-t border-[#e5e5e0]/60 bg-[#f4f4f6]/30 px-3.5 py-3">
          {isAuthLoading ? (
            <div className="h-[42px] animate-pulse rounded-lg bg-[#f0f0f2]" />
          ) : session ? (
            <div className="space-y-2.5">
              <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-[#f3f4f6]/40 border border-[#e5e5e0]/40 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#2c2b29]">{userEmail || 'Sessão autenticada'}</div>
                  <div className="truncate text-[10px] font-medium text-[#8c8b88]">Conta ativa</div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                className="h-8.5 w-full justify-center rounded-lg border-[#e5e5e0] bg-white text-xs font-semibold text-[#5c5b57] transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                {isSigningOut ? 'Saindo...' : 'Sair'}
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#dddddd]/70 bg-white/80 px-4 backdrop-blur-md lg:px-6">
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

            <label className="hidden min-w-[220px] max-w-[360px] flex-1 items-center gap-[7px] rounded-lg border border-border-default/60 bg-[#f7f7f7]/60 px-3 py-1.5 sm:flex transition-all focus-within:border-[#2f9e41]/50 focus-within:ring-4 focus-within:ring-[#2f9e41]/5">
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
    </div>
  );
}
