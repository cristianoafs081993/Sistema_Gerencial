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
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings2,
  Warehouse,
  Zap,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { AIAssistantWidget } from '@/components/ai/AIAssistantWidget';
import { useOptionalData } from '@/contexts/DataContext';
import { appScreenGroups, appScreens, type AppScreenGroupId } from '@/lib/appScreens';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SuapSyncPanel } from '@/components/suap/SuapSyncPanel';
import { SuapThemeSubMenu } from '@/components/suap/SuapThemeSwitcher';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
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
  refeitorio: [
    { name: 'Requisição de Compra', href: '/requisicao-compra', screenId: 'requisicao-compra' },
    { name: 'Insumos', href: '/refeitorio/insumos', screenId: 'refeitorio-insumos' },
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
          children: nestedNavigation[screen.id]?.filter((child) => canAccessScreen(child.screenId)),
        }));

      return { title: group.name, icon: groupIcons[group.id], items };
    })
    .filter((section) => section.items.length > 0);
}

function isPathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/planejamento') return pathname.startsWith('/planejamento') || pathname.startsWith('/atividades');
  if (href === '/editor-documentos') return pathname === '/editor-documentos';
  if (href === '/refeitorio') return pathname.startsWith('/refeitorio') || pathname.startsWith('/requisicao-compra');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isChildPathActive(pathname: string, href: string) {
  if (href === '/requisicao-compra') return pathname.startsWith('/requisicao-compra');
  return pathname === href;
}

