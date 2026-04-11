import { useState, type ComponentType } from 'react';
import RichTextEditor from '@/components/Editor/RichTextEditor';
import { StatCard } from '@/components/StatCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  ArrowDownRight,
  Banknote,
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  Eye,
  FileStack,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Receipt,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  Check,
  X,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

type TokenSwatch = {
  label: string;
  className: string;
  textClassName?: string;
};

type SidebarItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: string;
};

type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

type CoverageRow = {
  route: string;
  modulo: string;
  filtros: boolean;
  dados: boolean;
  overlays: boolean;
  upload: boolean;
  visualizacao: boolean;
  ia: boolean;
  status: 'Coberto' | 'Parcial';
};

const coreSwatches: TokenSwatch[] = [
  { label: 'surface-page', className: 'bg-surface-page' },
  { label: 'surface-card', className: 'bg-surface-card' },
  { label: 'surface-subtle', className: 'bg-surface-subtle' },
  { label: 'action-primary', className: 'bg-action-primary', textClassName: 'text-white' },
  { label: 'action-secondary', className: 'bg-action-secondary' },
  { label: 'status-success', className: 'bg-status-success', textClassName: 'text-white' },
  { label: 'status-warning', className: 'bg-status-warning', textClassName: 'text-white' },
  { label: 'status-error', className: 'bg-status-error', textClassName: 'text-white' },
];

const typographyScale = [
  {
    label: 'Display',
    className: "font-['Public_Sans'] text-[34px] leading-[1.1] font-bold tracking-[-0.02em]",
    sample: 'Painel de Governanca Orcamentaria',
  },
  {
    label: 'Heading',
    className: "font-['Public_Sans'] text-[24px] leading-[1.25] font-semibold",
    sample: 'Contratos, Empenhos e Liquidacoes',
  },
  {
    label: 'Body',
    className: "font-['Public_Sans'] text-[15px] leading-[1.6] font-normal text-text-secondary",
    sample: 'Fluxo claro para operacao diaria com rastreabilidade e menor carga cognitiva.',
  },
  {
    label: 'Meta',
    className: "font-['Public_Sans'] text-[11px] uppercase tracking-[0.12em] font-semibold text-text-muted",
    sample: 'PATRIMONIO PUBLICO DIGITAL',
  },
  {
    label: 'Data',
    className: "font-['IBM_Plex_Mono'] text-[14px] font-medium text-text-primary",
    sample: 'PROC 23035.000105.2024-42 | UG 158366',
  },
];

const sidebarGroups: SidebarGroup[] = [
  {
    title: 'Orcamentario',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'Planejamento', icon: FileText },
      { label: 'Descentralizacoes', icon: ArrowDownRight, badge: '3' },
      { label: 'Empenhos', icon: Receipt, active: true, badge: '12' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Liquidacoes', icon: Banknote },
      { label: 'Financeiro', icon: ClipboardList },
      { label: 'LC', icon: ClipboardList, badge: 'Novo' },
      { label: 'Conciliacao de PFs', icon: ScanSearch },
    ],
  },
  {
    title: 'Contratos',
    items: [{ label: 'Contratos', icon: FileStack }],
  },
  {
    title: 'Documentos',
    items: [
      { label: 'Gerador de Documentos', icon: Wand2 },
      { label: 'Editor de Documentos (IA)', icon: Bot },
      { label: 'Consultor Juridico IA', icon: MessageSquare },
    ],
  },
];

const railItems: SidebarItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Orcamento', icon: Gauge },
  { label: 'Empenhos', icon: Receipt, active: true },
  { label: 'Contratos', icon: FileStack },
  { label: 'Conformidade', icon: ShieldCheck },
];

const evolutionChartData = [
  { mes: 'Jan', planejado: 820000, empenhado: 640000, pago: 520000 },
  { mes: 'Fev', planejado: 980000, empenhado: 760000, pago: 610000 },
  { mes: 'Mar', planejado: 1140000, empenhado: 920000, pago: 700000 },
  { mes: 'Abr', planejado: 1230000, empenhado: 970000, pago: 760000 },
  { mes: 'Mai', planejado: 1320000, empenhado: 1080000, pago: 840000 },
  { mes: 'Jun', planejado: 1400000, empenhado: 1180000, pago: 930000 },
];

const evolutionChartConfig: ChartConfig = {
  planejado: { label: 'Planejado', color: '#3b82f6' },
  empenhado: { label: 'Empenhado', color: '#a855f7' },
  pago: { label: 'Pago', color: '#10b981' },
};

