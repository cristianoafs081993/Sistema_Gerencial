import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  ScanSearch
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

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Atividades', href: '/atividades', icon: FileText },
  { name: 'Descentralizações', href: '/descentralizacoes', icon: ArrowDownRight },
  { name: 'Empenhos', href: '/empenhos', icon: Receipt },
  { name: 'Contratos', href: '/contratos', icon: FileStack },
  { name: 'Liquidações', href: '/liquidacoes-pagamentos', icon: Banknote },
  { name: 'Rastreabilidade de PFs', href: '/rastreabilidade-pfs', icon: ClipboardList },
  { name: 'Conciliação de PFs', href: '/conciliacao-pfs', icon: ScanSearch },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background-light flex">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 group",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            isCollapsed ? "lg:w-20" : "lg:w-64",
            !isCollapsed && "w-64"
          )}
        >
          {/* Floating Toggle Button (Desktop) - Displays on Hover */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "absolute -right-3 top-20 z-50 hidden h-6 w-6 lg:flex items-center justify-center rounded-full border border-sidebar-border bg-background shadow-sm hover:bg-sidebar-accent transition-all duration-300 opacity-0 group-hover:opacity-100",
              isCollapsed && "rotate-0",
              !isCollapsed && "rotate-0"
            )}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
            )}
          </button>

          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border/50 transition-all duration-300 px-4",
            isCollapsed ? "justify-center" : "justify-between px-6"
          )}>
            {!isCollapsed && (
              <span className="text-xl font-bold tracking-tight text-sidebar-foreground truncate animate-fade-in">
                Sistema Gerencial
              </span>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex flex-col gap-1.5 p-3 mt-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const content = (
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative overflow-hidden",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/10"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-95",
                    isCollapsed && "justify-center px-0 h-11 w-11 mx-auto"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 shrink-0 transition-all duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110 group-hover:rotate-3"
                  )} />

                  {!isCollapsed && (
                    <span className={cn(
                      "truncate transition-all duration-300 flex-1",
                      isActive ? "translate-x-1" : "group-hover:translate-x-1"
                    )}>
                      {item.name}
                    </span>
                  )}

                  {isActive && !isCollapsed && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {content}
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={15} className="bg-sidebar-primary text-sidebar-primary-foreground border-none font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.name}>{content}</div>;
            })}
          </nav>

          {/* User profile section at bottom could go here */}
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-8 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">
                {navigation.find((n) => n.href === location.pathname)?.name || 'Sistema'}
              </h1>
              <div id="header-subtitle" className="text-xs text-muted-foreground/80 font-medium"></div>
            </div>
            <div id="header-actions" className="flex items-center gap-3"></div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-8 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
