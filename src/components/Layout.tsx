import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { slideInRight } from '@/lib/animations';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Menu,
  X,
  ChevronRight,
  Banknote,
  ArrowDownRight,
  ChevronLeft,
  FileStack,
  ClipboardList,
  ScanSearch,
  Wand2,
  Bot,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      { name: 'Rastreabilidade de PFs', href: '/rastreabilidade-pfs', icon: ClipboardList },
      { name: 'Conciliacao de PFs', href: '/conciliacao-pfs', icon: ScanSearch },
    ],
  },
  {
    title: 'Contratos',
    items: [
      { name: 'Contratos', href: '/contratos', icon: FileStack },
    ],
  },
  {
    title: 'Documentos',
    items: [
      { name: 'Gerador de Documentos', href: '/gerador-documentos', icon: Wand2 },
      { name: 'Editor de Documentos (IA)', href: '/editor-documentos', icon: Bot },
      { name: 'Consultor Juridico IA', href: '/consultor', icon: MessageSquare },
    ],
  },
];

const navigation = navigationSections.flatMap((section) => section.items);
const defaultSectionsState = navigationSections.reduce<Record<string, boolean>>((acc, section) => {
  acc[section.title] = true;
  return acc;
}, {});

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [isCollapsed, setIsCollapsed]     = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(defaultSectionsState);
  const location = useLocation();
  const isConsultor = location.pathname === '/consultor';

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  useEffect(() => {
    const sectionAtiva = navigationSections.find((section) =>
      section.items.some((item) => item.href === location.pathname),
    );
    if (!sectionAtiva) return;
    setExpandedSections((prev) => ({ ...prev, [sectionAtiva.title]: true }));
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background flex">

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Mobile backdrop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Overlay correto com blur (Conceito 11) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
            SIDEBAR
            Conceito 3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â EspaÃƒÆ’Ã‚Â§amento 8pt grid
            Conceito 10 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Micro-interaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes suaves
        ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50",
            "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
            "shadow-lifted transform transition-all duration-300 ease-spring",
            "lg:relative lg:translate-x-0 group",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            isCollapsed ? "lg:w-[72px]" : "lg:w-64",
            !isCollapsed && "w-64"
          )}
        >
          {/* Toggle flutuante ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Affordance clara (Conceito 1) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "absolute -right-space-3 top-space-20 z-50 hidden h-space-6 w-space-6",
              "lg:flex items-center justify-center rounded-radius-full",
              "border border-border-default bg-surface-card shadow-shadow-sm",
              "hover:bg-surface-subtle hover:shadow-shadow-md",
              "transition-all duration-200 opacity-0 group-hover:opacity-100",
            )}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-space-3 w-space-3 text-text-muted" />
            ) : (
              <ChevronLeft className="h-space-3 w-space-3 text-text-muted" />
            )}
          </button>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Logo header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border/60 transition-all duration-300",
            isCollapsed ? "justify-center px-4" : "justify-between px-5"
          )}>
            {!isCollapsed && (
              <div className="flex flex-col gap-0 overflow-hidden">
                {/* Hierarquia visual ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nome principal + tagline (Conceito 2) */}
                <span className="text-[15px] font-bold tracking-tight text-sidebar-foreground truncate">
                  Sistema Gerencial
                </span>
                <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                  Controle Orcamentario
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Navigation ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <nav className="flex flex-col gap-2 p-3 mt-2 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => {
              const isSectionOpen = isCollapsed ? true : (expandedSections[section.title] ?? true);

              return (
                <div
                  key={section.title}
                  className={cn(
                    "space-y-1",
                    sectionIndex > 0 && "pt-2 mt-1",
                    isCollapsed && "space-y-0.5",
                  )}
                >
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [section.title]: !isSectionOpen,
                        }))
                      }
                      className="w-full px-3 pb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/45 hover:text-sidebar-foreground/70 transition-colors"
                    >
                      <span>{section.title}</span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isSectionOpen && "rotate-90",
                        )}
                      />
                    </button>
                  )}

                  {isSectionOpen && section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const content = (
                      <Link
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium",
                          "transition-all duration-150 select-none relative overflow-hidden",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-primary"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.98]",
                          isCollapsed
                            ? "justify-center px-0 h-11 w-11 mx-auto"
                            : "px-3"
                        )}
                      >
                        {isActive && !isCollapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white/50 rounded-r-full" />
                        )}

                        <item.icon className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                          isActive ? "opacity-100" : "opacity-55 group-hover:opacity-100"
                        )} />

                        {!isCollapsed && (
                          <span className="truncate flex-1 transition-all duration-200">
                            {item.name}
                          </span>
                        )}

                        {isActive && !isCollapsed && (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50 shrink-0" />
                        )}
                      </Link>
                    );

                    if (isCollapsed) {
                      return (
                        <Tooltip key={`${section.title}-${item.name}`}>
                          <TooltipTrigger asChild>{content}</TooltipTrigger>
                          <TooltipContent
                            side="right"
                            sideOffset={12}
                            className="bg-primary text-primary-foreground border-none font-semibold text-xs shadow-primary"
                          >
                            {item.name}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return <div key={`${section.title}-${item.name}`}>{content}</div>;
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
            MAIN CONTENT
        ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ TOP BAR ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
              Conceito 2 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Hierarquia visual: tÃƒÆ’Ã‚Â­tulo h1 + subtÃƒÆ’Ã‚Â­tulo descritivo
              Conceito 7 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Sombra suave (nÃƒÆ’Ã‚Â£o borda dura)
              Conceito 5 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â glass morphism sutil para integrar ao background */}
          <header className={cn(
            "sticky top-0 z-30 flex h-16 items-center gap-4 shrink-0",
            "border-b border-white/10 glass",
            "px-4 lg:px-8",
            "transition-shadow duration-200",
          )}>
            {/* Mobile menu */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-text-secondary h-space-9 w-space-9"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-space-5 w-space-5" />
            </Button>

            {/* TÃƒÆ’Ã‚Â­tulo da pÃƒÆ’Ã‚Â¡gina + subtÃƒÆ’Ã‚Â­tulo (Visual Hierarchy ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Conceito 2) */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <h1 className="text-text-sm font-font-bold text-text-primary leading-none tracking-tight truncate">
                {navigation.find((n) => n.href === location.pathname)?.name || 'Sistema'}
              </h1>
              {/* Portal de subtÃƒÆ’Ã‚Â­tulo injetado pelas pÃƒÆ’Ã‚Â¡ginas */}
              <div
                id="header-subtitle"
                className="text-text-xs text-text-muted font-font-medium leading-tight mt-space-1 truncate empty:hidden"
              />
            </div>

            {/* Portal de aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes injetadas pelas pÃƒÆ’Ã‚Â¡ginas */}
            <div id="header-actions" className="flex items-center gap-space-2 shrink-0" />
          </header>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Page content ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â AnimatePresence com page transition (Framer Motion) */}
          <main className={cn(
            "flex-1 overflow-y-auto scrollbar-thin dot-pattern bg-surface-page",
            isConsultor ? "p-0" : "p-4 lg:p-8"
          )}>
            <div className={isConsultor ? "h-full w-full" : "max-w-[1600px] mx-auto"}>
              {children}
            </div>
          </main>
        </div>

      </div>
    </TooltipProvider>
  );
}
