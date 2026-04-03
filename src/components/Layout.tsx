import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDownRight,
  Banknote,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSearch,
  FileStack,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Receipt,
  ScanSearch,
  ShieldAlert,
  Wand2,
  X,
} from 'lucide-react';

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
    title: 'Orcamentario',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Atividades', href: '/atividades', icon: FileText },
      { name: 'Descentralizacoes', href: '/descentralizacoes', icon: ArrowDownRight },
      { name: 'Empenhos', href: '/empenhos', icon: Receipt },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { name: 'Liquidacoes', href: '/liquidacoes-pagamentos', icon: Banknote },
      { name: 'Financeiro', href: '/financeiro', icon: ClipboardList },
      { name: 'LC', href: '/lc', icon: ClipboardList },
      { name: 'Retencoes EFD-Reinf', href: '/retencoes-efd-reinf', icon: ShieldAlert },
      { name: 'Rastreabilidade de PFs', href: '/rastreabilidade-pfs', icon: ClipboardList },
      { name: 'Conciliacao de PFs', href: '/conciliacao-pfs', icon: ScanSearch },
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
      { name: 'Editor de Documentos (IA)', href: '/editor-documentos', icon: Bot },
      { name: 'Consultor Juridico IA', href: '/consultor', icon: MessageSquare },
      { name: 'Espelho SUAP', href: '/suap', icon: FileSearch },
    ],
  },
];

const navigation = navigationSections.flatMap((section) => section.items);
const initialSectionState = navigationSections.reduce<Record<string, boolean>>((acc, section) => {
  acc[section.title] = true;
  return acc;
}, {});

function isPathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(initialSectionState);

  const isConsultor = location.pathname === '/consultor';

  const activeItem = useMemo(
    () => navigation.find((item) => isPathActive(location.pathname, item.href)),
    [location.pathname],
  );

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

  return (
    <TooltipProvider delayDuration={80}>
      <div className="min-h-screen bg-surface-page flex">
        {sidebarOpen && (
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 border-r border-slate-200 bg-white text-slate-600 shadow-lifted transition-all duration-300 ease-spring lg:relative lg:translate-x-0 group',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            isCollapsed ? 'w-56 lg:w-[84px]' : 'w-[248px]',
          )}
        >
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="absolute -right-3 top-20 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-border-default bg-surface-card text-text-muted shadow-soft transition-all hover:bg-surface-subtle hover:text-text-primary lg:flex lg:opacity-0 lg:group-hover:opacity-100"
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            type="button"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>

          <div
            className={cn(
              'flex h-16 items-center border-b border-slate-200 px-4 bg-white',
              isCollapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="font-ui text-sm font-semibold tracking-tight text-text-primary truncate">Sistema Gerencial</p>
                <p className="label-eyebrow mt-0.5">Controle Orcamentario</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden text-slate-500 hover:bg-slate-100"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-2.5 py-3 scrollbar-thin bg-white">
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
                      className="w-full rounded-lg px-2 py-2 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="label-eyebrow text-slate-400/95">{section.title}</span>
                      <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-90')} />
                    </button>
                  )}

                  {open && section.items.map((item) => {
                    const active = isPathActive(location.pathname, item.href);
                    const link = (
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'relative flex items-center rounded-xl transition-all duration-150',
                          isCollapsed ? 'h-11 w-11 justify-center mx-auto' : 'px-3 py-[9px] gap-3',
                          active
                            ? 'bg-[#2f67d8] text-white shadow-[0_8px_16px_rgba(47,103,216,0.28)]'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            active ? 'text-white' : 'text-slate-400',
                          )}
                        />

                        {!isCollapsed && (
                          <span className={cn('font-ui text-[13px] truncate flex-1', active ? 'font-semibold' : 'font-medium')}>{item.name}</span>
                        )}

                        {!isCollapsed && active ? <ChevronRight className="h-3.5 w-3.5 text-white/80" /> : null}
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
                          className="border border-border-default bg-surface-card text-text-primary shadow-card"
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
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 glass px-4 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-text-secondary h-space-9 w-space-9"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-space-5 w-space-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="font-ui text-[15px] font-semibold tracking-tight text-text-primary truncate">
                {activeItem?.name || 'Sistema Gerencial'}
              </h1>
              <div
                id="header-subtitle"
                className="font-ui text-[12px] text-text-muted font-medium leading-tight mt-0.5 truncate empty:hidden"
              />
            </div>

            <div id="header-actions" className="flex items-center gap-space-2 shrink-0" />
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

