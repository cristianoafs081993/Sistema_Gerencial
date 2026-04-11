import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDownRight,
  Banknote,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Receipt,
  ScanSearch,
  ShieldAlert,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { InviteUserDialog } from '@/components/auth/InviteUserDialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
}

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    title: 'Orçamentário',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Planejamento', href: '/planejamento', icon: FileText },
      { name: 'Descentralizações', href: '/descentralizacoes', icon: ArrowDownRight },
      { name: 'Empenhos', href: '/empenhos', icon: Receipt },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { name: 'Liquidações', href: '/liquidacoes-pagamentos', icon: Banknote },
      { name: 'Financeiro', href: '/financeiro', icon: ClipboardList },
      { name: 'Lista de Credores', href: '/lc', icon: ClipboardList },
      { name: 'Retenções EFD-Reinf', href: '/retencoes-efd-reinf', icon: ShieldAlert },
      { name: 'Rastreabilidade de PFs', href: '/rastreabilidade-pfs', icon: ClipboardList },
      { name: 'Conciliação de PFs', href: '/conciliacao-pfs', icon: ScanSearch },
    ],
  },
  {
    title: 'Contratos',
    items: [{ name: 'Contratos', href: '/contratos', icon: FileStack }],
  },
  {
    title: 'Documentos',
    items: [
      { name: 'Gerador de Documentos', href: '/gerador-documentos', icon: Wand2 },
      { name: 'Editor de Documentos', href: '/editor-documentos', icon: Bot },
      { name: 'Consultor Jurídico', href: '/consultor', icon: MessageSquare },
    ],
  },
];

function isPathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isLoading: isAuthLoading, session, signOut, canInviteUsers } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const activeSection = navigationSections.find((section) =>
      section.items.some((item) => isPathActive(location.pathname, item.href)),
    );

    return navigationSections.reduce<Record<string, boolean>>((acc, section) => {
      acc[section.title] = section.title === activeSection?.title;
      return acc;
    }, {});
  });

  const isConsultor = location.pathname === '/consultor';
  const isPlanningRoute = location.pathname.startsWith('/planejamento');

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const activeSection = navigationSections.find((section) =>
      section.items.some((item) => isPathActive(location.pathname, item.href)),
    );
    if (!activeSection) return;
    setExpandedSections((prev) => ({ ...prev, [activeSection.title]: true }));
  }, [location.pathname]);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      const error = await signOut();
      if (error) {
        throw error;
      }

      toast.success('Sessao encerrada.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao encerrar a sessao.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex min-h-screen bg-surface-page">
        {sidebarOpen && (
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            'group fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-all duration-300 ease-spring lg:relative lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            isCollapsed ? 'w-56 lg:w-[88px]' : 'w-[280px]',
          )}
        >
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="absolute -right-3 top-20 z-20 hidden h-7 w-7 items-center justify-center rounded-full border border-border-default bg-white text-text-muted shadow-sm transition-all hover:bg-[hsl(var(--sidebar-accent))] hover:text-primary lg:flex lg:opacity-0 lg:group-hover:opacity-100"
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            type="button"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>

          <div
            className={cn(
              'flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-5',
              isCollapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="font-ui truncate text-[1.08rem] font-bold tracking-[-0.02em] text-[#34322d]">Sistema Gerencial</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden text-slate-500 hover:bg-[hsl(var(--sidebar-accent))]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
            {navigationSections.map((section, sectionIndex) => {
              const open = isCollapsed ? true : (expandedSections[section.title] ?? true);

              return (
                <section
                  key={section.title}
                  className={cn('space-y-1', sectionIndex > 0 && 'mt-4')}
                >
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [section.title]: !open,
                        }))
                      }
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a1a19]">{section.title}</span>
                      <ChevronRight className={cn('h-3.5 w-3.5 text-[#858481] transition-transform', open && 'rotate-90')} />
                    </button>
                  )}

                  {open && section.items.map((item) => {
                    const active = isPathActive(location.pathname, item.href);
                    const link = (
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'relative flex items-center rounded-xl border transition-all duration-150',
                          isCollapsed ? 'mx-auto h-11 w-11 justify-center px-0' : 'gap-3 px-3 py-[11px]',
                          active
                            ? 'border-[hsl(var(--primary)/0.16)] bg-[hsl(var(--primary)/0.1)] text-primary shadow-sm'
                            : 'border-transparent text-[#34322d] hover:border-[hsl(var(--sidebar-border))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[#1a1a19]',
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            active ? 'text-primary' : 'text-[#858481]',
                          )}
                        />

                        {!isCollapsed && (
                          <span className={cn('font-ui flex-1 truncate text-[13px]', active ? 'font-semibold' : 'font-medium')}>{item.name}</span>
                        )}

                        {!isCollapsed && active ? <div className="h-2 w-2 rounded-full bg-primary" /> : null}
                      </Link>
                    );

                    if (!isCollapsed) {
                      return <div key={`${section.title}-${item.name}`}>{link}</div>;
                    }

                    return (
                      <Tooltip key={`${section.title}-${item.name}`}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={10}
                          className="border border-border-default bg-white text-text-primary shadow-card"
                        >
                          <span className="font-ui text-xs font-semibold">{item.name}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </section>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[hsl(var(--sidebar-border))] bg-white px-4 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-space-9 w-space-9 text-text-secondary hover:bg-[hsl(var(--sidebar-accent))] lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-space-5 w-space-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <div
                id="header-subtitle"
                className="mt-0.5 truncate text-[0.82rem] font-normal leading-tight text-[#858481] empty:hidden"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div id="header-actions" className="flex items-center gap-space-2 shrink-0" />

              {isAuthLoading ? (
                <div className="hidden h-9 w-28 rounded-xl border border-border-default bg-white sm:block" />
              ) : session ? (
                <>
                  {canInviteUsers && !isPlanningRoute ? <InviteUserDialog /> : null}
                  <div className="hidden max-w-[240px] items-center gap-2 rounded-full border border-border-default bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs text-slate-600 md:flex">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate font-medium">{session.user.email || 'Sessao autenticada'}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSigningOut}
                    onClick={() => void handleSignOut()}
                    className="h-9 border-border-default bg-white text-slate-700 hover:bg-[hsl(var(--secondary))]"
                  >
                    <LogOut className="h-4 w-4" />
                    {isSigningOut ? 'Saindo...' : 'Sair'}
                  </Button>
                </>
              ) : null}
            </div>
          </header>

          <main
            className={cn(
              'flex-1 overflow-y-auto scrollbar-thin app-bg-soft',
              isConsultor ? 'p-0' : 'p-4 lg:p-8',
            )}
          >
            <div className={isConsultor ? 'h-full w-full' : 'max-w-[1600px] mx-auto'}>{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

