import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';

import { appScreenGroups, appScreens } from '@/lib/appScreens';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Título da página. Se omitido, usa o nome da tela registrada em `appScreens` para a rota atual. */
  title?: ReactNode;
  /** Rótulo acima do título. Se omitido, usa o nome do grupo da tela (ex.: "Orçamentário"). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Ações principais da página (botões), alinhadas à direita no desktop. */
  actions?: ReactNode;
  /** Barra secundária abaixo do título (abas, filtros rápidos, chips). */
  toolbar?: ReactNode;
  /**
   * Modo compacto: sem eyebrow, título visível nem descrição. Exibe só a barra secundária
   * (`toolbar`) e as `actions` na mesma linha. O título continua no DOM (sr-only) para acessibilidade.
   */
  compact?: boolean;
  className?: string;
}

export function findScreenForPath(pathname: string) {
  return appScreens
    .filter((screen) => screen.path === pathname || (screen.path !== '/' && pathname.startsWith(`${screen.path}/`)))
    .sort((left, right) => right.path.length - left.path.length)[0];
}

/**
 * Cabeçalho padrão de página (Paretto Institucional): eyebrow do módulo, título,
 * descrição curta e ações à direita. Mantém todas as telas com a mesma hierarquia.
 */
type PageHeaderRegistry = { register: () => () => void };

const PageHeaderRegistryContext = createContext<PageHeaderRegistry | null>(null);

/**
 * Usado pelo Layout: informa se a página atual declarou o próprio PageHeader.
 * Quando não declarou, o Layout exibe o cabeçalho automático (módulo + título da rota).
 */
export function usePageHeaderRegistry() {
  const [count, setCount] = useState(0);
  const [registry] = useState<PageHeaderRegistry>(() => ({
    register: () => {
      setCount((value) => value + 1);
      return () => setCount((value) => value - 1);
    },
  }));
  return { hasPageHeader: count > 0, registry, Provider: PageHeaderRegistryContext.Provider };
}

export function PageHeader(props: PageHeaderProps) {
  const inRouter = useInRouterContext();
  const registry = useContext(PageHeaderRegistryContext);
  useLayoutEffect(() => registry?.register(), [registry]);
  return inRouter ? <RoutedPageHeader {...props} /> : <PageHeaderView {...props} />;
}

function RoutedPageHeader(props: PageHeaderProps) {
  const { pathname } = useLocation();
  return <PageHeaderView {...props} pathname={pathname} />;
}

function PageHeaderView({
  title,
  eyebrow,
  description,
  actions,
  toolbar,
  compact,
  className,
  pathname,
}: PageHeaderProps & { pathname?: string }) {
  const screen = pathname ? findScreenForPath(pathname) : undefined;
  const group = screen ? appScreenGroups.find((item) => item.id === screen.groupId) : undefined;
  const resolvedTitle = title ?? screen?.name;
  const resolvedEyebrow = eyebrow ?? group?.name;

  if (compact) {
    if (!toolbar && !actions) {
      return resolvedTitle ? <h1 className="sr-only">{resolvedTitle}</h1> : null;
    }
    return (
      <header
        className={cn('mb-6 flex flex-wrap items-center justify-between gap-3', className)}
        data-testid="page-header"
      >
        {resolvedTitle ? <h1 className="sr-only">{resolvedTitle}</h1> : null}
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    );
  }

  return (
    <header className={cn('mb-6 space-y-4', className)} data-testid="page-header">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1.5">
          {resolvedEyebrow ? <p className="label-eyebrow m-0">{resolvedEyebrow}</p> : null}
          {resolvedTitle ? <h1 className="m-0 text-2xl md:text-[28px]">{resolvedTitle}</h1> : null}
          {description ? <p className="m-0 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
    </header>
  );
}

/** Grupos cujas telas não exibem título visível: o módulo já aparece na navegação e o topo da página fica para seletor de visão e filtros. */
const COMPACT_HEADER_GROUPS: string[] = ['orcamentario'];

/** Telas avulsas sem título visível: o conteúdo já se identifica (abas ou painel com título próprio). */
const COMPACT_HEADER_SCREENS: string[] = ['manutencao', 'refeitorio-insumos'];

/** Cabeçalho automático do Layout para telas que não declaram `PageHeader` próprio. */
export function AutoPageHeader() {
  const { pathname } = useLocation();
  const screen = findScreenForPath(pathname);
  if (!screen) return null;
  if (COMPACT_HEADER_GROUPS.includes(screen.groupId) || COMPACT_HEADER_SCREENS.includes(screen.id)) {
    return <h1 className="sr-only">{screen.name}</h1>;
  }
  return <PageHeaderView pathname={pathname} />;
}