const distributionChartData = [
  { eixo: 'Ensino', custeio: 420000, investimento: 180000, bolsas: 120000 },
  { eixo: 'Pesquisa', custeio: 300000, investimento: 220000, bolsas: 140000 },
  { eixo: 'Extensao', custeio: 260000, investimento: 90000, bolsas: 110000 },
  { eixo: 'Gestao', custeio: 380000, investimento: 60000, bolsas: 40000 },
];

const distributionChartConfig: ChartConfig = {
  custeio: { label: 'Custeio', color: '#3b82f6' },
  investimento: { label: 'Investimento', color: '#10b981' },
  bolsas: { label: 'Bolsas', color: '#f59e0b' },
};

const descentralizacaoChartData = [
  { dimensao: 'Ensino', ted: 380000, proap: 160000, reitoria: 90000 },
  { dimensao: 'Pesquisa', ted: 280000, proap: 190000, reitoria: 65000 },
  { dimensao: 'Extensao', ted: 210000, proap: 120000, reitoria: 45000 },
  { dimensao: 'Gestao', ted: 330000, proap: 80000, reitoria: 30000 },
];

const descentralizacaoChartConfig: ChartConfig = {
  ted: { label: 'TED', color: '#6366f1' },
  proap: { label: 'PROAP', color: '#14b8a6' },
  reitoria: { label: 'Reitoria', color: '#f43f5e' },
};

const naturezaChartData = [
  { natureza: '339030', valor: 420000 },
  { natureza: '339039', valor: 350000 },
  { natureza: '449052', valor: 280000 },
  { natureza: '339018', valor: 220000 },
  { natureza: '339014', valor: 170000 },
];

const naturezaChartConfig: ChartConfig = {
  valor: { label: 'Valor empenhado', color: '#10b981' },
};

const coverageRows: CoverageRow[] = [
  { route: '/', modulo: 'Dashboard', filtros: true, dados: true, overlays: true, upload: false, visualizacao: true, ia: false, status: 'Coberto' },
  { route: '/planejamento/campus', modulo: 'Planejamento', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/descentralizacoes', modulo: 'Descentralizacoes', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/empenhos', modulo: 'Empenhos', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/contratos', modulo: 'Contratos', filtros: true, dados: true, overlays: true, upload: false, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/liquidacoes-pagamentos', modulo: 'Liquidacoes', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/financeiro', modulo: 'Financeiro', filtros: true, dados: true, overlays: true, upload: true, visualizacao: true, ia: false, status: 'Coberto' },
  { route: '/lc', modulo: 'LC', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/retencoes-efd-reinf', modulo: 'Retencoes EFD-Reinf', filtros: true, dados: true, overlays: false, upload: true, visualizacao: true, ia: false, status: 'Coberto' },
  { route: '/rastreabilidade-pfs', modulo: 'Rastreabilidade PFs', filtros: true, dados: true, overlays: true, upload: true, visualizacao: false, ia: false, status: 'Coberto' },
  { route: '/conciliacao-pfs', modulo: 'Conciliacao PFs', filtros: true, dados: true, overlays: true, upload: true, visualizacao: true, ia: false, status: 'Coberto' },
  { route: '/gerador-documentos', modulo: 'Gerador de Documentos', filtros: true, dados: true, overlays: true, upload: true, visualizacao: true, ia: false, status: 'Coberto' },
  { route: '/editor-documentos', modulo: 'Editor (IA)', filtros: false, dados: false, overlays: true, upload: false, visualizacao: false, ia: true, status: 'Coberto' },
  { route: '/consultor', modulo: 'Consultor Juridico IA', filtros: false, dados: false, overlays: false, upload: true, visualizacao: false, ia: true, status: 'Coberto' },
];

function Swatch({ token }: { token: TokenSwatch }) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'h-11 rounded-radius-md border border-border-default flex items-center px-3 text-xs font-semibold',
          token.className,
          token.textClassName || 'text-text-primary',
        )}
      >
        {token.label}
      </div>
    </div>
  );
}

function CoverageMark({ ok }: { ok: boolean }) {
  return ok ? <Check className="h-4 w-4 text-status-success mx-auto" /> : <X className="h-4 w-4 text-text-muted mx-auto" />;
}

function OverlayAndContextConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">
        Overlays e contexto
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">Modal de Detalhes</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do registro</DialogTitle>
              <DialogDescription>
                Exemplo de modal para edicao/auditoria com foco e teclado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Input defaultValue="Amanda Sofia Santos Medeiros" />
              <Input defaultValue="126.729.284-95" />
            </div>
            <DialogFooter>
              <Button variant="outline">Cancelar</Button>
              <Button>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">Drawer de Filtros</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtros avancados</SheetTitle>
              <SheetDescription>Padrao para telas com filtros extensos.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              <Input placeholder="Fonte" />
              <Input placeholder="Vinculacao" />
              <Input placeholder="UG" />
            </div>
            <SheetFooter className="mt-4">
              <Button variant="outline">Limpar</Button>
              <Button>Aplicar</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Confirmacao Critica</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir processamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa acao remove os resultados e exige nova importacao.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction>Confirmar exclusao</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">Menu de Acoes</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acoes do registro</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Visualizar detalhes</DropdownMenuItem>
            <DropdownMenuItem>Gerar macro SIAFI</DropdownMenuItem>
            <DropdownMenuItem>Marcar como conferido</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">Popover Informativo</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <p className="font-['Public_Sans'] text-sm font-semibold">Resumo rapido</p>
            <p className="font-['Public_Sans'] text-xs text-text-secondary mt-1">
              12 pendencias ativas, 3 criticas e 2 bloqueando geracao de macro.
            </p>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Hover Hint
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Use para explicar campos sensiveis sem poluir a tabela.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function DashboardChartsConcept() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="md:col-span-2 border-border-default/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-['Public_Sans'] text-base">Evolucao da Execucao</CardTitle>
            <p className="font-['Public_Sans'] text-xs text-text-muted">Acumulado de planejado, empenhado e pago</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={evolutionChartConfig} className="h-[260px] w-full">
              <AreaChart data={evolutionChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ds-planejado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-planejado)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-planejado)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ds-empenhado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-empenhado)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-empenhado)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ds-pago" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-pago)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-pago)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={30} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="planejado" stroke="var(--color-planejado)" fillOpacity={1} fill="url(#ds-planejado)" />
                <Area type="monotone" dataKey="empenhado" stroke="var(--color-empenhado)" fillOpacity={1} fill="url(#ds-empenhado)" />
                <Area type="monotone" dataKey="pago" stroke="var(--color-pago)" fillOpacity={1} fill="url(#ds-pago)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border-default/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-['Public_Sans'] text-base">Funil de Execucao</CardTitle>
            <p className="font-['Public_Sans'] text-xs text-text-muted">Conversao por etapa financeira</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-radius-md px-3 py-2 bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-sm">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/80">Planejado</p>
              <p className="font-['Public_Sans'] font-bold">R$ 1.400.000</p>
            </div>
            <div className="rounded-radius-md px-3 py-2 bg-gradient-to-r from-[#7e22ce] to-[#a855f7] text-white shadow-sm w-[92%] ml-auto">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/80">Empenhado</p>
              <p className="font-['Public_Sans'] font-bold">R$ 1.180.000</p>
            </div>
            <div className="rounded-radius-md px-3 py-2 bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white shadow-sm w-[84%] ml-auto">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/80">Liquidado</p>
              <p className="font-['Public_Sans'] font-bold">R$ 930.000</p>
            </div>
            <div className="rounded-radius-md px-3 py-2 bg-gradient-to-r from-[#059669] to-[#10b981] text-white shadow-sm w-[76%] ml-auto">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/80">Pago</p>
              <p className="font-['Public_Sans'] font-bold">R$ 840.000</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border-default/80 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-['Public_Sans'] text-base">Distribuicao do Orcamento</CardTitle>
          <p className="font-['Public_Sans'] text-xs text-text-muted">Composicao por eixo e componente funcional</p>
        </CardHeader>
        <CardContent>
          <ChartContainer config={distributionChartConfig} className="h-[300px] w-full">
            <BarChart data={distributionChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="eixo" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={30} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="custeio" stackId="a" fill="var(--color-custeio)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="investimento" stackId="a" fill="var(--color-investimento)" />
              <Bar dataKey="bolsas" stackId="a" fill="var(--color-bolsas)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-border-default/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-['Public_Sans'] text-base">Descentralizacoes</CardTitle>
            <p className="font-['Public_Sans'] text-xs text-text-muted">Volume distribuido por dimensao</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={descentralizacaoChartConfig} className="h-[280px] w-full">
              <BarChart data={descentralizacaoChartData} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid horizontal vertical={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                <YAxis dataKey="dimensao" type="category" tickLine={false} axisLine={false} width={82} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="ted" stackId="a" fill="var(--color-ted)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="proap" stackId="a" fill="var(--color-proap)" />
                <Bar dataKey="reitoria" stackId="a" fill="var(--color-reitoria)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border-default/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-['Public_Sans'] text-base">Top Naturezas</CardTitle>
            <p className="font-['Public_Sans'] text-xs text-text-muted">Valor empenhado por natureza de despesa</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={naturezaChartConfig} className="h-[280px] w-full">
              <BarChart data={naturezaChartData} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid horizontal vertical={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                <YAxis dataKey="natureza" type="category" tickLine={false} axisLine={false} width={74} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="valor" fill="var(--color-valor)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardChartSkeletonConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">
        Skeletons de graficos
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 rounded-radius-md border border-border-default p-3 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[220px] w-full" />
        </div>
        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[190px] w-full" />
        </div>
        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-[190px] w-full" />
        </div>
      </div>
    </div>
  );
}

function UploadFlowConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">Upload pipeline</p>

      <div className="rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/40 p-4 text-center">
        <Upload className="h-5 w-5 mx-auto text-text-muted" />
        <p className="font-['Public_Sans'] text-sm font-semibold text-text-primary mt-2">Arraste CSV/PDF ou clique para enviar</p>
        <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">Padrao unificado para LC, Financeiro, Descentralizacoes e documentos.</p>
        <Button size="sm" className="mt-3">Selecionar arquivo</Button>
      </div>

      <div className="rounded-radius-md border border-border-default p-3">
        <div className="flex items-center justify-between">
          <p className="font-['Public_Sans'] text-sm font-semibold">Processando `Documento (12).pdf`</p>
          <Badge className="bg-status-warning text-white border-0">Em analise</Badge>
        </div>
        <Progress value={54} className="mt-2 h-2" />
        <p className="font-['Public_Sans'] text-xs text-text-muted mt-2">54% concluido • extraindo CPF e conta bancaria</p>
      </div>
    </div>
  );
}

function FinanceiroConciliacaoConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">
        Financeiro e Conciliacao PFs
      </p>

      <Tabs defaultValue="financeiro">
        <TabsList className="h-9">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliacao PFs</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-border-default/80">
              <CardContent className="pt-4">
                <p className="font-['Public_Sans'] text-xs text-text-muted">Disponivel</p>
                <p className="font-['Public_Sans'] text-lg font-semibold text-action-primary mt-1">R$ 24.416,07</p>
              </CardContent>
            </Card>
            <Card className="border-border-default/80">
              <CardContent className="pt-4">
                <p className="font-['Public_Sans'] text-xs text-text-muted">Fonte</p>
                <p className="font-['IBM_Plex_Mono'] text-sm font-medium text-text-primary mt-1">1050000219</p>
              </CardContent>
            </Card>
            <Card className="border-border-default/80">
              <CardContent className="pt-4">
                <p className="font-['Public_Sans'] text-xs text-text-muted">Vinculacao</p>
                <p className="font-['IBM_Plex_Mono'] text-sm font-medium text-text-primary mt-1">400 / 410</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload CSV Financeiro
            </Button>
            <Button size="sm" variant="outline">Atualizar saldos</Button>
          </div>
        </TabsContent>

        <TabsContent value="conciliacao" className="mt-3 space-y-3">
          <div className="border border-border-default rounded-radius-md overflow-hidden">
            <Table>
              <TableHeader className="bg-surface-subtle/70">
                <TableRow>
                  <TableHead className="font-['Public_Sans']">CPF</TableHead>
                  <TableHead className="font-['Public_Sans']">Status</TableHead>
                  <TableHead className="font-['Public_Sans']">Origem</TableHead>
                  <TableHead className="text-right font-['Public_Sans']">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="row-hover">
                  <TableCell className="font-['IBM_Plex_Mono'] text-xs">707.660.924-02</TableCell>
                  <TableCell><Badge className="bg-status-warning text-white border-0">Sem cadastro</Badge></TableCell>
                  <TableCell className="font-['Public_Sans'] text-sm">LC + PDF</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">Abrir pendencia</Button>
                  </TableCell>
                </TableRow>
                <TableRow className="row-hover">
                  <TableCell className="font-['IBM_Plex_Mono'] text-xs">123.855.954-94</TableCell>
                  <TableCell><Badge className="bg-status-success text-white border-0">Conferido</Badge></TableCell>
                  <TableCell className="font-['Public_Sans'] text-sm">LC</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">Ver historico</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocumentGeneratorConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">
        Gerador de Documentos
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-2">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Modelo</Label>
          <Select defaultValue="oficio">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oficio">Oficio</SelectItem>
              <SelectItem value="memorando">Memorando</SelectItem>
              <SelectItem value="relatorio">Relatorio de Auditoria</SelectItem>
            </SelectContent>
          </Select>
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Parametros</Label>
          <Textarea placeholder="Dados para preenchimento automatico do modelo..." />
          <div className="flex items-center gap-2">
            <Button size="sm">Gerar documento</Button>
            <Button size="sm" variant="outline">Salvar rascunho</Button>
          </div>
        </div>

        <div className="rounded-radius-md border border-border-default bg-surface-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <p className="font-['Public_Sans'] text-sm font-semibold text-text-primary">Preview</p>
            <Badge variant="outline">Documento</Badge>
          </div>
          <div className="mt-3 rounded-radius-md bg-surface-card border border-border-default p-3 space-y-2">
            <p className="font-['Public_Sans'] text-sm font-semibold">OFICIO N° 12/2026 - UG 158366</p>
            <p className="font-['Public_Sans'] text-xs text-text-secondary">
              Encaminha informacoes de conciliacao das listas de credores e demonstrativo de pendencias...
            </p>
            <div className="pt-2 flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Tela cheia
              </Button>
              <Button size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonGalleryConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-4">
      <p className="font-['Public_Sans'] text-xs uppercase tracking-[0.12em] font-semibold text-text-muted">
        Biblioteca de Skeletons
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <p className="font-['Public_Sans'] text-xs font-semibold text-text-secondary">Cards / Dashboard</p>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>

        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <p className="font-['Public_Sans'] text-xs font-semibold text-text-secondary">Tabela longa</p>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-[92%]" />
        </div>

        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <p className="font-['Public_Sans'] text-xs font-semibold text-text-secondary">Formulario / Modal</p>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        <div className="rounded-radius-md border border-border-default p-3 space-y-2">
          <p className="font-['Public_Sans'] text-xs font-semibold text-text-secondary">Upload / Editor / Grafico</p>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

