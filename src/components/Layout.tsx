import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Banknote,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileStack,
  FolderSync,
  FileText,
  KeyRound,
  Landmark,
  Loader2,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Warehouse,
  Zap,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { appScreenGroups, appScreens, type AppScreenGroupId } from '@/lib/appScreens';
import { APP_BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SuapSyncPanel } from '@/components/suap/SuapSyncPanel';
import { LogoIcon } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

type NavigationLeaf = {
  name: string;
  href: string;
  screenId: string;
  icon?: React.ComponentType<{ className?: string }>;
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
  operacoes: Warehouse,
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
  'pesquisa-precos': [
    { name: 'Cotações', href: '/pesquisa-precos', screenId: 'pesquisa-precos' },
    { name: 'Cadastro de Fornecedores', href: '/cadastro-fornecedores', screenId: 'cadastro-fornecedores' },
    { name: 'Capacitação EAD', href: '/pesquisa-precos/ead', screenId: 'pesquisa-precos-ead' },
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
          icon: screen.icon,
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
  // (sem modelo na URL). Quando um  filho está ativo, só o filho deve ser destacado.
  if (href === '/editor-documentos') return pathname === '/editor-documentos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isChildPathActive(pathname: string, href: string) {
  return pathname === href;
}

function isItemActive(pathname: string, item: NavigationItem) {
  return isPathActive(pathname, item.href) || Boolean(item.children?.some((child) => isChildPathActive(pathname, child.href)));
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isAccessLoading, session, signOut, updatePassword, canAccessScreen, userOrg } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSuapSettingsDialogOpen, setIsSuapSettingsDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [navigationSearch, setNavigationSearch] = useState('');
  const navigationSections = useMemo(() => {
    const sections = buildNavigationSections(canAccessScreen);
    if (!navigationSearch.trim()) return sections;

    const query = navigationSearch.toLowerCase();
    return sections
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          const matchName = item.name.toLowerCase().includes(query);
          const matchChildren = item.children?.some((child) =>
            child.name.toLowerCase().includes(query)
          );
          return matchName || matchChildren;
        });
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [canAccessScreen, navigationSearch]);
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
  const userEmail = session?.user?.email || null;
  const orgLabel = isAccessLoading ? 'Carregando órgão...' : userOrg?.name || 'Órgão não vinculado';

  useEffect(() => {
    const userId = session?.user?.id || null;
    const usesDefaultPassword = session?.user?.user_metadata?.uses_default_password === true;

    if (!userId || !usesDefaultPassword || defaultPasswordToastRef.current === userId) return;

    defaultPasswordToastRef.current = userId;
    toast.warning('Sua conta foi criada com a senha padrão "ifrn". Recomenda-se trocar a senha no próximo acesso.');
  }, [session?.user?.id, session?.user?.user_metadata?.uses_default_password]);

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
        if (navigationSearch.trim() && !next[section.title]) {
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
          if (navigationSearch.trim()) {
            const query = navigationSearch.toLowerCase();
            const childMatches = item.children?.some((child) => child.name.toLowerCase().includes(query));
            if (childMatches && !next[item.screenId]) {
              next[item.screenId] = true;
              changed = true;
            }
          }
        });
      });

      return changed ? next : current;
    });
  }, [location.pathname, navigationSections, navigationSearch]);

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

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Use uma senha com pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const error = await updatePassword(newPassword);
      if (error) throw error;

      setNewPassword('');
      setNewPasswordConfirmation('');
      setIsPasswordDialogOpen(false);
      toast.success('Senha alterada com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao alterar a senha.');
    } finally {
      setIsUpdatingPassword(false);
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
          className="fixed inset-0 z-40 bg-[#1A2B66]/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 pointer-events-auto"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-slate-200/85 bg-white transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand Header matching guidelines */}
        <div className="p-6 border-b border-slate-100 flex flex-col gap-1.5 bg-slate-50/70 relative">
          {/* Mobile Close Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>

          <Link to="/" className="flex items-center gap-3 no-underline" onClick={() => setSidebarOpen(false)}>
             <LogoIcon size={32} />
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none text-sebrae-navy flex items-center gap-1.5 m-0">
                SIAGES <span className="text-[10px] bg-sebrae-gold text-sebrae-navy px-1.5 py-0.5 rounded font-black">Beta</span>
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider m-0 mt-0.5">Gestão Estratégica & Integrada</p>
            </div>
          </Link>

          <div className="mt-3 py-1.5 px-3 bg-white rounded-md border border-slate-200/80 text-[11px] text-slate-700 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-ifrn-green animate-pulse"></span>
            <span className="min-w-0 truncate" title={orgLabel}>{orgLabel}</span>
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
                    'mb-1 flex w-full cursor-pointer select-none items-center justify-between rounded-[7px] px-3 py-[6px] text-left text-[10px] font-bold tracking-widest text-slate-500 uppercase transition-all duration-200 hover:bg-slate-50 hover:text-slate-950',
                    sectionExpanded && 'text-slate-900',
                  )}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SectionIcon className={cn('h-3.5 w-3.5 shrink-0 text-slate-500 transition-all duration-200', sectionExpanded && 'text-sebrae-blue scale-110')} />
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
                      ? location.pathname === item.href && !item.children.some(child => isChildPathActive(location.pathname, child.href))
                      : active;
                    const submenuExpanded = expandedSubmenus[item.screenId] ?? false;
                    const ItemIcon = item.icon;

                    if (item.children?.length) {
                      return (
                        <div key={item.screenId} className="mb-px">
                          <button
                            type="button"
                            className={cn(
                              'relative flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-slate-950 group',
                              parentDirectlyActive && 'bg-sebrae-blue/10 text-sebrae-navy font-bold pl-5',
                            )}
                            onClick={() => toggleSubmenu(item.screenId)}
                          >
                            {parentDirectlyActive && (
                              <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-sebrae-blue rounded-r" />
                            )}
                            {ItemIcon && (
                              <ItemIcon
                                className={cn(
                                  'h-4 w-4 shrink-0 transition-transform duration-200',
                                  parentDirectlyActive
                                    ? 'text-sebrae-blue scale-110'
                                    : 'text-slate-500 group-hover:text-slate-700 group-hover:scale-105'
                                )}
                              />
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
                              'overflow-hidden border-l border-slate-200 ml-[26px] pl-1.5 space-y-0.5 transition-[max-height,opacity] duration-300 ease-out',
                              submenuExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
                            )}
                          >
                            {item.children.map((child) => {
                              const childActive = isChildPathActive(location.pathname, child.href);

                              return (
                                <Link
                                  key={child.screenId}
                                  to={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={cn(
                                    'relative flex items-center gap-2 rounded-[7px] py-1.5 pl-[12px] pr-2.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-955',
                                    childActive && 'bg-sebrae-blue/5 font-semibold text-sebrae-navy pl-5',
                                  )}
                                >
                                  {childActive && (
                                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-sebrae-blue rounded-r" />
                                  )}
                                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 transition-colors duration-200', childActive && 'bg-sebrae-blue')} />
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
                          'relative flex items-center gap-[9px] rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700 no-underline transition-all duration-200 hover:bg-slate-50 hover:text-slate-955 group',
                          active && 'bg-sebrae-blue/10 text-sebrae-navy font-bold pl-5',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-sebrae-blue rounded-r" />
                        )}
                        {ItemIcon && (
                          <ItemIcon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform duration-200',
                              active
                                ? 'text-sebrae-blue scale-110'
                                : 'text-slate-500 group-hover:text-slate-700 group-hover:scale-105'
                            )}
                          />
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

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[10px]">
            <span>Versão do Beta</span>
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
              <div id="header-subtitle" className="truncate text-[10px] md:text-[11px] text-muted-gray font-semibold uppercase tracking-[0.14em] empty:hidden" />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* dynamic page action buttons (eg sync) */}
            <div id="header-actions" className="flex items-center gap-2" />

            {/* Help/WCAG Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-semibold text-emerald-700 select-none">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>WCAG 2.1 AAA</span>
            </div>

            {/* Notifications button */}
            <button 
              type="button" 
              className="p-1.5 hover:bg-slate-100 rounded-full text-muted-gray hover:text-ink-legacy transition-colors relative"
              title="Notificações"
            >
              <Bell className="w-4 h-4 md:w-4.5 md:h-4.5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-sebrae-gold rounded-full border border-white" />
            </button>

            {/* User settings */}
            {session && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border-l border-slate-200 py-1 pl-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:gap-2.5 md:pl-3"
                    aria-label="Abrir configurações do usuário"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sebrae-blue to-ifrn-green text-xs font-bold text-white shadow select-none">
                      {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                    </div>
                    <div className="hidden flex-col text-right sm:flex">
                      <span className="text-xs font-semibold leading-none text-ink-legacy">
                        {userEmail ? userEmail.split('@')[0] : 'Usuário'}
                      </span>
                      <span className="text-[10px] text-muted-gray">{userEmail || ''}</span>
                    </div>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-muted-gray sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="space-y-0.5">
                    <p className="text-sm font-semibold">{userEmail ? userEmail.split('@')[0] : 'Usuário'}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{userEmail || ''}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setIsSuapSettingsDialogOpen(true)} className="gap-2">
                    <FolderSync className="h-4 w-4 text-emerald-600" />
                    Configurar integração com o SUAP
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)} className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    Alterar senha
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={isSigningOut}
                    onSelect={() => void handleSignOut()}
                    className="gap-2 text-red-600 focus:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main className={cn('min-h-0 flex-1 overflow-y-auto app-bg-soft', isConsultor ? 'p-0' : 'p-4 sm:p-6 lg:p-8')}>
          <div className={cn('mx-auto w-full max-w-[1600px]', isConsultor && 'max-w-none')}>{children}</div>
        </main>
      </div>

      <Dialog open={isSuapSettingsDialogOpen} onOpenChange={setIsSuapSettingsDialogOpen}>
        <DialogContent className="flex h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border-default/60 px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <FolderSync className="h-5 w-5 text-emerald-600" />
              Configurar integração com o SUAP
            </DialogTitle>
            <DialogDescription>
              Gerencie suas caixas de processos e execute sincronizações manuais ou automáticas.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto p-6">
            {isSuapSettingsDialogOpen ? <SuapSyncPanel /> : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            setNewPassword('');
            setNewPasswordConfirmation('');
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Defina uma nova senha de acesso com pelo menos 8 caracteres.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="layout-new-password" className="text-sm font-medium text-foreground">
                Nova senha
              </label>
              <Input
                id="layout-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="layout-new-password-confirmation" className="text-sm font-medium text-foreground">
                Confirmar senha
              </label>
              <Input
                id="layout-new-password-confirmation"
                type="password"
                value={newPasswordConfirmation}
                onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleChangePassword();
                  }
                }}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isUpdatingPassword}
              onClick={() => void handleChangePassword()}
            >
              {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isUpdatingPassword ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
