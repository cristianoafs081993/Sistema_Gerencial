import { useEffect, useState, useRef } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ClipboardList,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type Ambiente,
  type Checkin,
  manutencaoService,
  type Ocorrencia,
  type BlocoMapa,
} from '@/services/manutencao';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

const formatDateTime = (isoString?: string | null) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR');
};

const mapAcaoLabel: Record<string, string> = {
  limpeza_padrao: 'Limpeza Padrão',
  reposicao_insumos: 'Reposição de Insumos',
  inspecao: 'Inspeção Sanitária',
  manutencao_corretiva: 'Manutenção Corretiva',
};

const mapAcaoBadge: Record<string, string> = {
  limpeza_padrao: 'border-blue-200 bg-blue-50 text-blue-700',
  reposicao_insumos: 'border-purple-200 bg-purple-50 text-purple-700',
  inspecao: 'border-amber-200 bg-amber-50 text-amber-700',
  manutencao_corretiva: 'border-red-200 bg-red-50 text-red-700',
};

const mapZonaName: Record<string, string> = {
  academico: 'Acadêmico',
  administrativo: 'Administrativo',
  esportivo: 'Esportivo',
  servicos: 'Serviços',
  convivencia: 'Convivência',
  apoio_tecnico: 'Apoio Técnico',
};

const materialLabels: Record<string, string> = {
  papel_higienico: 'Papel Higiênico (rolos)',
  sabonete_liquido: 'Sabonete Líquido (L)',
  papel_toalha: 'Papel Toalha (pct)',
  saco_lixo: 'Saco de Lixo (un)',
  outros: 'Outros',
};

const materialEmojis: Record<string, string> = {
  papel_higienico: '🧻',
  sabonete_liquido: '🧼',
  papel_toalha: '🧻',
  saco_lixo: '🗑️',
  outros: '📦',
};

const CAMPUS_BUILDINGS = [
  { id: 'lab_energias', nome: 'Laboratório de Energias Renováveis e Hidroponia', zona: 'academico', badgeX: 331, badgeY: 122 },
  { id: 'ginasio', nome: 'Ginásio Poliesportivo', zona: 'esportivo', badgeX: 417, badgeY: 316 },
  { id: 'bloco_central', nome: 'Bloco Acadêmico Central', zona: 'academico', badgeX: 611, badgeY: 191 },
  { id: 'bloco_salas', nome: 'Bloco de Sala de Aula', zona: 'academico', badgeX: 611, badgeY: 384 },
  { id: 'administracao', nome: 'Administração', zona: 'administrativo', badgeX: 753, badgeY: 378 },
  { id: 'biblioteca', nome: 'Biblioteca', zona: 'administrativo', badgeX: 862, badgeY: 365 },
  { id: 'complexo_aquatico', nome: 'Complexo Aquático / Piscina', zona: 'servicos', badgeX: 753, badgeY: 256 },
  { id: 'auditorio', nome: 'Auditório', zona: 'convivencia', badgeX: 611, badgeY: 529 },
  { id: 'torre_agua', nome: 'Torre de Água Principal', zona: 'apoio_tecnico', badgeX: 519, badgeY: 297 },
  { id: 'torre_comunicacao', nome: 'Torre de Observação / Comunicação', zona: 'apoio_tecnico', badgeX: 793, badgeY: 135 },
] as const;