function EditorAndAIConcept() {
  const [content, setContent] = useState<string>('<p>Minuta inicial do documento com contexto do processo e fundamentacao tecnica.</p>');

  return (
    <div className="border border-border-default rounded-radius-xl bg-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default/70 flex items-center justify-between gap-2">
        <div>
          <p className="font-['Public_Sans'] text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">Editor + IA</p>
          <h3 className="font-['Public_Sans'] text-base font-semibold text-text-primary mt-1">Padrao para Editor de Documentos e Consultor</h3>
        </div>
        <Badge className="gap-1 bg-action-secondary text-text-primary border-border-default">
          <Sparkles className="h-3 w-3" />
          IA Assistida
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] min-h-[440px]">
        <div className="border-r border-border-default/70">
          <RichTextEditor content={content} onChange={setContent} placeholder="Escreva ou cole o documento..." />
        </div>
        <div className="p-4 space-y-3 bg-surface-subtle/30">
          <div className="rounded-radius-md border border-border-default bg-surface-card p-3">
            <p className="font-['Public_Sans'] text-xs font-semibold text-text-primary">Checklist juridico</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              <li>Base legal citada e atualizada</li>
              <li>Objeto e finalidade explicitos</li>
              <li>Dados financeiros coerentes</li>
            </ul>
          </div>
          <div className="rounded-radius-md border border-border-default bg-surface-card p-3">
            <p className="font-['Public_Sans'] text-xs font-semibold text-text-primary">Sugestoes de IA</p>
            <p className="font-['Public_Sans'] text-xs text-text-secondary mt-1">
              \"Recomenda-se incluir referencia ao art. 37 para reforcar motivacao administrativa.\"
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm">Aplicar sugestao</Button>
            <Button variant="outline" size="sm">Gerar minuta final</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverageMatrixConcept() {
  return (
    <div className="border border-border-default rounded-radius-xl bg-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default/70">
        <h3 className="font-['Public_Sans'] text-base font-semibold text-text-primary">Matriz de Cobertura por Rota</h3>
        <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">
          Checklist de padroes de UI presentes no preview para cada modulo registrado em `App.tsx`.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-surface-subtle/60">
            <TableRow>
              <TableHead>Rota</TableHead>
              <TableHead>Modulo</TableHead>
              <TableHead className="text-center">Filtros</TableHead>
              <TableHead className="text-center">Dados</TableHead>
              <TableHead className="text-center">Overlays</TableHead>
              <TableHead className="text-center">Upload</TableHead>
              <TableHead className="text-center">Viz</TableHead>
              <TableHead className="text-center">IA</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coverageRows.map((row) => (
              <TableRow key={row.route} className="row-hover">
                <TableCell className="font-['IBM_Plex_Mono'] text-xs">{row.route}</TableCell>
                <TableCell className="font-['Public_Sans'] text-sm">{row.modulo}</TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.filtros} /></TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.dados} /></TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.overlays} /></TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.upload} /></TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.visualizacao} /></TableCell>
                <TableCell className="text-center"><CoverageMark ok={row.status === 'Coberto' ? true : row.ia} /></TableCell>
                <TableCell>
                  {row.status === 'Coberto' ? (
                    <Badge className="bg-status-success text-white border-0">Coberto</Badge>
                  ) : (
                    <Badge className="bg-status-warning text-white border-0">Parcial</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SidebarConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg overflow-hidden bg-surface-card">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] min-h-[460px]">
        <aside className="bg-[#0E1A2F] text-white/70 p-3 flex flex-col">
          <div className="h-9 w-9 rounded-radius-md bg-white/10 text-white flex items-center justify-center mx-auto">
            <Building2 className="h-4 w-4" />
          </div>

          <div className="mt-4 space-y-2">
            {railItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'h-9 w-9 rounded-radius-md flex items-center justify-center transition-colors mx-auto',
                  item.active ? 'bg-white text-[#0E1A2F]' : 'hover:bg-white/12',
                )}
                title={item.label}
              >
                <item.icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div className="mt-auto h-9 w-9 rounded-radius-full bg-white/10 text-white text-xs font-semibold flex items-center justify-center mx-auto">
            UG
          </div>
        </aside>

        <section className="bg-gradient-to-b from-surface-card to-surface-subtle/40 p-4">
          <div className="pb-3 border-b border-border-default/70">
            <p className="font-['Public_Sans'] text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold">
              Navegacao Contextual
            </p>
            <h4 className="font-['Public_Sans'] text-[17px] font-semibold text-text-primary mt-1">
              Nucleo Financeiro
            </h4>
          </div>

          <div className="mt-3 relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input className="pl-8 h-9" placeholder="Ir para modulo, processo ou aluno..." />
          </div>

          <div className="mt-4 space-y-3">
            {sidebarGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <div className="px-1 flex items-center justify-between">
                  <p className="font-['Public_Sans'] text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold">
                    {group.title}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                </div>

                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={cn(
                      'w-full rounded-radius-md px-2.5 py-2 text-left flex items-center gap-2.5 transition-all',
                      item.active
                        ? 'bg-primary text-primary-foreground shadow-primary'
                        : 'hover:bg-surface-card text-text-secondary hover:text-text-primary border border-transparent hover:border-border-default/60',
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="font-['Public_Sans'] text-[13px] font-medium truncate flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "font-['IBM_Plex_Mono'] text-[10px] rounded-radius-full px-2 py-0.5",
                          item.active ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-muted',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeaderShellConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg overflow-hidden bg-surface-card">
      <div className="px-4 py-3 border-b border-border-default/70 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Financeiro</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>LC</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h4 className="font-['Public_Sans'] text-[18px] font-semibold text-text-primary mt-2">
            Lista de Credores e Pendencias
          </h4>
          <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">
            Shell recomendado para paginas de operacao e auditoria
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
          <Button size="sm" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[10px] font-semibold">CG</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="p-3">
        <Tabs defaultValue="dados">
          <TabsList className="h-9">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="historico">Historico</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="mt-3">
            <div className="rounded-radius-md bg-surface-subtle/70 border border-border-default/60 px-3 py-2 text-xs text-text-secondary">
              Modo dados: visualizacao operacional focada em execucao.
            </div>
          </TabsContent>
          <TabsContent value="historico" className="mt-3">
            <div className="rounded-radius-md bg-surface-subtle/70 border border-border-default/60 px-3 py-2 text-xs text-text-secondary">
              Modo historico: trilha temporal de alteracoes.
            </div>
          </TabsContent>
          <TabsContent value="auditoria" className="mt-3">
            <div className="rounded-radius-md bg-surface-subtle/70 border border-border-default/60 px-3 py-2 text-xs text-text-secondary">
              Modo auditoria: inconsistencias e conformidade.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FilterBarConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-text-secondary">
        <SlidersHorizontal className="h-4 w-4" />
        <p className="font-['Public_Sans'] text-xs font-semibold uppercase tracking-[0.12em]">Barra de filtros operacional</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Processo</Label>
          <Input placeholder="23035..." />
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Situacao</Label>
          <Select defaultValue="pendente">
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="conferido">Conferido</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Origem</Label>
          <Select defaultValue="lc">
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lc">Lista de Credores</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Pesquisa livre</Label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input className="pl-8" placeholder="Nome, CPF, conta..." />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Checkbox defaultChecked />
          Somente com saldo
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Switch defaultChecked />
          Atualizacao automatica
        </label>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm">Limpar</Button>
          <Button size="sm">Aplicar filtros</Button>
        </div>
      </div>
    </div>
  );
}

function FormConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Nome do favorecido</Label>
          <Input placeholder="Nome completo" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">CPF</Label>
          <Input placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Banco / Agencia / Conta</Label>
          <Input placeholder="001 / 1197 / 400834" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Valor</Label>
          <Input placeholder="R$ 0,00" />
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        <Label className="font-['Public_Sans'] text-[11px] uppercase tracking-[0.1em] text-text-muted">Observacao</Label>
        <Textarea placeholder="Contexto para auditoria, justificativa ou pendencia encontrada..." />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm">Cancelar</Button>
        <Button size="sm">Salvar registro</Button>
      </div>
    </div>
  );
}

