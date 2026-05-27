import type { ComponentType } from 'react';
import {
  ArrowDownRight,
  Banknote,
  Bot,
  ClipboardList,
  Clock3,
  FileStack,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Receipt,
  ScanSearch,
  ShieldAlert,
  UserCog,
  Wand2,
} from 'lucide-react';

export type AppScreenGroupId =
  | 'orcamentario'
  | 'financeiro'
  | 'contratos'
  | 'licitacoes'
  | 'documentos'
  | 'automacoes'
  | 'administracao';

export type AppScreenGroup = {
  id: AppScreenGroupId;
  name: string;
  sortOrder: number;
};

export type AppScreen = {
  id: string;
  groupId: AppScreenGroupId;
  name: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  sortOrder: number;
  isAdminOnly?: boolean;
  hiddenFromNavigation?: boolean;
};

export const ADMIN_USERS_SCREEN_ID = 'controle-usuarios';

export const appScreenGroups: AppScreenGroup[] = [
  { id: 'orcamentario', name: 'Orçamentário', sortOrder: 10 },
  { id: 'financeiro', name: 'Financeiro', sortOrder: 20 },
  { id: 'contratos', name: 'Contratos', sortOrder: 30 },
  { id: 'licitacoes', name: 'Licitações', sortOrder: 35 },
  { id: 'documentos', name: 'Documentos', sortOrder: 40 },
  { id: 'automacoes', name: 'Automações', sortOrder: 50 },
  { id: 'administracao', name: 'Administração', sortOrder: 90 },
];

export const appScreens: AppScreen[] = [
  { id: 'dashboard', groupId: 'orcamentario', name: 'Dashboard', path: '/', icon: LayoutDashboard, sortOrder: 10 },
  { id: 'planejamento', groupId: 'orcamentario', name: 'Planejamento', path: '/planejamento', icon: FileText, sortOrder: 20 },
  { id: 'descentralizacoes', groupId: 'orcamentario', name: 'Descentralizações', path: '/descentralizacoes', icon: ArrowDownRight, sortOrder: 30 },
  { id: 'empenhos', groupId: 'orcamentario', name: 'Empenhos', path: '/empenhos', icon: Receipt, sortOrder: 40 },
  { id: 'liquidacoes-pagamentos', groupId: 'financeiro', name: 'Liquidações', path: '/liquidacoes-pagamentos', icon: Banknote, sortOrder: 10 },
  { id: 'financeiro', groupId: 'financeiro', name: 'Financeiro', path: '/financeiro', icon: ClipboardList, sortOrder: 20 },
  { id: 'lc', groupId: 'financeiro', name: 'Lista de Credores', path: '/lc', icon: ClipboardList, sortOrder: 30 },
  { id: 'retencoes-efd-reinf', groupId: 'financeiro', name: 'Retenções EFD-Reinf', path: '/retencoes-efd-reinf', icon: ShieldAlert, sortOrder: 40 },
  { id: 'rastreabilidade-pfs', groupId: 'financeiro', name: 'Rastreabilidade de PFs', path: '/rastreabilidade-pfs', icon: ClipboardList, sortOrder: 50 },
  { id: 'conciliacao-pfs', groupId: 'financeiro', name: 'Conciliação de PFs', path: '/conciliacao-pfs', icon: ScanSearch, sortOrder: 60 },
  { id: 'contratos', groupId: 'contratos', name: 'Contratos', path: '/contratos', icon: FileStack, sortOrder: 10 },
  { id: 'licitacoes-pregoes', groupId: 'licitacoes', name: 'Pregões por UASG', path: '/licitacoes-pregoes', icon: ScrollText, sortOrder: 10 },
  { id: 'atas-registro-precos', groupId: 'licitacoes', name: 'Atas e ARP', path: '/atas-registro-precos', icon: ClipboardList, sortOrder: 20 },
  { id: 'gerador-documentos', groupId: 'documentos', name: 'Gerador de Documentos', path: '/gerador-documentos', icon: Wand2, sortOrder: 10 },
  { id: 'editor-documentos', groupId: 'documentos', name: 'Editor de Documentos', path: '/editor-documentos', icon: Bot, sortOrder: 20 },
  { id: 'artefatos-licitacao', groupId: 'documentos', name: 'Artefatos de Licitação', path: '/artefatos-licitacao', icon: FileStack, sortOrder: 25 },
  { id: 'consultor', groupId: 'documentos', name: 'Consultor Jurídico', path: '/consultor', icon: MessageSquare, sortOrder: 30 },
  { id: 'suap', groupId: 'documentos', name: 'SUAP', path: '/suap', icon: FileStack, sortOrder: 40 },
  { id: 'economia-tempo', groupId: 'automacoes', name: 'Economia de Tempo', path: '/economia-tempo', icon: Clock3, sortOrder: 10 },
  {
    id: ADMIN_USERS_SCREEN_ID,
    groupId: 'administracao',
    name: 'Controle de usuários',
    path: '/controle-usuarios',
    icon: UserCog,
    sortOrder: 10,
    isAdminOnly: true,
  },
  {
    id: 'design-system-preview',
    groupId: 'administracao',
    name: 'Design System',
    path: '/design-system-preview',
    icon: ShieldAlert,
    sortOrder: 20,
    isAdminOnly: true,
    hiddenFromNavigation: true,
  },
  {
    id: 'modelos-documentos',
    groupId: 'administracao',
    name: 'Modelos de documentos',
    path: '/modelos-documentos',
    icon: FileText,
    sortOrder: 30,
    isAdminOnly: true,
  },
];

export function getScreenForPath(pathname: string) {
  if (pathname.startsWith('/planejamento') || pathname.startsWith('/atividades')) {
    return appScreens.find((screen) => screen.id === 'planejamento') || null;
  }

  return (
    appScreens.find((screen) => {
      if (screen.path === '/') return pathname === '/';
      return pathname === screen.path || pathname.startsWith(`${screen.path}/`);
    }) || null
  );
}

export function isProductionScreen(screen: AppScreen) {
  return !screen.isAdminOnly && !screen.hiddenFromNavigation;
}