function isItemActive(pathname: string, item: NavigationItem) {
  return isPathActive(pathname, item.href) || Boolean(item.children?.some((child) => isChildPathActive(pathname, child.href)));
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const {
    isAccessLoading,
    session,
    signOut,
    updatePassword,
    canAccessScreen,
    userOrg,
    userGroups = [],
  } = useAuth();
  const dataContext = useOptionalData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('siages-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSuapSettingsDialogOpen, setIsSuapSettingsDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [navigationSearch, setNavigationSearch] = useState('');
  const isTerceirizado = userGroups.some((group) => group.slug === 'terceirizado');

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

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('siages-sidebar-collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs lg:hidden transition-opacity duration-200 pointer-events-auto"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-all duration-250 ease-out lg:relative lg:translate-x-0',
            isSidebarCollapsed ? 'w-18' : 'w-72',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* Brand Header */}
          <div className={cn(
            'h-14 border-b border-border flex items-center transition-all duration-200 relative bg-muted/30',
            isSidebarCollapsed ? 'px-3 justify-center' : 'px-4 justify-between'
          )}>
            <Link
              to="/"
              className={cn('flex items-center no-underline gap-3 min-w-0', isSidebarCollapsed && 'justify-center')}
              onClick={() => setSidebarOpen(false)}
            >
              <LogoIcon size={isSidebarCollapsed ? 28 : 32} />
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <h1 className="font-bold text-base tracking-tight leading-none text-foreground flex items-center gap-1.5 m-0">
                    SIAGES <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Beta</span>
                  </h1>
                  <p className="text-[10px] text-muted-foreground tracking-wider m-0 mt-0.5 truncate">Administração e Gestão Estratégica</p>
                </div>
              )}
            </Link>

            {/* Mobile Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden shrink-0"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Section */}
          <nav className={cn(
            'min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-card',
            isSidebarCollapsed ? 'px-2 py-3 space-y-3' : 'px-3.5 py-3 space-y-4'
          )}>
            {navigationSections.map((section) => {
              const sectionExpanded = expandedSections[section.title] ?? true;
              const SectionIcon = section.icon;

              if (isSidebarCollapsed) {
                // Collapsed Rail Mode: Show concise icon triggers with tooltips
                return (
                  <div key={section.title} className="flex flex-col items-center space-y-1.5">
                    {section.items.map((item) => {
                      const active = isItemActive(location.pathname, item);
                      const ItemIcon = item.icon || SectionIcon;

                      return (
                        <Tooltip key={item.screenId}>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 relative group',
                                active
                                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )}
                              aria-label={item.name}
                            >
                              <ItemIcon className="h-5 w-5 shrink-0" />
                              {active && (
                                <span className="absolute -left-2 top-2 bottom-2 w-1 bg-primary rounded-r" />
                              )}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={12} className="flex flex-col gap-0.5">
                            <span className="font-semibold text-xs">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground">{section.title}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              }

              // Expanded Mode: Full hierarchical navigation
              return (
                <div key={section.title} className="space-y-1">
                  <button
                    type="button"
                    className={cn(
                      'mb-1 flex w-full cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-1 text-left text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-all duration-150 hover:bg-muted hover:text-foreground',
                      sectionExpanded && 'text-foreground font-extrabold',
                    )}
                    onClick={() => toggleSection(section.title)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SectionIcon className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-150', sectionExpanded && 'text-primary scale-110')} />
                      <span className="truncate">{section.title}</span>
                    </span>
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150 ease-out',
                        sectionExpanded ? 'rotate-90' : 'rotate-0',
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      'overflow-hidden pl-0.5 space-y-0.5 transition-[max-height,opacity] duration-200 ease-out',
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
                                'relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-all duration-150 hover:bg-muted group',
                                parentDirectlyActive && 'bg-primary/10 text-primary font-bold pl-4',
                              )}
                              onClick={() => toggleSubmenu(item.screenId)}
                            >
                              {parentDirectlyActive && (
                                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r" />
                              )}
                              {ItemIcon && (
                                <ItemIcon
                                  className={cn(
                                    'h-4 w-4 shrink-0 transition-transform duration-150',
                                    parentDirectlyActive
                                      ? 'text-primary scale-110'
                                      : 'text-muted-foreground group-hover:text-foreground group-hover:scale-105'
                                  )}
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">{item.name}</span>
                              <ChevronRight
                                className={cn(
                                  'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150 ease-out',
                                  submenuExpanded && 'rotate-90',
                                )}
                              />
                            </button>

                            <div
                              className={cn(
                                'overflow-hidden border-l border-border ml-[20px] pl-1.5 space-y-0.5 transition-[max-height,opacity] duration-200 ease-out',
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
                                      'relative flex items-center gap-2 rounded-md py-1 pl-3 pr-2 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
                                      childActive && 'bg-primary/10 font-bold text-primary pl-3.5',
                                    )}
                                  >
                                    {childActive && (
                                      <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-primary rounded-r" />
                                    )}
                                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-border transition-colors duration-150', childActive && 'bg-primary')} />
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
                            'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground no-underline transition-all duration-150 hover:bg-muted group',
                            active && 'bg-primary/10 text-primary font-bold pl-4',
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r" />
                          )}
                          {ItemIcon && (
                            <ItemIcon
                              className={cn(
                                'h-4 w-4 shrink-0 transition-transform duration-150',
                                active
                                  ? 'text-primary scale-110'
                                  : 'text-muted-foreground group-hover:text-foreground group-hover:scale-105'
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

          {/* Sidebar Footer & Collapse Toggle */}
          <div className={cn(
            'shrink-0 border-t border-border bg-muted/20 flex transition-all duration-200',
            isSidebarCollapsed ? 'p-2 flex-col items-center gap-2' : 'p-3 flex-col gap-2'
          )}>
            <div className="flex items-center justify-between w-full">
              {!isSidebarCollapsed ? (
                <div className="flex items-center justify-between flex-1 text-[11px] text-muted-foreground pr-2">
                  <span>Versão <strong className="text-foreground">v3.0</strong></span>
                  <span className="font-mono text-[10px] text-muted-foreground">Beta</span>
                </div>
              ) : null}

              {/* Desktop Rail Mode Toggle Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hidden lg:flex h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={toggleSidebarCollapsed}
                    aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isSidebarCollapsed ? 'Expandir barra lateral' : 'Recolher para modo compacto'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-md lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Mobile menu trigger */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg lg:hidden text-foreground"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Search input with Command Palette Trigger */}
              <label className="hidden min-w-[240px] max-w-[380px] flex-1 items-center justify-between gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs text-foreground sm:flex transition-all hover:bg-card hover:border-primary/50 focus-within:bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 cursor-pointer shadow-2xs">
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <Search className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
                  <input
                    aria-label="Buscar módulo"

                    type="search"
                    value={navigationSearch}
                    onChange={(event) => setNavigationSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setIsCommandPaletteOpen(true);
                      }
                    }}
                    placeholder="Pesquisar no SIAGES..."
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCommandPaletteOpen(true);
                  }}
                  className="kbd-shortcut cursor-pointer hover:bg-muted/80"
                  title="Abrir central de comandos (Ctrl+K)"
                  aria-label="Abrir busca e comandos"
                >
                  Ctrl K
                </button>
              </label>


              <div className="min-w-0">
                <div id="header-subtitle" className="truncate text-[10px] md:text-[11px] text-muted-foreground font-bold uppercase tracking-wider empty:hidden" />
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* dynamic page action buttons (eg sync) */}
              <div id="header-actions" className="flex items-center gap-2" />

              {/* Notification Center */}
              <NotificationCenter
                empenhos={dataContext?.empenhos}
                descentralizacoes={dataContext?.descentralizacoes}
                atividades={dataContext?.atividades}
                onSaveEmpenho={dataContext?.updateEmpenho}
              />

              {/* User settings */}
              {session && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg border-l border-border py-1 pl-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:gap-2.5 md:pl-3"
                      aria-label="Abrir configurações do usuário"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-xs select-none">
                        {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                      </div>
                      <div className="hidden flex-col text-right sm:flex">
                        <span className="text-xs font-semibold leading-none text-foreground">
                          {userEmail ? userEmail.split('@')[0] : 'Usuário'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{userEmail || ''}</span>
                      </div>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{userEmail ? userEmail.split('@')[0] : 'Usuário'}</p>
                        <p className="truncate text-xs font-normal text-muted-foreground">{userEmail || ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" />
                        <span className="min-w-0 truncate" title={orgLabel}>{orgLabel}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsCommandPaletteOpen(true)} className="gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      Buscar comandos (Ctrl+K)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsSuapSettingsDialogOpen(true)} className="gap-2">
                      <FolderSync className="h-4 w-4 text-emerald-600" />
                      Configurar integração com o SUAP
                    </DropdownMenuItem>
                    <SuapThemeSubMenu />
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

          <main className={cn('min-h-0 flex-1 overflow-y-auto app-bg-soft animate-fade-in', isConsultor ? 'p-0' : 'p-4 sm:p-6 lg:p-8')}>
            <div className={cn('mx-auto w-full max-w-[1600px]', isConsultor && 'max-w-none')}>{children}</div>
          </main>
        </div>

        {/* Global Command Palette Dialog */}
        <CommandPalette
          open={isCommandPaletteOpen}
          onOpenChange={setIsCommandPaletteOpen}
          onOpenSuapSync={() => setIsSuapSettingsDialogOpen(true)}
          onOpenPasswordChange={() => setIsPasswordDialogOpen(true)}
          onSignOut={() => void handleSignOut()}
          empenhosList={dataContext?.empenhos}
          contratosList={isTerceirizado ? [] : dataContext?.contratos}
          disableContractSearch={isTerceirizado}
          atividadesList={dataContext?.atividades}
          onSaveEmpenho={dataContext?.updateEmpenho}
        />


        {/* SUAP Sync Modal */}
        <Dialog open={isSuapSettingsDialogOpen} onOpenChange={setIsSuapSettingsDialogOpen}>
          <DialogContent className="flex h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-6 py-5">
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

        {/* Password Change Modal */}
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
        <AIAssistantWidget />
      </div>
    </TooltipProvider>
  );
}