function ExecutiveCardsConcept() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard
        title="Empenhado"
        value="R$ 2.591,66"
        subtitle="33,8% do valor total"
        icon={CircleDollarSign}
        stitchColor="vibrant-blue"
        progress={34}
      />
      <StatCard
        title="Pendencias"
        value="12"
        subtitle="8 com bloqueio operacional"
        icon={AlertTriangle}
        stitchColor="amber"
        progress={66}
      />
      <StatCard
        title="Conferidos"
        value="145"
        subtitle="Atualizado hoje 11:42"
        icon={CheckCircle2}
        stitchColor="emerald-green"
        progress={82}
      />
      <StatCard
        title="Alertas"
        value="3"
        subtitle="Aguardando acao da equipe"
        icon={Bell}
        stitchColor="red-500"
        progress={25}
      />
    </div>
  );
}

function DataTableConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg overflow-hidden bg-surface-card">
      <Table>
        <TableHeader className="bg-surface-subtle/70">
          <TableRow>
            <TableHead className="font-['Public_Sans']">CPF</TableHead>
            <TableHead className="font-['Public_Sans']">Nome</TableHead>
            <TableHead className="font-['Public_Sans']">Conta</TableHead>
            <TableHead className="font-['Public_Sans']">Status</TableHead>
            <TableHead className="text-right font-['Public_Sans']">Valor</TableHead>
            <TableHead className="text-right font-['Public_Sans']">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="row-hover">
            <TableCell className="font-['IBM_Plex_Mono'] text-xs">037.922.311-23</TableCell>
            <TableCell className="font-['Public_Sans'] font-medium">Adonias de Sa Portela</TableCell>
            <TableCell className="font-['IBM_Plex_Mono'] text-xs">001 / 1197 / 400834</TableCell>
            <TableCell>
              <Badge className="bg-status-success text-white border-0">Conferido</Badge>
            </TableCell>
            <TableCell className="text-right font-['Public_Sans'] font-semibold text-action-primary">R$ 0,01</TableCell>
            <TableCell className="text-right">
              <Button variant="outline" size="sm">Detalhes</Button>
            </TableCell>
          </TableRow>
          <TableRow className="row-hover">
            <TableCell className="font-['IBM_Plex_Mono'] text-xs">126.729.284-95</TableCell>
            <TableCell className="font-['Public_Sans'] font-medium">Amanda Sofia Santos Medeiros</TableCell>
            <TableCell className="font-['IBM_Plex_Mono'] text-xs">-</TableCell>
            <TableCell>
              <Badge className="bg-status-warning text-white border-0">Sem cadastro</Badge>
            </TableCell>
            <TableCell className="text-right font-['Public_Sans'] font-semibold">R$ 0,01</TableCell>
            <TableCell className="text-right">
              <Button size="sm" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Corrigir
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function FeedbackStatesConcept() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="space-y-3">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Sincronizacao concluida</AlertTitle>
          <AlertDescription>
            124 registros processados sem inconsistencias criticas.
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha de validacao</AlertTitle>
          <AlertDescription>
            3 CPFs estao sem conta bancaria vinculada.
          </AlertDescription>
        </Alert>
      </div>

      <div className="border border-border-default rounded-radius-lg bg-surface-card p-4 space-y-3">
        <div>
          <p className="font-['Public_Sans'] text-xs text-text-muted">Progresso de conciliacao</p>
          <div className="flex items-center justify-between mt-1">
            <p className="font-['Public_Sans'] text-sm font-semibold text-text-primary">67% concluido</p>
            <p className="font-['IBM_Plex_Mono'] text-xs text-text-muted">145 / 216</p>
          </div>
          <Progress value={67} className="mt-2 h-2" />
        </div>

        <div className="pt-1 space-y-2">
          <p className="font-['Public_Sans'] text-xs text-text-muted">Skeleton de carregamento</p>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-[82%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaginationConcept() {
  return (
    <div className="border border-border-default rounded-radius-lg bg-surface-card px-4 py-3">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <p className="font-['Public_Sans'] text-sm text-text-secondary">Mostrando 1-20 de 216 registros</p>
        <Pagination className="mx-0 w-auto justify-start md:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">11</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const isDark = mode === 'dark';

  return (
    <div className={cn(isDark && 'dark')}>
      <div className="bg-background text-foreground border border-border rounded-radius-xl shadow-shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default bg-surface-subtle/70 flex items-center justify-between">
          <div>
            <p className="font-['Public_Sans'] text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold">
              Design System Preview
            </p>
            <h2 className="font-['Public_Sans'] text-[18px] font-semibold mt-1">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </h2>
          </div>
          <Badge className="bg-action-primary text-white border-0">
            {isDark ? 'Sobrio Noturno' : 'Sobrio Diurno'}
          </Badge>
        </div>

        <div className="p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Direcao Visual
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-border-default/80">
                <CardContent className="pt-5">
                  <p className="font-['Public_Sans'] text-sm font-semibold">Tipografia institucional</p>
                  <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">Public Sans para UI e IBM Plex Mono para dados.</p>
                </CardContent>
              </Card>
              <Card className="border-border-default/80">
                <CardContent className="pt-5">
                  <p className="font-['Public_Sans'] text-sm font-semibold">Sidebar em camadas</p>
                  <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">Rail de atalhos + painel contextual por dominio.</p>
                </CardContent>
              </Card>
              <Card className="border-border-default/80">
                <CardContent className="pt-5">
                  <p className="font-['Public_Sans'] text-sm font-semibold">Leitura orientada a decisao</p>
                  <p className="font-['Public_Sans'] text-xs text-text-muted mt-1">Maior contraste de hierarquia e menor ruido visual.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Cores Semanticas
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {coreSwatches.map((token) => (
                <Swatch key={token.label} token={token} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Tipografia Proposta
            </h3>
            <div className="space-y-2">
              {typographyScale.map((item) => (
                <div key={item.label} className="flex gap-3 items-start">
                  <span className="font-['IBM_Plex_Mono'] text-[10px] w-14 text-text-muted mt-1">{item.label}</span>
                  <p className={item.className}>{item.sample}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Shell de Pagina
            </h3>
            <HeaderShellConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Sidebar Nova
            </h3>
            <SidebarConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Filtros Operacionais
            </h3>
            <FilterBarConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Formulario Operacional
            </h3>
            <FormConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Cards Executivos
            </h3>
            <ExecutiveCardsConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Tabela Operacional
            </h3>
            <DataTableConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Estados e Feedback
            </h3>
            <FeedbackStatesConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Modais, Drawer, Menus e Tooltips
            </h3>
            <OverlayAndContextConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Graficos do Dashboard
            </h3>
            <DashboardChartsConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Skeletons de Graficos
            </h3>
            <DashboardChartSkeletonConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Upload e Processamento
            </h3>
            <UploadFlowConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Financeiro e Conciliacao
            </h3>
            <FinanceiroConciliacaoConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Gerador de Documentos
            </h3>
            <DocumentGeneratorConcept />
          </section>

          <section className="space-y-3">
            <h3 className="font-['Public_Sans'] text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Navegacao de Lista
            </h3>
            <PaginationConcept />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPreview() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-['Public_Sans'] text-[32px] leading-[1.1] font-bold tracking-[-0.02em] text-text-primary">
          Design System - Proposta Tailwind
        </h1>
        <p className="font-['Public_Sans'] text-text-sm text-text-secondary mt-2 max-w-3xl">
          Proposta reposicionada com melhorias significativas em tipografia, navegacao lateral e hierarquia visual.
          Abaixo voce valida o sistema em Light e Dark e, ao final, a matriz de cobertura completa por rota.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </div>

      <EditorAndAIConcept />
      <SkeletonGalleryConcept />
      <CoverageMatrixConcept />
    </div>
  );
}
