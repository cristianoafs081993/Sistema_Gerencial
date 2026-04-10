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
  FileSearch,
  SearchCheck,
  ChartColumnIncreasing
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { atasModuleConfig } from '@/lib/atas-config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard',            href: '/',                      icon: LayoutDashboard },
  { name: 'Atividades',           href: '/atividades',            icon: FileText },
  { name: 'Descentralizações',    href: '/descentralizacoes',     icon: ArrowDownRight },
  { name: 'Empenhos',             href: '/empenhos',              icon: Receipt },
  { name: 'Contratos',            href: '/contratos',             icon: FileStack },
  { name: 'Liquidações',          href: '/liquidacoes-pagamentos',icon: Banknote },
  { name: 'Rastreabilidade de PFs', href: '/rastreabilidade-pfs', icon: ClipboardList },
  { name: 'Conciliação de PFs',   href: '/conciliacao-pfs',       icon: ScanSearch },
  { name: 'Gerador de Documentos', href: '/gerador-documentos',   icon: Wand2 },
  ...(atasModuleConfig.enabled
    ? [
        { name: 'Atas para Adesao', href: '/atas/adesao', icon: FileSearch },
        { name: 'Atas para Pesquisa', href: '/atas/pesquisa-precos', icon: SearchCheck },
        { name: 'Observabilidade de Atas', href: '/atas/observabilidade', icon: ChartColumnIncreasing },
      ]
    : []),
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [isCollapsed, setIsCollapsed]     = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background flex">

        {/* ── Mobile backdrop — Overlay correto com blur (Conceito 11) ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ══════════════════════════════════════════
            SIDEBAR
            Conceito 3 — Espaçamento 8pt grid
            Conceito 10 — Micro-interações suaves
        ══════════════════════════════════════════ */}
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
          {/* Toggle flutuante — Affordance clara (Conceito 1) */}
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

          {/* ── Logo header ── */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border/60 transition-all duration-300",
            isCollapsed ? "justify-center px-4" : "justify-between px-5"
          )}>
            {!isCollapsed && (
              <div className="flex flex-col gap-0 overflow-hidden">
                {/* Hierarquia visual — nome principal + tagline (Conceito 2) */}
                <span className="text-[15px] font-bold tracking-tight text-sidebar-foreground truncate">
                  Sistema Gerencial
                </span>
                <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                  Controle Orçamentário
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

          {/* ── Navigation ── */}
          <nav className="flex flex-col gap-0.5 p-3 mt-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;

              const content = (
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    // Affordance: parece clicável, responde ao toque (Conceito 1 e 10)
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
                  {/* Indicador lateral do item ativo — Hierarquia Visual (Conceito 2) */}
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
                  <Tooltip key={item.name}>
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

              return <div key={item.name}>{content}</div>;
            })}
          </nav>
        </aside>

        {/* ══════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── TOP BAR ──
              Conceito 2 — Hierarquia visual: título h1 + subtítulo descritivo
              Conceito 7 — Sombra suave (não borda dura)
              Conceito 5 — glass morphism sutil para integrar ao background */}
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

            {/* Título da página + subtítulo (Visual Hierarchy — Conceito 2) */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <h1 className="text-text-sm font-font-bold text-text-primary leading-none tracking-tight truncate">
                {navigation.find((n) => n.href === location.pathname)?.name || 'Sistema'}
              </h1>
              {/* Portal de subtítulo injetado pelas páginas */}
              <div
                id="header-subtitle"
                className="text-text-xs text-text-muted font-font-medium leading-tight mt-space-1 truncate empty:hidden"
              />
            </div>

            {/* Portal de ações injetadas pelas páginas */}
            <div id="header-actions" className="flex items-center gap-space-2 shrink-0" />
          </header>

          {/* ── Page content —— AnimatePresence com page transition (Framer Motion) */}
          <main className="flex-1 p-4 lg:p-8 overflow-y-auto scrollbar-thin dot-pattern bg-surface-page">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>

      </div>
    </TooltipProvider>
  );
}
