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
  ShieldCheck,
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
          'fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-slate-200/85 bg-white transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand Header matching Sebrae guidelines */}
        <div className="p-6 border-b border-slate-100 flex flex-col gap-1.5 bg-slate-50/70 relative">
          {/* Mobile Close Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg text-slate-550 hover:bg-slate-200/50 hover:text-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>

          <Link to="/" className="flex items-center gap-3 no-underline" onClick={() => setSidebarOpen(false)}>
            <div className="w-10 h-10 rounded-lg bg-sebrae-gold flex items-center justify-center shadow-md transform rotate-2">
              <span className="text-sebrae-navy font-black text-xl tracking-tight">S</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none text-sebrae-navy flex items-center gap-1.5 m-0">
                SIGORC <span className="text-[10px] bg-sebrae-gold text-sebrae-navy px-1.5 py-0.5 rounded font-black">BaSe</span>
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider m-0 mt-0.5">Gestão Organizacional</p>
            </div>
          </Link>

          <div className="mt-3 py-1.5 px-3 bg-white rounded-md border border-slate-200/80 text-[11px] text-slate-700 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-ifrn-green animate-pulse"></span>
            <span>IFRN Campus Natal Central</span>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4 scrollbar-thin space-y-5 bg-white">
          {navigationSections.map((section) => {
            const sectionExpanded = expandedSections[section.title] ?? true;
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="space-y-1">
                <button
                  type="button"
                  className={cn(
                    'mb-1 flex w-full cursor-pointer select-none items-center justify-between rounded-[7px] px-3 py-[6px] text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase transition-all duration-200 hover:bg-slate-50 hover:text-slate-900',
                    sectionExpanded && 'text-slate-900',
                  )}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SectionIcon className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-all duration-200', sectionExpanded && 'text-sebrae-blue scale-110')} />
                    <span className="truncate">{section.title}</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200 ease-out',
                      sectionExpanded ? 'rotate-90' : 'rotate-0',
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'overflow-hidden pl-0.5 space-y-1 transition-[max-height,opacity] duration-300 ease-out',
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
                            type="button"
                            className={cn(
                              'relative flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-950',
                              parentDirectlyActive && 'bg-sebrae-blue/10 text-sebrae-navy font-bold pl-5',
                            )}
                            onClick={() => toggleSubmenu(item.screenId)}
                          >
                            {parentDirectlyActive && (
                              <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-sebrae-blue rounded-r" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <ChevronRight
                              className={cn(
                                'h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200 ease-out',
                                submenuExpanded && 'rotate-90',
                              )}
                            />
                          </button>

                          <div
                            className={cn(
                              'overflow-hidden border-l border-slate-200 ml-[18px] pl-1.5 space-y-0.5 transition-[max-height,opacity] duration-300 ease-out',
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
                                    'relative flex items-center gap-2 rounded-[7px] py-1.5 pl-[12px] pr-2.5 text-xs font-medium text-slate-550 transition-all duration-200 hover:bg-slate-550/5 hover:text-slate-950',
                                    childActive && 'bg-sebrae-blue/5 font-semibold text-sebrae-navy pl-5',
                                  )}
                                >
                                  {childActive && (
                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-sebrae-blue rounded-r" />
                                  )}
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-slate-250 transition-colors duration-200', childActive && 'bg-sebrae-blue')} />
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
                          'relative flex items-center gap-[9px] rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-600 no-underline transition-all duration-200 hover:bg-slate-50 hover:text-slate-950',
                          active && 'bg-sebrae-blue/10 text-sebrae-navy font-bold pl-5',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-sebrae-blue rounded-r" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 flex flex-col gap-3">
          {isAuthLoading ? (
            <div className="h-[42px] animate-pulse rounded-lg bg-slate-100" />
          ) : session ? (
            <div className="space-y-2.5">
              <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-800">{userEmail || 'Sessão autenticada'}</div>
                  <div className="truncate text-[10px] text-slate-500">Conta ativa</div>
                </div>
              </div>

              <button
                type="button"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                className="w-full text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-xs font-semibold bg-white shadow-sm"
              >
                <LogOut className="h-3.5 w-3.5 text-sebrae-blue" />
                <span>{isSigningOut ? 'Saindo...' : 'Sair do Sistema'}</span>
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-1 text-[10px]">
            <span>Versão do BaSe</span>
            <span className="font-mono text-[10px] text-slate-600">v2.1.4</span>
          </div>
          <div className="text-[10px] leading-tight text-slate-400">
            Desenvolvido para conformidade WCAG 2.1 com alto contraste.
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border-light bg-white/85 px-4 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl lg:hidden text-sebrae-navy"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <label className="hidden min-w-[220px] max-w-[360px] flex-1 items-center gap-[7px] rounded-full border border-transparent bg-slate-100 px-4 py-1.5 sm:flex transition-all focus-within:bg-white focus-within:border-sebrae-blue focus-within:ring-4 focus-within:ring-sebrae-blue/10">
              <Search className="h-[13px] w-[13px] shrink-0 text-muted-gray" />
              <input
                aria-label="Buscar módulo"
                type="search"
                value={navigationSearch}
                onChange={(event) => setNavigationSearch(event.target.value)}
                placeholder="Pesquisar módulo..."
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-medium text-ink-legacy outline-none placeholder:text-muted-gray focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>

            <div className="min-w-0">
              <div id="header-subtitle" className="truncate text-sm font-bold text-sebrae-navy tracking-tight empty:hidden" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-semibold text-emerald-700 select-none">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>WCAG 2.1 AAA</span>
            </div>
            <div id="header-actions" className="flex items-center gap-2" />
          </div>
        </header>

        <main className={cn('min-h-0 flex-1 overflow-y-auto app-bg-soft', isConsultor ? 'p-0' : 'p-4 sm:p-6 lg:p-8')}>
          <div className={cn('mx-auto w-full max-w-[1600px]', isConsultor && 'max-w-none')}>{children}</div>
        </main>
      </div>
    </div>
  );
}