export default function ManutencaoAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [blocosMapa, setBlocosMapa] = useState<BlocoMapa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    codigo: '',
    nome: '',
    bloco: '',
    tipo: 'sala' as Ambiente['tipo'],
    zona: 'academico' as Ambiente['zona'],
  });

  const [qrCodeData, setQrCodeData] = useState<{ codigo: string; nome: string } | null>(null);
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    return localStorage.getItem('manutencao:qr_base_url') || window.location.origin;
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ambList, ocList, chList, blocosList] = await Promise.all([
        manutencaoService.getAmbientes(),
        manutencaoService.getOcorrencias(),
        manutencaoService.getCheckins(),
        manutencaoService.getBlocosMapa(),
      ]);
      setAmbientes(ambList);
      setOcorrencias(ocList);
      setCheckins(chList);
      setBlocosMapa(blocosList);
    } catch (error) {
      console.error('Erro ao carregar dados de manutenção:', error);
      toast.error('Não foi possível carregar as informações do servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.codigo || !newRoom.nome) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    try {
      await manutencaoService.createAmbiente({
        codigo: newRoom.codigo.toUpperCase().trim().replace(/\s+/g, '-'),
        nome: newRoom.nome.trim(),
        bloco: newRoom.bloco.trim() || null,
        tipo: newRoom.tipo,
        zona: newRoom.zona,
        status: 'ativo',
      });
      toast.success('Ambiente cadastrado com sucesso!');
      setIsAddRoomOpen(false);
      setNewRoom({ codigo: '', nome: '', bloco: '', tipo: 'sala', zona: 'academico' });
      void loadData();
    } catch (error) {
      console.error('Erro ao cadastrar ambiente:', error);
      toast.error('Código do ambiente já existe ou erro no cadastro.');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Deseja realmente excluir este ambiente? Todas as ocorrências e check-ins serão apagados.')) return;
    try {
      await manutencaoService.deleteAmbiente(id);
      toast.success('Ambiente excluído.');
      void loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir ambiente.');
    }
  };

  const handleResolveOcorrencia = async (id: string) => {
    try {
      await manutencaoService.resolveOcorrencia(id, user?.id);
      toast.success('Ocorrência resolvida com sucesso!');
      void loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao marcar ocorrência como resolvida.');
    }
  };

  const printQrCode = () => {
    const printContent = document.getElementById('printable-qr-card');
    if (!printContent) return;

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=800,height=600');

    if (!printWindow) {
      toast.error('Bloqueador de popup ativo. Permita popups para imprimir.');
      return;
    }

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      qrBaseUrl + '/feedback-ambiente/' + qrCodeData?.codigo
    )}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${qrCodeData?.nome}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #ffffff;
            }
            .qr-card {
              border: 3px solid #0f172a;
              border-radius: 16px;
              padding: 40px;
              text-align: center;
              max-width: 400px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #10b981;
              margin-bottom: 5px;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              color: #1e293b;
              margin-top: 0;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin-bottom: 25px;
              line-height: 1.4;
            }
            .qr-image {
              margin: 15px auto;
              display: block;
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 8px;
            }
            .room-info {
              margin-top: 20px;
              background: #f1f5f9;
              padding: 12px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 14px;
              font-weight: bold;
              color: #0f172a;
            }
            .footer {
              margin-top: 25px;
              font-size: 11px;
              color: #94a3b8;
            }
            @media print {
              body { background: none; }
              .qr-card { border-width: 3px; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo">GovAnalytics</div>
            <div class="title">Controle de Limpeza & Manutenção</div>
            <div class="subtitle">Escaneie o QR Code abaixo para relatar problemas ou registrar passagem de limpeza.</div>
            <img class="qr-image" src="${qrCodeUrl}" width="230" height="230" alt="QR Code" />
            <div class="room-info">${qrCodeData?.nome}<br/>[ ${qrCodeData?.codigo} ]</div>
            <div class="footer">IFRN Campus Central</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printAllQrCodes = () => {
    if (filteredAmbientes.length === 0) {
      toast.error('Nenhum ambiente filtrado para imprimir.');
      return;
    }

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=900,height=700');

    if (!printWindow) {
      toast.error('Bloqueador de popup ativo. Permita popups para imprimir.');
      return;
    }

    const qrCardsHtml = filteredAmbientes.map((amb) => {
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        qrBaseUrl + '/feedback-ambiente/' + amb.codigo
      )}`;
      return `
        <div class="qr-card">
          <div class="logo">GovAnalytics</div>
          <div class="title">Controle de Limpeza & Manutenção</div>
          <div class="subtitle">Escaneie o QR Code abaixo para relatar problemas ou registrar passagem de limpeza.</div>
          <img class="qr-image" src="${qrCodeUrl}" width="200" height="200" alt="QR Code" />
          <div class="room-info">${amb.nome}<br/>[ ${amb.codigo} ]</div>
          <div class="footer">IFRN Campus Central</div>
        </div>
      `;
    }).join('\n');

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Codes</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #ffffff;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
            .qr-card {
              border: 3px solid #0f172a;
              border-radius: 16px;
              padding: 25px 20px;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
              background: white;
              break-inside: avoid;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .logo {
              font-size: 20px;
              font-weight: 800;
              color: #10b981;
              margin-bottom: 5px;
            }
            .title {
              font-size: 15px;
              font-weight: 700;
              color: #1e293b;
              margin-top: 0;
              margin-bottom: 6px;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin-bottom: 15px;
              line-height: 1.4;
            }
            .qr-image {
              margin: 10px auto;
              display: block;
              border: 1px solid #e2e8f0;
              padding: 8px;
              border-radius: 8px;
            }
            .room-info {
              margin-top: 15px;
              background: #f1f5f9;
              padding: 10px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 13px;
              font-weight: bold;
              color: #0f172a;
            }
            .footer {
              margin-top: 15px;
              font-size: 10px;
              color: #94a3b8;
            }
            @media print {
              body { background: none; padding: 0; }
              .grid-container {
                gap: 15px;
              }
              .qr-card {
                border-width: 3px;
                box-shadow: none;
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${qrCardsHtml}
          </div>
          <script>
            window.onload = function() {
              const images = document.querySelectorAll('.qr-image');
              let loadedCount = 0;
              const totalImages = images.length;
              
              function checkAllLoaded() {
                loadedCount++;
                if (loadedCount === totalImages) {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                }
              }

              if (totalImages === 0) {
                window.print();
                window.close();
              } else {
                images.forEach(function(img) {
                  if (img.complete) {
                    checkAllLoaded();
                  } else {
                    img.onload = checkAllLoaded;
                    img.onerror = checkAllLoaded;
                  }
                });
              }
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter calculations
  const filteredOcorrencias = ocorrencias.filter((oc) => {
    const matchesSearch =
      !searchQuery ||
      oc.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oc.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      oc.observacao?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'pendente' && oc.status === 'pendente') ||
      (statusFilter === 'resolvido' && oc.status === 'resolvido');

    return matchesSearch && matchesStatus;
  });

  const filteredCheckins = checkins.filter((ch) => {
    return (
      !searchQuery ||
      ch.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.responsavel_nome.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredAmbientes = ambientes.filter((amb) => {
    return (
      !searchQuery ||
      amb.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amb.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amb.bloco?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const [selectedZona, setSelectedZona] = useState<string | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Edit mode for Map
  const [isEditMapMode, setIsEditMapMode] = useState(false);
  const [editingBloco, setEditingBloco] = useState<Partial<BlocoMapa> | null>(null);
  const [drawingTool, setDrawingTool] = useState<'polygon' | 'rect' | 'circle' | 'badge' | null>(null);
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);
  const [rectStartPoint, setRectStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [circleCenter, setCircleCenter] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const activeBlocos = blocosMapa.length > 0 ? blocosMapa : [
    { id: 'lab_energias', nome: 'Laboratório de Energias Renováveis e Hidroponia', zona: 'academico', badge_x: 331, badge_y: 122, geometria_tipo: 'rect', geometria_data: { x: 257, y: 85, width: 148, height: 75, rx: 5 } },
    { id: 'ginasio', nome: 'Ginásio Poliesportivo', zona: 'esportivo', badge_x: 417, badge_y: 316, geometria_tipo: 'rect', geometria_data: { x: 303, y: 247, width: 217, height: 137, rx: 6 } },
    { id: 'bloco_central', nome: 'Bloco Acadêmico Central', zona: 'academico', badge_x: 611, badge_y: 191, geometria_tipo: 'rect', geometria_data: { x: 554, y: 147, width: 114, height: 87, rx: 5 } },
    { id: 'bloco_salas', nome: 'Bloco de Sala de Aula', zona: 'academico', badge_x: 611, badge_y: 384, geometria_tipo: 'rect', geometria_data: { x: 554, y: 309, width: 114, height: 150, rx: 5 } },
    { id: 'passarela', nome: 'Área de Convivência e Passarelas', zona: 'convivencia', badge_x: 510, badge_y: 300, geometria_tipo: 'rect', geometria_data: { x: 502, y: 147, width: 34, height: 312, rx: 4 } },
    { id: 'administracao', nome: 'Administração', zona: 'administrativo', badge_x: 753, badge_y: 378, geometria_tipo: 'rect', geometria_data: { x: 691, y: 347, width: 126, height: 62, rx: 5 } },
    { id: 'biblioteca', nome: 'Biblioteca', zona: 'administrativo', badge_x: 862, badge_y: 365, geometria_tipo: 'rect', geometria_data: { x: 828, y: 210, width: 68, height: 312, rx: 5 } },
    { id: 'complexo_aquatico', nome: 'Complexo Aquático / Piscina', zona: 'servicos', badge_x: 753, badge_y: 256, geometria_tipo: 'rect', geometria_data: { x: 702, y: 210, width: 103, height: 94, rx: 5 } },
    { id: 'auditorio', nome: 'Auditório', zona: 'convivencia', badge_x: 611, badge_y: 529, geometria_tipo: 'path', geometria_data: { d: "M 512 503 H 656 A 72 72 0 0 1 512 503" } },
    { id: 'torre_agua', nome: 'Torre de Água Principal', zona: 'apoio_tecnico', badge_x: 519, badge_y: 297, geometria_tipo: 'circle', geometria_data: { cx: 519, cy: 297, r: 16 } },
    { id: 'torre_comunicacao', nome: 'Torre de Observação / Comunicação', zona: 'apoio_tecnico', badge_x: 793, badge_y: 135, geometria_tipo: 'circle', geometria_data: { cx: 793, cy: 135, r: 18 } }
  ] as BlocoMapa[];

  const ZONA_COLORS = {
    academico: { fill: 'rgba(139, 92, 246, 0.25)', stroke: '#8b5cf6' },
    esportivo: { fill: 'rgba(217, 119, 6, 0.25)', stroke: '#d97706' },
    administrativo: { fill: 'rgba(249, 115, 22, 0.25)', stroke: '#f97316' },
    servicos: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6' },
    convivencia: { fill: 'rgba(132, 204, 22, 0.25)', stroke: '#84cc16' },
    apoio_tecnico: { fill: 'rgba(6, 182, 212, 0.25)', stroke: '#06b6d4' },
  } as const;

  const renderGeometria = (bloco: BlocoMapa | Partial<BlocoMapa>, isHoveredOrSelected: boolean) => {
    if (!bloco.geometria_tipo || !bloco.geometria_data) return null;
    const color = ZONA_COLORS[bloco.zona || 'academico'] || ZONA_COLORS.academico;
    const fill = isHoveredOrSelected ? color.fill : 'rgba(255, 255, 255, 0.01)';
    const stroke = isHoveredOrSelected ? color.stroke : 'transparent';
    const data = bloco.geometria_data;

    switch (bloco.geometria_tipo) {
      case 'rect':
        return (
          <rect
            x={data.x}
            y={data.y}
            width={data.width}
            height={data.height}
            rx={data.rx || 0}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        );
      case 'circle':
        return (
          <circle
            cx={data.cx}
            cy={data.cy}
            r={data.r}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        );
      case 'polygon':
        return (
          <polygon
            points={data.points}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        );
      case 'path':
        return (
          <path
            d={data.d}
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        );
      default:
        return null;
    }
  };

  const getSvgCoords = (e: React.MouseEvent<SVGSVGElement | SVGRectElement>) => {
    const svg = e.currentTarget.closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 650);
    return {
      x: Math.max(0, Math.min(1000, x)),
      y: Math.max(0, Math.min(650, y))
    };
  };

  const handleMapClick = (e: React.MouseEvent<SVGRectElement>) => {
    const { x, y } = getSvgCoords(e);

    if (drawingTool === 'polygon') {
      if (tempPoints.length > 2) {
        const first = tempPoints[0];
        const dist = Math.sqrt(Math.pow(x - first.x, 2) + Math.pow(y - first.y, 2));
        if (dist < 15) {
          concludePolygon();
          return;
        }
      }
      setTempPoints([...tempPoints, { x, y }]);
    } else if (drawingTool === 'rect') {
      if (!rectStartPoint) {
        setRectStartPoint({ x, y });
      } else {
        const geometria_data = {
          x: Math.min(rectStartPoint.x, x),
          y: Math.min(rectStartPoint.y, y),
          width: Math.abs(rectStartPoint.x - x),
          height: Math.abs(rectStartPoint.y - y),
          rx: 5
        };
        setEditingBloco(prev => prev ? {
          ...prev,
          geometria_tipo: 'rect',
          geometria_data
        } : null);
        setRectStartPoint(null);
        setDrawingTool(null);
        toast.success("Retângulo desenhado!");
      }
    } else if (drawingTool === 'circle') {
      if (!circleCenter) {
        setCircleCenter({ x, y });
      } else {
        const r = Math.round(Math.sqrt(Math.pow(x - circleCenter.x, 2) + Math.pow(y - circleCenter.y, 2)));
        const geometria_data = {
          cx: circleCenter.x,
          cy: circleCenter.y,
          r
        };
        setEditingBloco(prev => prev ? {
          ...prev,
          geometria_tipo: 'circle',
          geometria_data
        } : null);
        setCircleCenter(null);
        setDrawingTool(null);
        toast.success("Círculo desenhado!");
      }
    } else if (drawingTool === 'badge') {
      setEditingBloco(prev => prev ? {
        ...prev,
        badge_x: x,
        badge_y: y
      } : null);
      setDrawingTool(null);
      toast.success("Alerta posicionado!");
    }
  };

  const handleMapMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!drawingTool) return;
    const { x, y } = getSvgCoords(e);
    setMousePos({ x, y });
  };

  const concludePolygon = () => {
    if (tempPoints.length < 3) {
      toast.error("Um polígono necessita de ao menos 3 pontos.");
      return;
    }
    const pointsStr = tempPoints.map(p => `${p.x},${p.y}`).join(' ');
    setEditingBloco(prev => prev ? {
      ...prev,
      geometria_tipo: 'polygon',
      geometria_data: { points: pointsStr }
    } : null);
    setTempPoints([]);
    setDrawingTool(null);
    toast.success("Polígono criado!");
  };

  const handleSaveBloco = async () => {
    if (!editingBloco || !editingBloco.nome || !editingBloco.zona) {
      toast.error("Nome e zona são obrigatórios.");
      return;
    }
    if (!editingBloco.geometria_tipo || !editingBloco.geometria_data) {
      toast.error("Delimite o bloco no mapa primeiro.");
      return;
    }
    try {
      const payload: BlocoMapa = {
        id: editingBloco.id || `bloco_${Date.now()}`,
        nome: editingBloco.nome,
        zona: editingBloco.zona as any,
        badge_x: editingBloco.badge_x || 500,
        badge_y: editingBloco.badge_y || 325,
        geometria_tipo: editingBloco.geometria_tipo as any,
        geometria_data: editingBloco.geometria_data,
      };
      await manutencaoService.saveBlocoMapa(payload);
      toast.success("Bloco gravado!");
      setEditingBloco(null);
      void loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar o bloco.");
    }
  };

  const handleDeleteBloco = async (id: string) => {
    if (!confirm("Confirmar exclusão deste bloco?")) return;
    try {
      await manutencaoService.deleteBlocoMapa(id);
      toast.success("Bloco excluído!");
      if (editingBloco?.id === id) setEditingBloco(null);
      void loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao deletar.");
    }
  };

  const handleZonaClick = (zona: string) => {
    setSelectedZona((prev) => (prev === zona ? null : zona));
  };

  const filteredAmbientesByZona = filteredAmbientes.filter((amb) => {
    if (!selectedZona) return true;
    return amb.zona === selectedZona;
  });

  const getBuildingStats = (zona: string) => {
    const rooms = ambientes.filter(amb => amb.zona === zona);
    const openAlerts = ocorrencias.filter(o => o.status === 'pendente' && o.ambiente?.zona === zona);
    const roomIds = rooms.map(r => r.id);
    const lastCh = checkins.find(c => roomIds.includes(c.ambiente_id));
    return {
      roomsCount: rooms.length,
      alertsCount: openAlerts.length,
      lastCheckin: lastCh ? new Date(lastCh.created_at).toLocaleDateString('pt-BR') : 'Sem registro',
    };
  };

  const isBuildingDimmed = (zona: string) => {
    return selectedZona !== null && selectedZona !== zona;
  };

  // Material consumption aggregation
  const materialsDataMap: Record<string, number> = {
    papel_higienico: 0,
    sabonete_liquido: 0,
    papel_toalha: 0,
    saco_lixo: 0,
    outros: 0,
  };

  checkins.forEach((ch) => {
    ch.materiais?.forEach((mat) => {
      if (materialsDataMap[mat.material] !== undefined) {
        materialsDataMap[mat.material] += mat.quantidade;
      }
    });
  });

  const materialsChartData = Object.entries(materialsDataMap).map(([key, val]) => ({
    name: materialLabels[key] || key,
    quantidade: val,
  }));

  // Ratings aggregation
  const ratingCounts = {
    Excelente: ocorrencias.filter((o) => o.avaliacao === 5).length,
    Bom: ocorrencias.filter((o) => o.avaliacao === 4).length,
    Regular: ocorrencias.filter((o) => o.avaliacao === 3).length,
    Ruim: ocorrencias.filter((o) => o.avaliacao <= 2).length,
  };

  const ratingChartData = Object.entries(ratingCounts).map(([key, val]) => ({
    name: key,
    value: val,
  }));

  const ratingColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const kpis = {
    totalPendentes: ocorrencias.filter((oc) => oc.status === 'pendente').length,
    limpezasHoje: checkins.filter((ch) => {
      const today = new Date().toDateString();
      return new Date(ch.created_at).toDateString() === today;
    }).length,
    totalSalas: ambientes.length,
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-gradient-dark">Limpeza e Manutenção</h1>
        <HeaderSubtitle>Painel administrativo para controle e inspeção de ambientes via QR Code.</HeaderSubtitle>
      </div>

      <HeaderActions>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddRoomOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Cadastrar Ambiente
          </Button>
        </div>
      </HeaderActions>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Ocorrências Pendentes" value={kpis.totalPendentes} subtitle="Relatadas por usuários aguardando resolução" icon={AlertCircle} stitchColor={kpis.totalPendentes > 0 ? 'red-500' : 'emerald-green'} isLoading={isLoading} />
        <StatCard title="Limpezas Hoje" value={kpis.limpezasHoje} subtitle="Registradas pela equipe de conservação" icon={Check} stitchColor="vibrant-blue" isLoading={isLoading} />
        <StatCard title="Ambientes Monitorados" value={kpis.totalSalas} subtitle="Salas e banheiros com QR Code ativo" icon={Building2} stitchColor="purple" isLoading={isLoading} />
      </div>

      {/* Search and filter header */}
      <FilterPanel title="Filtros e Busca" actions={<Button type="button" variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('todos'); }}>Limpar</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar por ambiente, código, bloco..." className="h-10 pl-9 input-system" />
          </div>
          {activeTab === 'ocorrencias' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 input-system">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </FilterPanel>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100/80 p-1 border rounded-lg">
          <TabsTrigger value="dashboard" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Visão Geral / Mapa
          </TabsTrigger>
          <TabsTrigger value="ocorrencias" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Ocorrências ({filteredOcorrencias.length})
          </TabsTrigger>
          <TabsTrigger value="checkins" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Histórico de Limpezas ({filteredCheckins.length})
          </TabsTrigger>
          <TabsTrigger value="ambientes" className="px-4 py-2 font-medium transition-all rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            Salas e Ambientes ({filteredAmbientes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dashboard */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* SVG Zoning Map */}
            <div className="lg:col-span-8 space-y-3">
              <div className="bg-white p-4 border rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                    Mapa de Zoneamento - Currais Novos
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isEditMapMode ? "destructive" : "outline"}
                      size="xs"
                      onClick={() => {
                        setIsEditMapMode(!isEditMapMode);
                        setEditingBloco(null);
                        setDrawingTool(null);
                        setTempPoints([]);
                      }}
                      className="text-xs font-bold"
                    >
                      {isEditMapMode ? "Sair da Edição" : "Configurar Mapa"}
                    </Button>
                    {selectedZona && (
                      <Button variant="ghost" size="xs" onClick={() => setSelectedZona(null)} className="text-xs text-rose-500 hover:text-rose-600 font-bold">
                        Limpar Filtro
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Passe o mouse sobre os blocos para informações detalhadas. Clique em um prédio para filtrar as salas por zona.
                </p>
                
                <div className="relative map-container overflow-visible">
                  <svg viewBox="0 0 1000 650" className="w-full h-auto border border-slate-100 rounded-xl bg-slate-50 shadow-inner select-none">
                    <style>
                      {`
                        @keyframes pulse-alert {
                          0% {
                            r: 4px;
                            opacity: 1;
                          }
                          50% {
                            r: 9px;
                            opacity: 0.4;
                          }
                          100% {
                            r: 14px;
                            opacity: 0;
                          }
                        }
                        .pulsing-alert-ring {
                          animation: pulse-alert 2.5s infinite ease-out;
                        }
                      `}
                    </style>

                    <defs>
                      {/* Filtro de Sombra Suave Institucional para Destaque */}
                      <filter id="clean-shadow" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.1" />
                      </filter>
                    </defs>

                    {/* Imagem Oficial do Zoning do Campus (Recortada e Sem Textos) */}
                    <image
                      href="/campus-zoning-clean.jpg"
                      x="0"
                      y="0"
                      width="1000"
                      height="650"
                      preserveAspectRatio="none"
                    />

                    {/* Renderização dinâmica dos blocos cadastrados */}
                    {activeBlocos.map((bloco) => {
                      const isHovered = hoveredBuilding === bloco.id;
                      const isSelected = selectedZona === bloco.zona;
                      const isDimmed = selectedZona !== null && selectedZona !== bloco.zona;

                      return (
                        <g
                          key={bloco.id}
                          className={cn(
                            "cursor-pointer transition-all duration-300",
                            isDimmed ? 'opacity-20' : 'opacity-100'
                          )}
                          onClick={() => !isEditMapMode && handleZonaClick(bloco.zona)}
                          onMouseEnter={(e) => {
                            if (isEditMapMode) return;
                            setHoveredBuilding(bloco.id);
                            const container = e.currentTarget.closest('.map-container')?.getBoundingClientRect();
                            if (container) {
                              setTooltipPos({
                                x: e.clientX - container.left,
                                y: e.clientY - container.top
                              });
                            }
                          }}
                          onMouseMove={(e) => {
                            if (isEditMapMode) return;
                            const container = e.currentTarget.closest('.map-container')?.getBoundingClientRect();
                            if (container) {
                              setTooltipPos({
                                x: e.clientX - container.left,
                                y: e.clientY - container.top
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredBuilding(null)}
                        >
                          {renderGeometria(bloco, isHovered || isSelected)}
                        </g>
                      );
                    })}

                    {/* Preview do bloco em edição */}
                    {isEditMapMode && editingBloco && (
                      <g>
                        {editingBloco.geometria_tipo && editingBloco.geometria_data && (
                          <g>
                            {renderGeometria(editingBloco, true)}
                          </g>
                        )}
                        {editingBloco.badge_x && editingBloco.badge_y && (
                          <g>
                            <circle cx={editingBloco.badge_x} cy={editingBloco.badge_y} r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                            <text x={editingBloco.badge_x} y={editingBloco.badge_y - 12} textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Alerta</text>
                          </g>
                        )}
                      </g>
                    )}

                    {/* Overlays de desenho ativo */}
                    {isEditMapMode && drawingTool === 'polygon' && tempPoints.length > 0 && (
                      <g>
                        <polyline
                          points={tempPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="rgba(239, 68, 68, 0.15)"
                          stroke="#ef4444"
                          strokeWidth="2"
                        />
                        {tempPoints.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            fill={idx === 0 ? '#10b981' : '#ef4444'}
                            className={idx === 0 ? 'cursor-pointer' : ''}
                            onClick={idx === 0 ? concludePolygon : undefined}
                          />
                        ))}
                        {mousePos && tempPoints.length > 0 && (
                          <line
                            x1={tempPoints[tempPoints.length - 1].x}
                            y1={tempPoints[tempPoints.length - 1].y}
                            x2={mousePos.x}
                            y2={mousePos.y}
                            stroke="#ef4444"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                          />
                        )}
                      </g>
                    )}

                    {isEditMapMode && drawingTool === 'rect' && rectStartPoint && mousePos && (
                      <rect
                        x={Math.min(rectStartPoint.x, mousePos.x)}
                        y={Math.min(rectStartPoint.y, mousePos.y)}
                        width={Math.abs(rectStartPoint.x - mousePos.x)}
                        height={Math.abs(rectStartPoint.y - mousePos.y)}
                        fill="rgba(239, 68, 68, 0.15)"
                        stroke="#ef4444"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )}

                    {isEditMapMode && drawingTool === 'circle' && circleCenter && mousePos && (
                      <g>
                        <circle
                          cx={circleCenter.x}
                          cy={circleCenter.y}
                          r={Math.round(Math.sqrt(Math.pow(mousePos.x - circleCenter.x, 2) + Math.pow(mousePos.y - circleCenter.y, 2)))}
                          fill="rgba(239, 68, 68, 0.15)"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                        <circle cx={circleCenter.x} cy={circleCenter.y} r="3" fill="#ef4444" />
                      </g>
                    )}

                    {/* Retângulo de clique interativo para o modo desenho */}
                    {isEditMapMode && drawingTool && (
                      <rect
                        width="1000"
                        height="650"
                        fill="transparent"
                        className="cursor-crosshair"
                        onClick={handleMapClick}
                        onMouseMove={handleMapMouseMove}
                      />
                    )}

                    {/* Alert Badges pulsantes renderizados por cima de tudo */}
                    {!isEditMapMode && activeBlocos.map((building) => {
                      const stats = getBuildingStats(building.zona);
                      if (stats.alertsCount === 0) return null;
                      return (
                        <g
                          key={`alert-${building.id}`}
                          className={cn(
                            "pointer-events-none transition-opacity duration-300",
                            isBuildingDimmed(building.zona) ? 'opacity-30' : 'opacity-100'
                          )}
                        >
                          <circle cx={building.badge_x} cy={building.badge_y} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                          <circle cx={building.badge_x} cy={building.badge_y} r="5" fill="#ef4444" className="pulsing-alert-ring" />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Glassmorphic Tooltip Flutuante */}
                  {hoveredBuilding && (() => {
                    const bInfo = activeBlocos.find(b => b.id === hoveredBuilding);
                    if (!bInfo) return null;
                    const stats = getBuildingStats(bInfo.zona);
                    return (
                      <div
                        className="absolute pointer-events-none z-50 backdrop-blur-md bg-slate-900/90 border border-slate-700/80 text-white rounded-xl p-3 shadow-xl space-y-1 text-xs transition-all duration-150"
                        style={{
                          left: `${tooltipPos.x + 15}px`,
                          top: `${tooltipPos.y + 15}px`,
                        }}
                      >
                        <div className="font-extrabold text-sm text-emerald-400">
                          {bInfo.nome}
                        </div>
                        <div className="text-[9px] text-slate-300 font-semibold uppercase tracking-wider">
                          Setor: {mapZonaName[bInfo.zona]}
                        </div>
                        <div className="border-t border-slate-800 my-1 pt-1 space-y-0.5 text-slate-400">
                          <div>Salas cadastradas: <span className="text-white font-bold">{stats.roomsCount}</span></div>
                          <div>Ocorrências em aberto: <span className={cn("font-bold", stats.alertsCount > 0 ? "text-red-400" : "text-emerald-400")}>{stats.alertsCount}</span></div>
                          <div>Última conservação: <span className="text-white font-medium">{stats.lastCheckin}</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Side Panel: Selected Zone Info OR Block Editor */}
            <div className="lg:col-span-4">
              {isEditMapMode ? (
                <Card className="border shadow-sm bg-white rounded-2xl h-full flex flex-col">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm font-extrabold uppercase text-slate-800 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                      {!editingBloco ? 'Configurar Blocos' : 'Editar Bloco'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {!editingBloco 
                        ? 'Crie, edite ou remova os blocos interativos do campus.' 
                        : 'Preencha os dados do bloco e utilize as ferramentas de desenho no mapa.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto pt-4 space-y-4">
                    {!editingBloco ? (
                      <div className="space-y-4">
                        <Button
                          onClick={() => setEditingBloco({
                            nome: '',
                            zona: 'academico',
                            geometria_tipo: 'polygon',
                            geometria_data: {}
                          })}
                          className="w-full h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar Novo Bloco
                        </Button>
                        <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
                          {activeBlocos.map(bloco => (
                            <div key={bloco.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-700 truncate">{bloco.nome}</div>
                                <div className="text-[10px] text-slate-400 capitalize">{mapZonaName[bloco.zona] || bloco.zona} ({bloco.geometria_tipo})</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingBloco(bloco)}
                                  className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteBloco(bloco.id)}
                                  className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Nome do Bloco</label>
                          <Input
                            value={editingBloco.nome || ''}
                            onChange={e => setEditingBloco({ ...editingBloco, nome: e.target.value })}
                            placeholder="Ex: Bloco Acadêmico Central"
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Zona Funcional</label>
                          <Select
                            value={editingBloco.zona || 'academico'}
                            onValueChange={val => setEditingBloco({ ...editingBloco, zona: val as any })}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Selecione a zona..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="academico">Acadêmico (Roxo)</SelectItem>
                              <SelectItem value="administrativo">Administrativo (Laranja)</SelectItem>
                              <SelectItem value="esportivo">Esportivo (Amarelo)</SelectItem>
                              <SelectItem value="servicos">Serviços (Azul)</SelectItem>
                              <SelectItem value="convivencia">Convivência (Verde-limão)</SelectItem>
                              <SelectItem value="apoio_tecnico">Apoio Técnico (Ciano)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <div className="text-xs font-bold text-slate-700">Desenhar Delimitação no Mapa</div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant={drawingTool === 'polygon' ? 'default' : 'outline'}
                              onClick={() => {
                                setDrawingTool('polygon');
                                setTempPoints([]);
                              }}
                              className="h-8 text-[11px] font-semibold"
                            >
                              Polígono {editingBloco.geometria_tipo === 'polygon' && "✓"}
                            </Button>
                            <Button
                              type="button"
                              variant={drawingTool === 'rect' ? 'default' : 'outline'}
                              onClick={() => {
                                setDrawingTool('rect');
                                setRectStartPoint(null);
                              }}
                              className="h-8 text-[11px] font-semibold"
                            >
                              Retângulo {editingBloco.geometria_tipo === 'rect' && "✓"}
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant={drawingTool === 'circle' ? 'default' : 'outline'}
                              onClick={() => {
                                setDrawingTool('circle');
                                setCircleCenter(null);
                              }}
                              className="h-8 text-[11px] font-semibold"
                            >
                              Círculo {editingBloco.geometria_tipo === 'circle' && "✓"}
                            </Button>
                            <Button
                              type="button"
                              variant={drawingTool === 'badge' ? 'default' : 'outline'}
                              onClick={() => setDrawingTool('badge')}
                              className="h-8 text-[11px] font-semibold"
                            >
                              Posição Alerta {editingBloco.badge_x && "✓"}
                            </Button>
                          </div>

                          {drawingTool && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1.5">
                              {drawingTool === 'polygon' && (
                                <>
                                  <span className="font-extrabold">Polígono Ativo:</span>
                                  <p>Clique no mapa para adicionar pontos. Para fechar o polígono, clique novamente no primeiro ponto (verde) ou clique no botão abaixo.</p>
                                  {tempPoints.length > 0 && (
                                    <div className="flex gap-2 pt-1">
                                      <Button size="xs" variant="outline" className="h-6 text-[10px]" onClick={concludePolygon}>
                                        Concluir ({tempPoints.length})
                                      </Button>
                                      <Button size="xs" variant="ghost" className="h-6 text-[10px] text-rose-600 hover:text-rose-700" onClick={() => setTempPoints(tempPoints.slice(0, -1))}>
                                        Desfazer
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                              {drawingTool === 'rect' && (
                                <>
                                  <span className="font-extrabold">Retângulo Ativo:</span>
                                  <p>{!rectStartPoint ? "Clique no mapa para definir o canto de início." : "Mova o mouse e clique para definir o canto oposto."}</p>
                                </>
                              )}
                              {drawingTool === 'circle' && (
                                <>
                                  <span className="font-extrabold">Círculo Ativo:</span>
                                  <p>{!circleCenter ? "Clique no mapa para definir o ponto central." : "Mova o mouse e clique para definir o raio do círculo."}</p>
                                </>
                              )}
                              {drawingTool === 'badge' && (
                                <>
                                  <span className="font-extrabold">Posicionador de Alerta Ativo:</span>
                                  <p>Clique em qualquer ponto do mapa para definir onde o indicador de ocorrências vermelho será exibido.</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingBloco(null);
                              setDrawingTool(null);
                              setTempPoints([]);
                            }}
                            className="flex-1 h-9 text-xs"
                          >
                            Voltar
                          </Button>
                          <Button
                            onClick={handleSaveBloco}
                            className="flex-1 h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border shadow-sm bg-white rounded-2xl h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                      {selectedZona ? `Setor: ${mapZonaName[selectedZona]}` : 'Todos os Ambientes'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedZona 
                        ? 'Salas cadastradas pertencentes a esta zona funcional.' 
                        : 'Selecione uma zona no mapa para filtrar.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto max-h-[350px] space-y-2">
                    {filteredAmbientesByZona.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 italic text-xs">
                        Nenhum ambiente cadastrado nesta zona.
                      </div>
                    ) : (
                      filteredAmbientesByZona.map((amb) => {
                        const roomOcorrencias = ocorrencias.filter((o) => o.ambiente_id === amb.id && o.status === 'pendente');
                        const roomCheckins = checkins.filter((ch) => ch.ambiente_id === amb.id);
                        const lastCheckin = roomCheckins[0];

                        return (
                          <div key={amb.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">{amb.nome}</div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                                <span className="uppercase bg-slate-100 px-1 rounded font-bold">{amb.codigo}</span>
                                {amb.bloco && <span>• {amb.bloco}</span>}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {lastCheckin 
                                  ? `Última limpeza: ${new Date(lastCheckin.created_at).toLocaleDateString()} ${new Date(lastCheckin.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                  : 'Sem registro de limpeza'}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              {roomOcorrencias.length > 0 ? (
                                <Badge className="bg-red-100 hover:bg-red-100 text-red-700 text-[9px] border-none font-bold py-0.5 px-1.5">
                                  {roomOcorrencias.length} alerta{roomOcorrencias.length > 1 && 's'}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 text-[9px] border-none font-bold py-0.5 px-1.5">
                                  OK / Limpo
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chart 1: Material Consumption */}
            <div className="bg-white p-4 border rounded-2xl shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                Consumo Geral de Insumos
              </h4>
              <div className="h-64 w-full">
                {materialsChartData.every(d => d.quantidade === 0) ? (
                  <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                    Nenhum consumo de material registrado ainda.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={materialsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <RechartsTooltip />
                      <Bar dataKey="quantidade" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Ratings */}
            <div className="bg-white p-4 border rounded-2xl shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                Distribuição de Avaliações
              </h4>
              <div className="h-64 w-full flex items-center justify-center">
                {ocorrencias.length === 0 ? (
                  <div className="text-slate-400 italic text-xs">
                    Nenhuma avaliação registrada ainda.
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col md:flex-row items-center justify-around">
                    <div className="h-44 w-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ratingChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {ratingChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={ratingColors[index % ratingColors.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5">
                      {ratingChartData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ratingColors[index] }} />
                          <span className="font-semibold text-slate-700">{item.name}:</span>
                          <span className="font-black text-slate-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 1: Ocorrencias */}
        <TabsContent value="ocorrencias">
          <DataTablePanel title="Relatos de Problemas" description="Feed de feedbacks recebidos dos usuários em tempo real.">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-12">Avaliação</TableHead>
                  <TableHead className="w-1/4">Problemas Relatados</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-40">Data de Envio</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredOcorrencias.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-28 text-center italic text-muted-foreground">Nenhuma ocorrência encontrada.</TableCell></TableRow>
                ) : (
                  filteredOcorrencias.map((oc) => (
                    <TableRow key={oc.id} className={cn('hover:bg-slate-50/50', oc.status === 'pendente' && 'bg-red-50/20')}>
                      <TableCell className="align-top">
                        <div className="font-semibold text-slate-900">{oc.ambiente?.nome}</div>
                        <div className="text-xs font-mono text-slate-500">{oc.ambiente?.codigo}</div>
                      </TableCell>
                      <TableCell className="align-top font-bold text-center">
                        <span className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs text-white',
                          oc.avaliacao <= 2 ? 'bg-red-500' : oc.avaliacao === 3 ? 'bg-amber-500' : 'bg-emerald-500'
                        )}>
                          {oc.avaliacao}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {oc.problemas.length > 0 ? (
                            oc.problemas.map((prob) => (
                              <Badge key={prob} variant="secondary" className="bg-slate-100 text-slate-700 capitalize border-none text-[10px]">
                                {prob.replace('_', ' ')}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">Tudo certo/Limpo</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-600 max-w-xs truncate">
                        {oc.observacao || <span className="italic text-slate-400">Sem observações</span>}
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-500">
                        {formatDateTime(oc.created_at)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary" className={cn(
                          'text-[10px] border font-medium px-2 py-0.5',
                          oc.status === 'pendente' && 'border-red-200 bg-red-50 text-red-700',
                          oc.status === 'resolvido' && 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        )}>
                          {oc.status === 'pendente' ? 'Pendente' : 'Resolvido'}
                        </Badge>
                        {oc.status === 'resolvido' && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            em {formatDateTime(oc.resolvido_em)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        {oc.status === 'pendente' ? (
                          <Button onClick={() => void handleResolveOcorrencia(oc.id)} size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8 px-3">
                            Resolver
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tratada</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>

        {/* Tab 2: Checkins */}
        <TabsContent value="checkins">
          <DataTablePanel title="Diário de Conservação" description="Logs de passagens registrados pelas equipes de limpeza do campus.">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-1/4">Responsável</TableHead>
                  <TableHead className="w-1/4">Ações Realizadas</TableHead>
                  <TableHead>Observações / Consumos</TableHead>
                  <TableHead className="w-40 text-right">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredCheckins.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-28 text-center italic text-muted-foreground">Nenhum check-in registrado.</TableCell></TableRow>
                ) : (
                  filteredCheckins.map((ch) => (
                    <TableRow key={ch.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{ch.ambiente?.nome}</div>
                        <div className="text-xs font-mono text-slate-500">{ch.ambiente?.codigo}</div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {ch.responsavel_nome}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ch.acoes_realizadas && ch.acoes_realizadas.length > 0 ? (
                            ch.acoes_realizadas.map((acao) => (
                              <Badge key={acao} variant="secondary" className={cn('text-[10px] border font-medium px-2 py-0.5', mapAcaoBadge[acao])}>
                                {mapAcaoLabel[acao] || acao}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Nenhuma ação</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs align-top">
                        <div className="space-y-1">
                          {ch.observacao && <div>{ch.observacao}</div>}
                          {ch.materiais && ch.materiais.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ch.materiais.map((mat) => (
                                <span key={mat.material} className="inline-flex items-center text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-bold font-mono">
                                  {materialEmojis[mat.material] || '📦'} {mat.quantidade}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 text-right">
                        {formatDateTime(ch.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>

        {/* Tab 3: Ambientes */}
        <TabsContent value="ambientes">
          <DataTablePanel
            title="Ambientes Monitorados"
            description="Lista de todos os espaços físicos que possuem QR Code de identificação."
            actions={
              filteredAmbientes.length > 0 && (
                <Button
                  onClick={printAllQrCodes}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Todos ({filteredAmbientes.length})
                </Button>
              )
            }
          >
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Código</TableHead>
                  <TableHead className="w-1/4">Nome do Espaço</TableHead>
                  <TableHead className="w-1/6">Bloco</TableHead>
                  <TableHead className="w-1/6">Tipo de Espaço</TableHead>
                  <TableHead className="w-1/6">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredAmbientes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center italic text-muted-foreground">Nenhum ambiente encontrado.</TableCell></TableRow>
                ) : (
                  filteredAmbientes.map((amb) => (
                    <TableRow key={amb.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono font-semibold text-slate-700">{amb.codigo}</TableCell>
                      <TableCell className="font-medium text-slate-900">{amb.nome}</TableCell>
                      <TableCell>{amb.bloco || '-'}</TableCell>
                      <TableCell className="capitalize text-slate-600">{amb.tipo}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5">
                          Ativo
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={() => setQrCodeData({ codigo: amb.codigo, nome: amb.nome })} size="sm" variant="outline" className="h-8 gap-1.5 text-slate-700">
                            <QrCode className="h-3.5 w-3.5" />
                            QR Code
                          </Button>
                          <Button onClick={() => void handleDeleteRoom(amb.id)} size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50 p-2">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>
      </Tabs>

      {/* Modal: Add Room */}
      <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl shadow-lifted">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">Cadastrar Novo Ambiente</DialogTitle>
            <DialogDescription>Crie o cadastro de um espaço do campus para gerar seu QR Code de controle.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateRoom(e)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Código Único (ex: SALA-101, BANHEIRO-A)</label>
              <Input required value={newRoom.codigo} onChange={(e) => setNewRoom({ ...newRoom, codigo: e.target.value })} placeholder="SALA-101" className="h-10 input-system" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Nome do Ambiente (ex: Sala de Aula 101)</label>
              <Input required value={newRoom.nome} onChange={(e) => setNewRoom({ ...newRoom, nome: e.target.value })} placeholder="Sala de Aula 101" className="h-10 input-system" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Bloco (ex: Bloco A)</label>
                <Input value={newRoom.bloco} onChange={(e) => setNewRoom({ ...newRoom, bloco: e.target.value })} placeholder="Bloco A" className="h-10 input-system" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tipo</label>
                <Select value={newRoom.tipo} onValueChange={(value) => setNewRoom({ ...newRoom, tipo: value as Ambiente['tipo'] })}>
                  <SelectTrigger className="h-10 input-system">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sala">Sala de Aula</SelectItem>
                    <SelectItem value="banheiro">Banheiro</SelectItem>
                    <SelectItem value="laboratorio">Laboratório</SelectItem>
                    <SelectItem value="corredor">Corredor/Hall</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Zona do Campus</label>
              <Select value={newRoom.zona || 'academico'} onValueChange={(value) => setNewRoom({ ...newRoom, zona: value as Ambiente['zona'] })}>
                <SelectTrigger className="h-10 input-system">
                  <SelectValue placeholder="Selecione a zona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academico">Acadêmico</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="esportivo">Esportivo</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="convivencia">Convivência</SelectItem>
                  <SelectItem value="apoio_tecnico">Apoio Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddRoomOpen(false)} className="h-10">
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 shadow-sm">
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: QR Code Preview & Print */}
      <Dialog open={qrCodeData !== null} onOpenChange={(open) => { if (!open) setQrCodeData(null); }}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-2xl shadow-lifted">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">QR Code do Ambiente</DialogTitle>
            <DialogDescription>Imprima a etiqueta e cole na entrada do ambiente correspondente.</DialogDescription>
          </DialogHeader>

          {/* Configuration for phone testing */}
          <div className="space-y-1 my-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">URL Base do QR Code (para celular)</label>
            <Input
              value={qrBaseUrl}
              onChange={(e) => {
                const val = e.target.value;
                setQrBaseUrl(val);
                localStorage.setItem('manutencao:qr_base_url', val);
              }}
              placeholder="Ex: http://192.168.1.15:5180"
              className="h-9 text-xs input-system"
            />
            <p className="text-[10px] text-muted-foreground leading-normal mt-1">
              Se for ler com o celular, substitua <strong>localhost</strong> pelo IP da rede do seu computador (ex: <strong>http://10.50.6.5:5180</strong>). Dispositivos na mesma rede Wi-Fi conseguirão carregar a página.
            </p>
          </div>

          {/* QR Card Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border rounded-2xl my-2" id="printable-qr-card">
            <div className="text-[#10b981] font-black text-xl tracking-tight mb-0.5">GovAnalytics</div>
            <div className="text-slate-800 font-extrabold text-sm text-center mb-1">Controle de Limpeza e Manutenção</div>
            <div className="text-slate-400 text-[10px] text-center max-w-xs leading-normal mb-4">
              Aponte a câmera do celular para este QR Code para relatar problemas ou registrar limpeza.
            </div>

            {qrCodeData && (
              <div className="bg-white p-3 border rounded-xl shadow-sm mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    qrBaseUrl + '/feedback-ambiente/' + qrCodeData.codigo
                  )}`}
                  width="200"
                  height="200"
                  alt="QR Code"
                  className="rounded-lg"
                />
              </div>
            )}

            <div className="w-full bg-slate-200/60 p-3 rounded-xl text-center">
              <div className="text-slate-900 font-extrabold text-sm">{qrCodeData?.nome}</div>
              <div className="text-slate-500 font-mono text-[11px] mt-0.5">{qrCodeData?.codigo}</div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {qrCodeData && (
              <a
                href={`${qrBaseUrl}/feedback-ambiente/${qrCodeData.codigo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#10b981] hover:underline font-semibold mr-auto pl-2"
              >
                Testar link público
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button type="button" variant="ghost" onClick={() => setQrCodeData(null)} className="h-10">
              Fechar
            </Button>
            <Button onClick={printQrCode} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 gap-2 shadow-sm">
              <Printer className="h-4 w-4" />
              Imprimir Etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
