import { useEffect, useState, useRef, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Maximize2,
  Plus,
  Printer,
  QrCode,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { ChartPanel } from '@/components/design-system/ChartPanel';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  type Ambiente,
  type Checkin,
  manutencaoService,
  type Ocorrencia,
  type BlocoMapa,
} from '@/services/manutencao';
import { countOpenOccurrencesByBloco, filterAmbientesByBloco } from '@/utils/manutencaoMap';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

const problemLabels: Record<string, string> = {
  falta_papel_higienico: 'Falta Papel Higiênico',
  falta_papel_toalha: 'Falta Papel Toalha',
  falta_sabonete: 'Falta Sabonete',
  lixeira_cheia: 'Lixeira Cheia',
  vazamento: 'Vazamento Hidráulico',
  mau_cheiro: 'Mau Cheiro / Odor',
  ar_condicionado: 'Falha no Ar Condicionado',
  lampada_queimada: 'Lâmpada / Elétrica',
  limpeza_geral: 'Limpeza Pesada',
  sujeira_piso: 'Piso Sujo',
};

const tipoLabels: Record<string, string> = {
  banheiro: 'Banheiro',
  sala: 'Sala de Aula',
  laboratorio: 'Laboratório',
  corredor: 'Convivência / Foyer',
  outros: 'Outros Espaços',
};

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
  limpeza_padrao: 'border-info/20 bg-info/10 text-info',
  reposicao_insumos: 'border-purple-200 bg-purple-50 text-purple-700',
  inspecao: 'border-amber-200 bg-amber-50 text-amber-700',
  manutencao_corretiva: 'border-red-200 bg-red-50 text-red-700',
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

const LOCAL_DEFAULT_BLOCOS: BlocoMapa[] = [
  { id: 'lab_energias', nome: 'Laboratório de Energias Renováveis e Hidroponia', badge_x: 331, badge_y: 122, geometria_tipo: 'rect', geometria_data: { x: 257, y: 85, width: 148, height: 75, rx: 5 } },
  { id: 'ginasio', nome: 'Ginásio Poliesportivo', badge_x: 417, badge_y: 316, geometria_tipo: 'rect', geometria_data: { x: 303, y: 247, width: 217, height: 137, rx: 6 } },
  { id: 'bloco_central', nome: 'Bloco Acadêmico Central', badge_x: 611, badge_y: 191, geometria_tipo: 'rect', geometria_data: { x: 554, y: 147, width: 114, height: 87, rx: 5 } },
  { id: 'bloco_salas', nome: 'Bloco de Sala de Aula', badge_x: 611, badge_y: 384, geometria_tipo: 'rect', geometria_data: { x: 554, y: 309, width: 114, height: 150, rx: 5 } },
  { id: 'passarela', nome: 'Área de Convivência e Passarelas', badge_x: 510, badge_y: 300, geometria_tipo: 'rect', geometria_data: { x: 502, y: 147, width: 34, height: 312, rx: 4 } },
  { id: 'administracao', nome: 'Administração', badge_x: 753, badge_y: 378, geometria_tipo: 'rect', geometria_data: { x: 691, y: 347, width: 126, height: 62, rx: 5 } },
  { id: 'biblioteca', nome: 'Biblioteca', badge_x: 862, badge_y: 365, geometria_tipo: 'rect', geometria_data: { x: 828, y: 210, width: 68, height: 312, rx: 5 } },
  { id: 'complexo_aquatico', nome: 'Complexo Aquático / Piscina', badge_x: 753, badge_y: 256, geometria_tipo: 'rect', geometria_data: { x: 702, y: 210, width: 103, height: 94, rx: 5 } },
  { id: 'auditorio', nome: 'Auditório', badge_x: 611, badge_y: 529, geometria_tipo: 'path', geometria_data: { d: "M 512 503 H 656 A 72 72 0 0 1 512 503" } },
  { id: 'torre_agua', nome: 'Torre de Água Principal', badge_x: 519, badge_y: 297, geometria_tipo: 'circle', geometria_data: { cx: 519, cy: 297, r: 16 } },
  { id: 'torre_comunicacao', nome: 'Torre de Observação / Comunicação', badge_x: 793, badge_y: 135, geometria_tipo: 'circle', geometria_data: { cx: 793, cy: 135, r: 18 } }
];

export default function ManutencaoAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [blocosMapa, setBlocosMapa] = useState<BlocoMapa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Global Table Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [chFilterAcao, setChFilterAcao] = useState('todos');
  const [ocFilterNota, setOcFilterNota] = useState('todos');
  const [consumoGrouping, setConsumoGrouping] = useState<'ambiente' | 'dia' | 'amb_dia'>('amb_dia');

  // Mapa Table Filters
  const [mapaSearchQuery, setMapaSearchQuery] = useState('');
  const [mapaStatusFilter, setMapaStatusFilter] = useState<string>('todos');
  const [mapaTipoFilter, setMapaTipoFilter] = useState<string>('todos');

  // Dashboard Filters
  const [dashViewMode, setDashViewMode] = useState<'avaliacoes' | 'insumos'>('avaliacoes');
  const [dashPeriodFilter, setDashPeriodFilter] = useState<'mes_atual' | '7d' | '30d' | 'hoje' | 'todos'>('mes_atual');
  const [dashBlocoFilter, setDashBlocoFilter] = useState<string>('todos');
  const [dashTipoFilter, setDashTipoFilter] = useState<string>('todos');

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    codigo: '',
    nome: '',
    bloco: '',
    tipo: 'sala' as Ambiente['tipo'],
  });

  const [qrCodeData, setQrCodeData] = useState<{ codigo: string; nome: string } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string; desc?: string } | null>(null);
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    return localStorage.getItem('manutencao:qr_base_url') || window.location.origin;
  });

  // Consumo Drilldown States
  const [isConsumoDrilldownOpen, setIsConsumoDrilldownOpen] = useState(false);
  const [consumoDrilldownSearch, setConsumoDrilldownSearch] = useState('');
  const [consumoDrilldownFilterDate, setConsumoDrilldownFilterDate] = useState<string | null>(null);
  const [consumoDrilldownFilterMaterial, setConsumoDrilldownFilterMaterial] = useState<string | null>(null);

  // Limpezas Drilldown States
  const [isLimpezasDrilldownOpen, setIsLimpezasDrilldownOpen] = useState(false);
  const [limpezasDrilldownSearch, setLimpezasDrilldownSearch] = useState('');
  const [limpezasDrilldownFilterDate, setLimpezasDrilldownFilterDate] = useState<string | null>(null);
  const [limpezasDrilldownFilterAcao, setLimpezasDrilldownFilterAcao] = useState<string>('todos');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ambList, ocList, chList] = await Promise.all([
        manutencaoService.getAmbientes(),
        manutencaoService.getOcorrencias(),
        manutencaoService.getCheckins(),
      ]);
      setAmbientes(ambList);
      setOcorrencias(ocList);
      setCheckins(chList);

      let blocosList = await manutencaoService.getBlocosMapa();
      const hasSeeded = localStorage.getItem('manutencao:map_seeded') === 'true';
      if (blocosList.length === 0 && !hasSeeded) {
        try {
          await Promise.all(
            LOCAL_DEFAULT_BLOCOS.map((bloco) => manutencaoService.saveBlocoMapa(bloco))
          );
          blocosList = await manutencaoService.getBlocosMapa();
          localStorage.setItem('manutencao:map_seeded', 'true');
        } catch (seedErr) {
          console.error("Erro ao auto-popular blocos:", seedErr);
        }
      }
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
        status: 'ativo',
      });
      toast.success('Ambiente cadastrado com sucesso!');
      setIsAddRoomOpen(false);
      setNewRoom({ codigo: '', nome: '', bloco: '', tipo: 'sala' });
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
            .logo-img {
              height: 70px;
              object-fit: contain;
              margin-bottom: 15px;
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
            <img class="logo-img" src="/logo-ifrn-cn.png" alt="Logo IFRN" />
            <div class="title">Ajude-nos a melhorar este ambiente!</div>
            <div class="subtitle">Escaneie o QR Code para avaliar este espaço ou informar qualquer problema encontrado.</div>
            <img class="qr-image" src="${qrCodeUrl}" width="230" height="230" alt="QR Code" />
            <div class="room-info">${qrCodeData?.nome}</div>
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
          <img class="logo-img" src="/logo-ifrn-cn.png" alt="Logo IFRN" />
          <div class="title">Ajude-nos a melhorar este ambiente!</div>
          <div class="subtitle">Escaneie o QR Code para avaliar este espaço ou informar qualquer problema encontrado.</div>
          <img class="qr-image" src="${qrCodeUrl}" width="200" height="200" alt="QR Code" />
          <div class="room-info">${amb.nome}</div>
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
            .logo-img {
              height: 55px;
              object-fit: contain;
              margin-bottom: 10px;
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

  // Table Filter calculations
  const filteredOcorrencias = useMemo(() => {
    return ocorrencias.filter((oc) => {
      const matchesSearch =
        !searchQuery ||
        oc.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        oc.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        oc.observacao?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        oc.problemas.some((p) => (problemLabels[p] || p).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'pendente' && oc.status === 'pendente') ||
        (statusFilter === 'resolvido' && oc.status === 'resolvido');

      const matchesNota =
        ocFilterNota === 'todos' || String(oc.avaliacao) === ocFilterNota;

      return matchesSearch && matchesStatus && matchesNota;
    });
  }, [ocorrencias, searchQuery, statusFilter, ocFilterNota]);

  const filteredCheckins = useMemo(() => {
    return checkins.filter((ch) => {
      const matchesSearch =
        !searchQuery ||
        ch.ambiente?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.ambiente?.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.responsavel_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.observacao?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.materiais?.some((m) => (materialLabels[m.material] || m.material).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesAcao =
        chFilterAcao === 'todos' || (ch.acoes_realizadas && ch.acoes_realizadas.includes(chFilterAcao));

      return matchesSearch && matchesAcao;
    });
  }, [checkins, searchQuery, chFilterAcao]);

  const filteredAmbientes = useMemo(() => {
    return ambientes.filter((amb) => {
      return (
        !searchQuery ||
        amb.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        amb.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        amb.bloco?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [ambientes, searchQuery]);

  const [selectedBlocoId, setSelectedBlocoId] = useState<string | null>(null);
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

  const activeBlocos = blocosMapa.length > 0 ? blocosMapa : LOCAL_DEFAULT_BLOCOS;
  const selectedBloco = activeBlocos.find((bloco) => bloco.id === selectedBlocoId) || null;

  const renderGeometria = (bloco: BlocoMapa | Partial<BlocoMapa>, isHoveredOrSelected: boolean) => {
    if (!bloco.geometria_tipo || !bloco.geometria_data) return null;
    const fill = isHoveredOrSelected ? 'rgba(47, 158, 65, 0.22)' : 'rgba(255, 255, 255, 0.01)';
    const stroke = isHoveredOrSelected ? '#2f9e41' : 'transparent';
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
    if (!editingBloco || !editingBloco.nome) {
      toast.error("O nome do bloco é obrigatório.");
      return;
    }
    if (!editingBloco.geometria_tipo || !editingBloco.geometria_data) {
      toast.error("Delimite o bloco no mapa primeiro.");
      return;
    }

    // Validação de sobreposição para evitar múltiplos blocos no mesmo lugar
    const getBoundingBox = (tipo: string, data: any) => {
      if (tipo === 'rect') {
        const x = Number(data.x);
        const y = Number(data.y);
        const w = Number(data.width);
        const h = Number(data.height);
        return { minX: x, maxX: x + w, minY: y, maxY: y + h };
      }
      if (tipo === 'circle') {
        const cx = Number(data.cx);
        const cy = Number(data.cy);
        const r = Number(data.r);
        return { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r };
      }
      if (tipo === 'polygon') {
        const pointsStr = data.points || '';
        const pairs = pointsStr.trim().split(/\s+/);
        const xs: number[] = [];
        const ys: number[] = [];
        pairs.forEach((pair: string) => {
          const [xStr, yStr] = pair.split(',');
          if (xStr && yStr) {
            xs.push(Number(xStr));
            ys.push(Number(yStr));
          }
        });
        if (xs.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        };
      }
      if (tipo === 'path') {
        return { minX: 512, maxX: 656, minY: 431, maxY: 503 };
      }
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    };

    const getOverlapPercentage = (boxA: any, boxB: any) => {
      const xOverlap = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX);
      const yOverlap = Math.min(boxA.maxY, boxB.maxY) - Math.max(boxA.minY, boxB.minY);
      
      if (xOverlap <= 0 || yOverlap <= 0) return 0;
      
      const overlapArea = xOverlap * yOverlap;
      const areaA = (boxA.maxX - boxA.minX) * (boxA.maxY - boxA.minY);
      const areaB = (boxB.maxX - boxB.minX) * (boxB.maxY - boxB.minY);
      
      if (areaA <= 0 || areaB <= 0) return 0;
      return Math.max(overlapArea / areaA, overlapArea / areaB);
    };

    const newBox = getBoundingBox(editingBloco.geometria_tipo, editingBloco.geometria_data);
    const hasOverlap = activeBlocos.some(bloco => {
      if (bloco.id === editingBloco.id) return false;
      const otherBox = getBoundingBox(bloco.geometria_tipo, bloco.geometria_data);
      const overlapPct = getOverlapPercentage(newBox, otherBox);
      return overlapPct > 0.30; // Bloqueia se houver mais de 30% de sobreposição
    });

    if (hasOverlap) {
      toast.error("Erro: Já existe um bloco definido na mesma área do mapa!");
      return;
    }

    try {
      const payload: BlocoMapa = {
        id: editingBloco.id || `bloco_${Date.now()}`,
        nome: editingBloco.nome,
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

  const handleRestoreDefaults = async () => {
    if (!confirm("Isso apagará todas as customizações e restaurará os 11 blocos padrão. Continuar?")) return;
    try {
      const currentIds = blocosMapa.map(b => b.id);
      await Promise.all(currentIds.map(id => manutencaoService.deleteBlocoMapa(id)));
      await Promise.all(LOCAL_DEFAULT_BLOCOS.map(bloco => manutencaoService.saveBlocoMapa(bloco)));
      localStorage.setItem('manutencao:map_seeded', 'true');
      toast.success("Mapa restaurado para o padrão!");
      void loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar blocos padrão.");
    }
  };

  const handleBlocoClick = (blocoId: string) => {
    setSelectedBlocoId((prev) => (prev === blocoId ? null : blocoId));
  };

  const mapaFilteredAmbientes = useMemo(() => {
    const baseList = filterAmbientesByBloco(ambientes, selectedBloco?.nome);

    return baseList.filter((amb) => {
      if (mapaSearchQuery) {
        const q = mapaSearchQuery.toLowerCase();
        const matchNome = amb.nome.toLowerCase().includes(q);
        const matchCodigo = amb.codigo.toLowerCase().includes(q);
        const matchBloco = amb.bloco?.toLowerCase().includes(q) || false;
        if (!matchNome && !matchCodigo && !matchBloco) return false;
      }

      if (mapaTipoFilter !== 'todos' && amb.tipo !== mapaTipoFilter) {
        return false;
      }

      if (mapaStatusFilter !== 'todos') {
        const pendentesCount = ocorrencias.filter((o) => o.ambiente_id === amb.id && o.status === 'pendente').length;
        const hasCheckins = checkins.some((ch) => ch.ambiente_id === amb.id);

        if (mapaStatusFilter === 'com_alerta' && pendentesCount === 0) return false;
        if (mapaStatusFilter === 'limpos' && (pendentesCount > 0 || !hasCheckins)) return false;
        if (mapaStatusFilter === 'sem_limpeza' && hasCheckins) return false;
      }

      return true;
    });
  }, [ambientes, selectedBloco, mapaSearchQuery, mapaTipoFilter, mapaStatusFilter, ocorrencias, checkins]);

  const getBuildingStats = (blocoNome: string) => {
    const rooms = filterAmbientesByBloco(ambientes, blocoNome);
    const roomIds = new Set(rooms.map((room) => room.id));
    const lastCh = checkins.find(c => roomIds.has(c.ambiente_id));
    return {
      roomsCount: rooms.length,
      alertsCount: countOpenOccurrencesByBloco(ambientes, ocorrencias, blocoNome),
      lastCheckin: lastCh ? new Date(lastCh.created_at).toLocaleDateString('pt-BR') : 'Sem registro',
    };
  };

  const isBuildingDimmed = (blocoId: string) => {
    return selectedBlocoId !== null && selectedBlocoId !== blocoId;
  };

  // Ambientes Map & Blocos Únicos
  const ambienteMap = useMemo(() => {
    const map = new Map<string, Ambiente>();
    ambientes.forEach((a) => map.set(a.id, a));
    return map;
  }, [ambientes]);

  const uniqueBlocos = useMemo(() => {
    const set = new Set<string>();
    ambientes.forEach((a) => {
      if (a.bloco) set.add(a.bloco);
    });
    blocosMapa.forEach((b) => {
      if (b.nome) set.add(b.nome);
    });
    return Array.from(set).sort();
  }, [ambientes, blocosMapa]);

  const isWithinPeriod = (dateIso?: string | null, period: string = 'mes_atual') => {
    if (!dateIso) return false;
    if (period === 'todos') return true;
    const date = new Date(dateIso);
    const now = new Date();
    if (period === 'hoje') {
      return date.toDateString() === now.toDateString();
    }
    if (period === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= past7;
    }
    if (period === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= past30;
    }
    if (period === 'mes_atual') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Dashboard filtered data
  const dashFilteredCheckins = useMemo(() => {
    return checkins.filter((ch) => {
      if (!isWithinPeriod(ch.created_at, dashPeriodFilter)) return false;
      const amb = ambienteMap.get(ch.ambiente_id) || ch.ambiente;
      if (dashBlocoFilter !== 'todos' && amb?.bloco !== dashBlocoFilter) return false;
      if (dashTipoFilter !== 'todos' && amb?.tipo !== dashTipoFilter) return false;
      return true;
    });
  }, [checkins, dashPeriodFilter, dashBlocoFilter, dashTipoFilter, ambienteMap]);

  const dashFilteredOcorrencias = useMemo(() => {
    return ocorrencias.filter((oc) => {
      if (!isWithinPeriod(oc.created_at, dashPeriodFilter)) return false;
      const amb = ambienteMap.get(oc.ambiente_id) || oc.ambiente;
      if (dashBlocoFilter !== 'todos' && amb?.bloco !== dashBlocoFilter) return false;
      if (dashTipoFilter !== 'todos' && amb?.tipo !== dashTipoFilter) return false;
      return true;
    });
  }, [ocorrencias, dashPeriodFilter, dashBlocoFilter, dashTipoFilter, ambienteMap]);

  // Material consumption aggregation
  const dashMaterialsMap = useMemo(() => {
    const map: Record<string, number> = {
      papel_higienico: 0,
      sabonete_liquido: 0,
      papel_toalha: 0,
      saco_lixo: 0,
      outros: 0,
    };
    dashFilteredCheckins.forEach((ch) => {
      ch.materiais?.forEach((mat) => {
        if (map[mat.material] !== undefined) {
          map[mat.material] += mat.quantidade;
        }
      });
    });
    return map;
  }, [dashFilteredCheckins]);

  const dashMaterialsChartData = useMemo(() => {
    return Object.entries(dashMaterialsMap).map(([key, val]) => ({
      key,
      name: materialLabels[key] || key,
      quantidade: val,
    }));
  }, [dashMaterialsMap]);

  const dashTotalMateriais = useMemo(() => {
    return Object.values(dashMaterialsMap).reduce((a, b) => a + b, 0);
  }, [dashMaterialsMap]);

  // Ratings aggregation
  const dashValidRatings = useMemo(() => {
    return dashFilteredOcorrencias.filter((o) => typeof o.avaliacao === 'number' && o.avaliacao > 0);
  }, [dashFilteredOcorrencias]);

  const dashRatingCounts = useMemo(() => ({
    '5 Estrelas': dashValidRatings.filter((o) => o.avaliacao === 5).length,
    '4 Estrelas': dashValidRatings.filter((o) => o.avaliacao === 4).length,
    '3 Estrelas': dashValidRatings.filter((o) => o.avaliacao === 3).length,
    '1-2 Estrelas': dashValidRatings.filter((o) => o.avaliacao <= 2).length,
  }), [dashValidRatings]);

  const dashRatingChartData = useMemo(() => {
    return Object.entries(dashRatingCounts).map(([key, val]) => ({
      name: key,
      value: val,
    }));
  }, [dashRatingCounts]);

  const ratingColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const dashMediaAvaliacoes = useMemo(() => {
    if (dashValidRatings.length === 0) return null;
    const sum = dashValidRatings.reduce((acc, o) => acc + (o.avaliacao || 0), 0);
    return (sum / dashValidRatings.length).toFixed(1);
  }, [dashValidRatings]);

  const dashTaxaResolucao = useMemo(() => {
    if (dashFilteredOcorrencias.length === 0) return 100;
    const resolvidos = dashFilteredOcorrencias.filter((o) => o.status === 'resolvido').length;
    return Math.round((resolvidos / dashFilteredOcorrencias.length) * 100);
  }, [dashFilteredOcorrencias]);

  const dashPendentesCount = useMemo(() => {
    return dashFilteredOcorrencias.filter((o) => o.status === 'pendente').length;
  }, [dashFilteredOcorrencias]);

  const dashMttrText = useMemo(() => {
    const resolvidosComTempo = dashFilteredOcorrencias.filter(
      (o) => o.status === 'resolvido' && o.resolvido_em && o.created_at
    );
    if (resolvidosComTempo.length === 0) return '—';
    const totalMs = resolvidosComTempo.reduce((acc, o) => {
      return acc + (new Date(o.resolvido_em!).getTime() - new Date(o.created_at).getTime());
    }, 0);
    const avgHours = totalMs / resolvidosComTempo.length / (1000 * 60 * 60);
    if (avgHours < 24) return `${Math.round(avgHours)}h`;
    return `${(avgHours / 24).toFixed(1)} dias`;
  }, [dashFilteredOcorrencias]);

  // Timeline series (Limpezas e Insumos dia a dia)
  const dashTimelineData = useMemo(() => {
    const dayMap = new Map<string, { dateStr: string; timestamp: number; limpezas: number; insumos: number }>();
    dashFilteredCheckins.forEach((ch) => {
      const d = new Date(ch.created_at);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (!dayMap.has(key)) {
        dayMap.set(key, { dateStr: key, timestamp: dayStart, limpezas: 0, insumos: 0 });
      }
      const item = dayMap.get(key)!;
      item.limpezas += 1;
      ch.materiais?.forEach((m) => {
        item.insumos += m.quantidade;
      });
    });
    return Array.from(dayMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [dashFilteredCheckins]);

  // Top Problems reported
  const dashProblemsData = useMemo(() => {
    const map: Record<string, number> = {};
    dashFilteredOcorrencias.forEach((oc) => {
      oc.problemas?.forEach((prob) => {
        map[prob] = (map[prob] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([prob, count]) => ({
        problema: problemLabels[prob] || prob.replace(/_/g, ' '),
        quantidade: count,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6);
  }, [dashFilteredOcorrencias]);

  // Top 5 consuming rooms
  const dashTopConsumoAmbientes = useMemo(() => {
    const map = new Map<string, { nome: string; bloco: string; codigo: string; total: number }>();
    dashFilteredCheckins.forEach((ch) => {
      const amb = ambienteMap.get(ch.ambiente_id) || ch.ambiente;
      const ambNome = amb?.nome || 'Ambiente';
      const ambBloco = amb?.bloco || 'Geral';
      const ambCodigo = amb?.codigo || '—';
      const key = ch.ambiente_id;
      if (!map.has(key)) {
        map.set(key, { nome: ambNome, bloco: ambBloco, codigo: ambCodigo, total: 0 });
      }
      const item = map.get(key)!;
      ch.materiais?.forEach((m) => {
        item.total += m.quantidade;
      });
    });
    return Array.from(map.values())
      .filter((a) => a.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [dashFilteredCheckins, ambienteMap]);

  const maxConsumo = dashTopConsumoAmbientes.length > 0 ? dashTopConsumoAmbientes[0].total : 1;

  // Critical environments list
  const dashAmbientesCriticos = useMemo(() => {
    const list: Array<{
      id: string;
      nome: string;
      bloco: string;
      codigo: string;
      pendentes: number;
      media: string | null;
    }> = [];

    ambientes.forEach((amb) => {
      const ambOcorrencias = dashFilteredOcorrencias.filter((o) => o.ambiente_id === amb.id);
      const pendentes = ambOcorrencias.filter((o) => o.status === 'pendente').length;
      const ratings = ambOcorrencias.filter((o) => typeof o.avaliacao === 'number' && o.avaliacao > 0);
      const media = ratings.length > 0
        ? (ratings.reduce((acc, o) => acc + (o.avaliacao || 0), 0) / ratings.length).toFixed(1)
        : null;

      if (pendentes > 0 || (media !== null && Number(media) <= 3.0)) {
        list.push({
          id: amb.id,
          nome: amb.nome,
          bloco: amb.bloco || 'Geral',
          codigo: amb.codigo,
          pendentes,
          media,
        });
      }
    });

    return list.sort((a, b) => b.pendentes - a.pendentes || (Number(a.media || 5) - Number(b.media || 5))).slice(0, 5);
  }, [ambientes, dashFilteredOcorrencias]);

  // Aggregated consumption data calculations
  // Consumo Drilldown Aggregations
  const consumoData = useMemo(() => {
    const map = new Map<string, {
      ambienteNome?: string;
      ambienteCodigo?: string;
      ambienteBloco?: string;
      data?: string;
      papel_higienico: number;
      sabonete_liquido: number;
      papel_toalha: number;
      saco_lixo: number;
      outros: number;
    }>();

    dashFilteredCheckins.forEach((ch) => {
      const dateKey = ch.created_at ? new Date(ch.created_at).toLocaleDateString('pt-BR') : 'Sem data';
      const ambId = ch.ambiente_id;
      const ambNome = ch.ambiente?.nome || 'Ambiente Desconhecido';
      const ambCodigo = ch.ambiente?.codigo || 'S/C';
      const ambBloco = ch.ambiente?.bloco || '-';

      let groupKey = '';
      if (consumoGrouping === 'ambiente') {
        groupKey = ambId;
      } else if (consumoGrouping === 'dia') {
        groupKey = dateKey;
      } else {
        groupKey = `${ambId}_${dateKey}`;
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ambienteNome: consumoGrouping !== 'dia' ? ambNome : undefined,
          ambienteCodigo: consumoGrouping !== 'dia' ? ambCodigo : undefined,
          ambienteBloco: consumoGrouping !== 'dia' ? ambBloco : undefined,
          data: consumoGrouping !== 'ambiente' ? dateKey : undefined,
          papel_higienico: 0,
          sabonete_liquido: 0,
          papel_toalha: 0,
          saco_lixo: 0,
          outros: 0,
        });
      }

      const current = map.get(groupKey)!;
      ch.materiais?.forEach((mat) => {
        if (mat.material === 'papel_higienico') current.papel_higienico += mat.quantidade;
        else if (mat.material === 'sabonete_liquido') current.sabonete_liquido += mat.quantidade;
        else if (mat.material === 'papel_toalha') current.papel_toalha += mat.quantidade;
        else if (mat.material === 'saco_lixo') current.saco_lixo += mat.quantidade;
        else if (mat.material === 'outros') current.outros += mat.quantidade;
      });
    });

    return Array.from(map.values()).map((item) => {
      const total = item.papel_higienico + item.sabonete_liquido + item.papel_toalha + item.saco_lixo + item.outros;
      return { ...item, total };
    }).filter(item => item.total > 0);
  }, [dashFilteredCheckins, consumoGrouping]);

  const filteredConsumoData = useMemo(() => {
    return consumoData.filter((item) => {
      if (consumoDrilldownFilterDate) {
        if (item.data && !item.data.includes(consumoDrilldownFilterDate)) return false;
      }
      if (consumoDrilldownFilterMaterial) {
        const matKey = consumoDrilldownFilterMaterial as 'papel_higienico' | 'sabonete_liquido' | 'papel_toalha' | 'saco_lixo' | 'outros';
        if ((item[matKey] || 0) === 0) return false;
      }
      if (!consumoDrilldownSearch) return true;
      const q = consumoDrilldownSearch.toLowerCase();
      const matchNome = item.ambienteNome?.toLowerCase().includes(q) || false;
      const matchCodigo = item.ambienteCodigo?.toLowerCase().includes(q) || false;
      const matchBloco = item.ambienteBloco?.toLowerCase().includes(q) || false;
      const matchData = item.data?.includes(q) || false;
      return matchNome || matchCodigo || matchBloco || matchData;
    });
  }, [consumoData, consumoDrilldownSearch, consumoDrilldownFilterDate, consumoDrilldownFilterMaterial]);

  const sortedConsumoData = useMemo(() => {
    return [...filteredConsumoData].sort((left, right) => {
      if (consumoGrouping === 'dia') {
        const [dL, mL, yL] = (left.data || '').split('/').map(Number);
        const [dR, mR, yR] = (right.data || '').split('/').map(Number);
        const dateL = new Date(yL || 2026, (mL || 1) - 1, dL || 1).getTime();
        const dateR = new Date(yR || 2026, (mR || 1) - 1, dR || 1).getTime();
        return dateR - dateL;
      }
      if (consumoGrouping === 'ambiente') {
        return right.total - left.total;
      }
      const [dL, mL, yL] = (left.data || '').split('/').map(Number);
      const [dR, mR, yR] = (right.data || '').split('/').map(Number);
      const dateL = new Date(yL || 2026, (mL || 1) - 1, dL || 1).getTime();
      const dateR = new Date(yR || 2026, (mR || 1) - 1, dR || 1).getTime();
      if (dateR !== dateL) return dateR - dateL;
      return right.total - left.total;
    });
  }, [filteredConsumoData, consumoGrouping]);

  // Limpezas Drilldown Aggregation
  const filteredLimpezasDrilldown = useMemo(() => {
    return dashFilteredCheckins.filter((ch) => {
      if (limpezasDrilldownFilterDate) {
        const d = new Date(ch.created_at);
        const dateKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dateKey !== limpezasDrilldownFilterDate) return false;
      }

      if (limpezasDrilldownFilterAcao !== 'todos') {
        if (!ch.acoes_realizadas || !ch.acoes_realizadas.includes(limpezasDrilldownFilterAcao)) {
          return false;
        }
      }

      if (!limpezasDrilldownSearch) return true;
      const q = limpezasDrilldownSearch.toLowerCase();
      const matchAmb = ch.ambiente?.nome?.toLowerCase().includes(q) || ch.ambiente?.codigo?.toLowerCase().includes(q) || ch.ambiente?.bloco?.toLowerCase().includes(q);
      const matchResp = ch.responsavel_nome?.toLowerCase().includes(q);
      const matchObs = ch.observacao?.toLowerCase().includes(q);
      const matchMats = ch.materiais?.some((m) => (materialLabels[m.material] || m.material).toLowerCase().includes(q));

      return matchAmb || matchResp || matchObs || matchMats;
    });
  }, [dashFilteredCheckins, limpezasDrilldownSearch, limpezasDrilldownFilterDate, limpezasDrilldownFilterAcao]);

  const isDashFilterActive = dashPeriodFilter !== 'mes_atual' || dashBlocoFilter !== 'todos' || dashTipoFilter !== 'todos';

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Painel administrativo para controle e inspeção de ambientes via QR Code.</HeaderSubtitle>

      <HeaderActions>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddRoomOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Cadastrar Ambiente
          </Button>
        </div>
      </HeaderActions>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="relative">
        {/* Tabs de Navegação - Layout Folder Tab */}
        <div className="flex items-end justify-between px-0 relative -mb-[1px] z-10 w-full gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              type="button"
              className={`px-5 py-2.5 text-xs font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-emerald-700 shadow-sm relative z-20 pb-[11px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-2.5'
              }`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-xs font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'mapa'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-emerald-700 shadow-sm relative z-20 pb-[11px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-2.5'
              }`}
              onClick={() => setActiveTab('mapa')}
            >
              Visão Geral / Mapa
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-xs font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'ocorrencias'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-emerald-700 shadow-sm relative z-20 pb-[11px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-2.5'
              }`}
              onClick={() => setActiveTab('ocorrencias')}
            >
              Ocorrências ({filteredOcorrencias.length})
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-xs font-bold font-ui transition-all duration-200 border rounded-t-radius-lg whitespace-nowrap ${
                activeTab === 'ambientes'
                  ? 'bg-surface-card border-border-default/80 border-b-surface-card text-emerald-700 shadow-sm relative z-20 pb-[11px]'
                  : 'bg-surface-subtle/30 text-text-muted hover:text-text-primary hover:bg-surface-subtle/60 border-transparent border-b-border-default/80 cursor-pointer relative z-10 pb-2.5'
              }`}
              onClick={() => setActiveTab('ambientes')}
            >
              Salas e Ambientes ({filteredAmbientes.length})
            </button>
          </div>
        </div>

        {/* Tab: Dashboard */}
        <TabsContent value="dashboard" className="mt-0">
          <SectionPanel contentClassName="space-y-6">
            {/* Dashboard Filters Toolbar */}
            <div className="bg-surface-subtle/40 border border-border-default/60 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary pr-1">
                  <Filter className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Filtros do Painel:</span>
                </div>

                {/* Seletor Radio: Avaliações vs Insumos */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                  <label
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-all select-none',
                      dashViewMode === 'avaliacoes'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    )}
                  >
                    <input
                      type="radio"
                      name="dashViewMode"
                      value="avaliacoes"
                      checked={dashViewMode === 'avaliacoes'}
                      onChange={() => setDashViewMode('avaliacoes')}
                      className="sr-only"
                    />
                    <Star className={cn('h-3.5 w-3.5 shrink-0', dashViewMode === 'avaliacoes' ? 'fill-white text-white' : 'text-slate-600')} />
                    <span className={dashViewMode === 'avaliacoes' ? 'text-white font-bold' : 'text-slate-700 font-semibold'}>Avaliações</span>
                  </label>

                  <label
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-all select-none',
                      dashViewMode === 'insumos'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    )}
                  >
                    <input
                      type="radio"
                      name="dashViewMode"
                      value="insumos"
                      checked={dashViewMode === 'insumos'}
                      onChange={() => setDashViewMode('insumos')}
                      className="sr-only"
                    />
                    <Boxes className={cn('h-3.5 w-3.5 shrink-0', dashViewMode === 'insumos' ? 'text-white' : 'text-slate-600')} />
                    <span className={dashViewMode === 'insumos' ? 'text-white font-bold' : 'text-slate-700 font-semibold'}>Insumos</span>
                  </label>
                </div>

                {/* Período */}
                <div className="w-40">
                  <Select value={dashPeriodFilter} onValueChange={(val: any) => setDashPeriodFilter(val)}>
                    <SelectTrigger className="h-8 text-xs bg-white input-system">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mes_atual">Mês Atual</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="todos">Todo o Histórico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bloco */}
                <div className="w-44">
                  <Select value={dashBlocoFilter} onValueChange={setDashBlocoFilter}>
                    <SelectTrigger className="h-8 text-xs bg-white input-system">
                      <SelectValue placeholder="Bloco / Setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Blocos</SelectItem>
                      {uniqueBlocos.map((bloco) => (
                        <SelectItem key={bloco} value={bloco}>
                          {bloco}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Ambiente */}
                <div className="w-36">
                  <Select value={dashTipoFilter} onValueChange={setDashTipoFilter}>
                    <SelectTrigger className="h-8 text-xs bg-white input-system">
                      <SelectValue placeholder="Tipo de Espaço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="banheiro">Banheiros</SelectItem>
                      <SelectItem value="sala">Salas de Aula</SelectItem>
                      <SelectItem value="laboratorio">Laboratórios</SelectItem>
                      <SelectItem value="corredor">Convivência / Foyer</SelectItem>
                      <SelectItem value="outros">Outros Espaços</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isDashFilterActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDashPeriodFilter('mes_atual');
                    setDashBlocoFilter('todos');
                    setDashTipoFilter('todos');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                >
                  Restaurar Padrão
                </Button>
              )}
            </div>

            {/* SEÇÃO 1: MODO AVALIAÇÕES & OCORRÊNCIAS */}
            {dashViewMode === 'avaliacoes' && (
              <div className="space-y-6">
                {/* Executive KPIs: Avaliações e Chamados */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Satisfação Média</span>
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-amber-600">
                      {dashMediaAvaliacoes !== null ? `${dashMediaAvaliacoes}` : '—'}
                      <span className="text-xs font-normal text-text-muted"> ★</span>
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {dashValidRatings.length} avaliações recebidas
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Total de Ocorrências</span>
                      <AlertTriangle className="h-4 w-4 text-rose-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-rose-700">
                      {dashFilteredOcorrencias.length}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {dashPendentesCount} pendência{dashPendentesCount !== 1 && 's'} aberta{dashPendentesCount !== 1 && 's'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Taxa de Resolução</span>
                      <ClipboardList className="h-4 w-4 text-purple-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-purple-700">
                      {dashTaxaResolucao}%
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {dashFilteredOcorrencias.filter(o => o.status === 'resolvido').length} chamados resolvidos
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Tempo Médio Resolução</span>
                      <Clock className="h-4 w-4 text-slate-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-slate-800">
                      {dashMttrText}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      SLA médio de atendimento
                    </div>
                  </div>
                </div>

                {/* Gráficos de Avaliações */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Chart: Ratings Distribution */}
                  <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Distribuição de Avaliações
                      </h4>
                      <p className="text-xs text-text-muted">Nível de satisfação registrado pelos usuários nos ambientes.</p>
                    </div>
                    <div className="h-72 w-full flex items-center justify-center pt-2">
                      {dashValidRatings.length === 0 ? (
                        <div className="text-text-muted italic text-xs">
                          Nenhuma avaliação registrada com os filtros selecionados.
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around gap-4">
                          <div className="h-52 w-52 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={dashRatingChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={78}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {dashRatingChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={ratingColors[index % ratingColors.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  formatter={(val: number, name: string) => {
                                    const pct = dashValidRatings.length > 0 ? Math.round((val / dashValidRatings.length) * 100) : 0;
                                    return [`${val} avaliação(ões) (${pct}%)`, name];
                                  }}
                                  contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2.5 min-w-[170px]">
                            {dashRatingChartData.map((item, index) => {
                              const pct = dashValidRatings.length > 0 ? Math.round((item.value / dashValidRatings.length) * 100) : 0;
                              return (
                                <div key={item.name} className="flex items-center justify-between gap-3 text-xs bg-surface-subtle/40 px-3 py-1.5 rounded-lg border border-border-default/40">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ratingColors[index] }} />
                                    <span className="font-medium text-text-secondary">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-bold text-text-primary">{item.value}</span>
                                    <span className="text-[11px] font-semibold text-text-muted">({pct}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chart: Top Problems Pareto */}
                  <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Principais Problemas Relatados
                      </h4>
                      <p className="text-xs text-text-muted">Ranking de queixas e falhas mais frequentes reportadas pelos usuários.</p>
                    </div>
                    <div className="h-72 w-full pt-2">
                      {dashProblemsData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                          Nenhum problema relatado no período selecionado.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={dashProblemsData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                            <YAxis dataKey="problema" type="category" width={140} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <RechartsTooltip
                              formatter={(val: number) => [`${val} chamado(s)`, 'Ocorrências']}
                              contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                            />
                            <Bar dataKey="quantidade" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Critical Environments / Attention Needed */}
                <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Ambientes com Atenção Prioritária
                    </h4>
                    <span className="text-[10px] text-text-muted font-mono">alertas & notas</span>
                  </div>
                  {dashAmbientesCriticos.length === 0 ? (
                    <div className="py-8 text-center text-emerald-600 font-medium text-xs flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      Todos os ambientes estão operando em conformidade e sem pendências críticas.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {dashAmbientesCriticos.map((amb) => (
                        <div
                          key={amb.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-surface-subtle/40 border border-border-default/50 hover:bg-surface-subtle transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs font-bold text-text-primary truncate">{amb.nome}</div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5">
                              <span className="font-mono bg-white px-1 rounded border border-border-default/50">{amb.codigo}</span>
                              <span>• {amb.bloco}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {amb.media !== null && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                Number(amb.media) <= 2.5 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {amb.media} ★
                              </span>
                            )}
                            {amb.pendentes > 0 ? (
                              <Badge className="bg-red-100 hover:bg-red-100 text-red-700 text-[10px] border-none font-bold py-0.5 px-2">
                                {amb.pendentes} pendente{amb.pendentes > 1 && 's'}
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 text-[10px] border-none font-bold py-0.5 px-2">
                                OK
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEÇÃO 2: MODO INSUMOS & LIMPEZA */}
            {dashViewMode === 'insumos' && (
              <div className="space-y-6">
                {/* Executive KPIs: Limpezas e Insumos */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Limpezas Registradas</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-emerald-700">
                      {dashFilteredCheckins.length}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      intervenções de conservação
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Consumo Total de Insumos</span>
                      <TrendingUp className="h-4 w-4 text-teal-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-teal-700">
                      {dashTotalMateriais}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      unidades / rolos repostos
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1 col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-muted">Média por Intervenção</span>
                      <Boxes className="h-4 w-4 text-blue-600 opacity-70" />
                    </div>
                    <div className="text-2xl font-black text-blue-700">
                      {(dashTotalMateriais / (dashFilteredCheckins.length || 1)).toFixed(1)}
                      <span className="text-xs font-normal text-text-muted"> un</span>
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      insumos por passagem de limpeza
                    </div>
                  </div>
                </div>

                {/* Charts Section: 3 Insumos & Limpezas Visualizations */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Chart 1: Temporal Evolution of Cleanings */}
                  <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Evolução Temporal de Limpezas
                        </h4>
                        <p className="text-xs text-text-muted">Volume diário de passagens e intervenções de conservação.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setLimpezasDrilldownFilterDate(null);
                          setLimpezasDrilldownFilterAcao('todos');
                          setLimpezasDrilldownSearch('');
                          setIsLimpezasDrilldownOpen(true);
                        }}
                        className="h-7 text-xs gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50 shrink-0 font-semibold"
                        title="Abrir detalhamento de limpezas"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Detalhar
                      </Button>
                    </div>
                    <div className="h-72 w-full pt-2">
                      {dashTimelineData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                          Sem registros de limpezas para o período selecionado.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={dashTimelineData}
                            margin={{ top: 10, right: 15, left: -10, bottom: 20 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload.length > 0) {
                                const clickedItem = data.activePayload[0].payload;
                                if (clickedItem && clickedItem.dateStr) {
                                  setLimpezasDrilldownFilterDate(clickedItem.dateStr);
                                  setLimpezasDrilldownFilterAcao('todos');
                                  setIsLimpezasDrilldownOpen(true);
                                }
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <defs>
                              <linearGradient id="colorLimpezas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                            <RechartsTooltip
                              formatter={(val: number) => [`${val} passagem(ns) (clique para detalhar)`, 'Limpezas Realizadas']}
                              contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                            />
                            <Area type="monotone" dataKey="limpezas" name="Limpezas" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLimpezas)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Chart 2: Temporal Evolution of Material Inputs */}
                  <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Evolução Temporal de Insumos
                        </h4>
                        <p className="text-xs text-text-muted">Quantidade diária de materiais e insumos repostos.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setConsumoDrilldownFilterDate(null);
                          setConsumoDrilldownFilterMaterial(null);
                          setConsumoDrilldownSearch('');
                          setIsConsumoDrilldownOpen(true);
                        }}
                        className="h-7 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0 font-semibold"
                        title="Abrir detalhamento de consumo"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Detalhar
                      </Button>
                    </div>
                    <div className="h-72 w-full pt-2">
                      {dashTimelineData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                          Sem registros de reposição para o período selecionado.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={dashTimelineData}
                            margin={{ top: 10, right: 15, left: -10, bottom: 20 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload.length > 0) {
                                const clickedItem = data.activePayload[0].payload;
                                if (clickedItem && clickedItem.dateStr) {
                                  setConsumoDrilldownFilterDate(clickedItem.dateStr);
                                  setConsumoDrilldownFilterMaterial(null);
                                  setIsConsumoDrilldownOpen(true);
                                }
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <defs>
                              <linearGradient id="colorInsumos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                            <RechartsTooltip
                              formatter={(val: number) => [`${val} un (clique para detalhar)`, 'Insumos Repostos']}
                              contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                            />
                            <Area type="monotone" dataKey="insumos" name="Insumos Repostos" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInsumos)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Chart 3: Material Consumption by Category */}
                  <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                          Consumo Geral de Insumos
                        </h4>
                        <p className="text-xs text-text-muted">Distribuição acumulada de reposição por tipo de material no período.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setConsumoDrilldownFilterDate(null);
                          setConsumoDrilldownFilterMaterial(null);
                          setConsumoDrilldownSearch('');
                          setIsConsumoDrilldownOpen(true);
                        }}
                        className="h-7 text-xs gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50 shrink-0 font-semibold"
                        title="Abrir detalhamento de consumo"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Detalhar
                      </Button>
                    </div>
                    <div className="h-72 w-full pt-2">
                      {dashMaterialsChartData.every((d) => d.quantidade === 0) ? (
                        <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                          Nenhum consumo de material registrado com os filtros selecionados.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={dashMaterialsChartData}
                            margin={{ top: 10, right: 20, left: 15, bottom: 40 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload.length > 0) {
                                const clickedItem = data.activePayload[0].payload;
                                if (clickedItem && clickedItem.key) {
                                  setConsumoDrilldownFilterMaterial(clickedItem.key);
                                  setConsumoDrilldownFilterDate(null);
                                  setIsConsumoDrilldownOpen(true);
                                }
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              interval={0}
                              height={45}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                            <RechartsTooltip
                              formatter={(val: number) => [`${val} un (clique para detalhar)`, 'Quantidade']}
                              contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                            />
                            <Bar dataKey="quantidade" fill="#0d9488" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Consuming Environments */}
                <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-emerald-600" />
                      Top 5 Ambientes em Consumo de Insumos
                    </h4>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setConsumoDrilldownFilterDate(null);
                        setConsumoDrilldownFilterMaterial(null);
                        setConsumoDrilldownSearch('');
                        setIsConsumoDrilldownOpen(true);
                      }}
                      className="h-6 text-[11px] text-emerald-700 hover:bg-emerald-50 px-2 font-semibold"
                    >
                      Ver detalhamento
                    </Button>
                  </div>
                  {dashTopConsumoAmbientes.length === 0 ? (
                    <div className="py-8 text-center text-text-muted italic text-xs">
                      Nenhum consumo registrado no período.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {dashTopConsumoAmbientes.map((amb, idx) => {
                        const percentage = Math.round((amb.total / maxConsumo) * 100);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setConsumoDrilldownSearch(amb.codigo);
                              setConsumoDrilldownFilterDate(null);
                              setConsumoDrilldownFilterMaterial(null);
                              setIsConsumoDrilldownOpen(true);
                            }}
                            className="space-y-1.5 p-2.5 rounded-lg border border-border-default/50 bg-surface-subtle/30 hover:bg-emerald-50/60 transition-colors cursor-pointer"
                            title="Clique para ver o detalhamento deste ambiente"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="font-semibold text-text-primary truncate max-w-[180px]">
                                {amb.nome}
                                <span className="text-text-muted font-normal text-[10px] ml-1.5">({amb.bloco})</span>
                              </div>
                              <span className="font-mono font-bold text-emerald-700">{amb.total} un</span>
                            </div>
                            <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionPanel>
        </TabsContent>

        {/* Tab: Visão Geral / Mapa */}
        <TabsContent value="mapa" className="mt-0 space-y-6">
          {/* Campus map */}
          <div className={cn(
            "bg-white p-4 border border-border-default/80 shadow-soft space-y-3 relative z-0 rounded-b-2xl rounded-tr-2xl",
            activeTab === 'mapa' ? 'rounded-tl-none' : 'rounded-tl-2xl'
          )}>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                    Mapa do Campus - Currais Novos
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
                    {selectedBloco && (
                      <Button variant="ghost" size="xs" onClick={() => setSelectedBlocoId(null)} className="text-xs text-rose-500 hover:text-rose-600 font-bold">
                        Limpar Filtro
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Passe o mouse sobre os blocos para informações detalhadas. Clique em um prédio para filtrar seus ambientes.
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
                      const isSelected = selectedBlocoId === bloco.id;
                      const isDimmed = selectedBlocoId !== null && selectedBlocoId !== bloco.id;

                      return (
                        <g
                          key={bloco.id}
                          className={cn(
                            "cursor-pointer transition-all duration-300",
                            isDimmed ? 'opacity-20' : 'opacity-100'
                          )}
                          onClick={() => !isEditMapMode && handleBlocoClick(bloco.id)}
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
                      const stats = getBuildingStats(building.nome);
                      if (stats.alertsCount === 0) return null;
                      return (
                        <g
                          key={`alert-${building.id}`}
                          className={cn(
                            "pointer-events-none transition-opacity duration-300",
                            isBuildingDimmed(building.id) ? 'opacity-30' : 'opacity-100'
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
                    const stats = getBuildingStats(bInfo.nome);
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

              {/* Side Panel / Bottom Card: Selected Zone Info OR Block Editor */}
              {isEditMapMode ? (
                <Card className="border shadow-sm bg-white rounded-2xl">
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
                  <CardContent className="pt-4 space-y-4">
                    {!editingBloco ? (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setEditingBloco({
                              nome: '',
                              geometria_tipo: 'polygon',
                              geometria_data: {}
                            })}
                            className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Novo Bloco
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleRestoreDefaults}
                            className="h-9 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                          >
                            Restaurar Padrão
                          </Button>
                        </div>
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[350px] overflow-y-auto pr-1">
                          {activeBlocos.map(bloco => (
                            <div key={bloco.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-700 truncate">{bloco.nome}</div>
                                <div className="text-[10px] text-slate-400 capitalize">{bloco.geometria_tipo}</div>
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
                      <div className="space-y-4 max-w-2xl">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Nome do Bloco</label>
                          <Input
                            value={editingBloco.nome || ''}
                            onChange={e => setEditingBloco({ ...editingBloco, nome: e.target.value })}
                            placeholder="Ex: Bloco Acadêmico Central"
                            className="h-9 text-xs"
                          />
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
                <DataTablePanel
                  actions={
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="relative w-52">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={mapaSearchQuery}
                          onChange={(e) => setMapaSearchQuery(e.target.value)}
                          placeholder="Buscar no mapa..."
                          className="h-8 pl-8 text-xs input-system"
                        />
                      </div>

                      <Select value={mapaStatusFilter} onValueChange={setMapaStatusFilter}>
                        <SelectTrigger className="h-8 text-xs w-36 input-system">
                          <SelectValue placeholder="Situação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas situações</SelectItem>
                          <SelectItem value="com_alerta">Com alertas</SelectItem>
                          <SelectItem value="limpos">OK / Limpos</SelectItem>
                          <SelectItem value="sem_limpeza">Sem limpeza</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={mapaTipoFilter} onValueChange={setMapaTipoFilter}>
                        <SelectTrigger className="h-8 text-xs w-36 input-system">
                          <SelectValue placeholder="Tipo de Espaço" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os tipos</SelectItem>
                          <SelectItem value="banheiro">Banheiro</SelectItem>
                          <SelectItem value="sala">Sala de Aula</SelectItem>
                          <SelectItem value="laboratorio">Laboratório</SelectItem>
                          <SelectItem value="corredor">Convivência</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>

                      {selectedBlocoId && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedBlocoId(null)}
                          className="h-8 text-xs text-slate-600 hover:text-slate-900 border-slate-200 shrink-0"
                        >
                          Ver Todos os Blocos
                        </Button>
                      )}
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <Table className="table-system">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Código</TableHead>
                          <TableHead>Ambiente</TableHead>
                          <TableHead className="w-[150px]">Bloco / Setor</TableHead>
                          <TableHead className="w-[130px]">Tipo</TableHead>
                          <TableHead className="w-[190px]">Última Limpeza</TableHead>
                          <TableHead className="w-[130px]">Situação</TableHead>
                          <TableHead className="text-right w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mapaFilteredAmbientes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-400 italic text-xs">
                              Nenhum ambiente encontrado com os filtros aplicados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          mapaFilteredAmbientes.map((amb) => {
                            const roomOcorrencias = ocorrencias.filter((o) => o.ambiente_id === amb.id && o.status === 'pendente');
                            const roomCheckins = checkins.filter((ch) => ch.ambiente_id === amb.id);
                            const lastCheckin = roomCheckins[0];

                            return (
                              <TableRow key={amb.id}>
                                <TableCell className="font-mono text-xs font-bold text-slate-700">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                    {amb.codigo}
                                  </span>
                                </TableCell>
                                <TableCell className="font-bold text-slate-800 text-xs">
                                  {amb.nome}
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {amb.bloco || '—'}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 capitalize">
                                  {tipoLabels[amb.tipo] || amb.tipo}
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {lastCheckin ? (
                                    <div>
                                      <div className="font-medium text-slate-800">
                                        {new Date(lastCheckin.created_at).toLocaleDateString('pt-BR')} às {new Date(lastCheckin.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                      <div className="text-[10px] text-slate-400">{lastCheckin.responsavel_nome}</div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Sem registro</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {roomOcorrencias.length > 0 ? (
                                    <Badge className="bg-red-100 hover:bg-red-100 text-red-700 text-[10px] border-none font-bold py-0.5 px-2">
                                      {roomOcorrencias.length} alerta{roomOcorrencias.length > 1 && 's'}
                                    </Badge>
                                  ) : lastCheckin ? (
                                    <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 text-[10px] border-none font-bold py-0.5 px-2">
                                      OK / Limpo
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 hover:bg-slate-100 text-slate-600 text-[10px] border-none font-medium py-0.5 px-2">
                                      Pendente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setQrCodeData({ codigo: amb.codigo, nome: amb.nome })}
                                    title="Imprimir / Ver QR Code"
                                    className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </DataTablePanel>
              )}
        </TabsContent>

        {/* Tab 1: Ocorrencias */}
        <TabsContent value="ocorrencias" className="mt-0">
          <DataTablePanel
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar ocorrência..."
                    className="h-8 pl-8 text-xs input-system"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-36 input-system">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="resolvido">Resolvidos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ocFilterNota} onValueChange={setOcFilterNota}>
                  <SelectTrigger className="h-8 text-xs w-32 input-system">
                    <SelectValue placeholder="Avaliação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas notas</SelectItem>
                    <SelectItem value="5">5 ★</SelectItem>
                    <SelectItem value="4">4 ★</SelectItem>
                    <SelectItem value="3">3 ★</SelectItem>
                    <SelectItem value="2">2 ★</SelectItem>
                    <SelectItem value="1">1 ★</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery || statusFilter !== 'pendente' || ocFilterNota !== 'todos') && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('pendente');
                      setOcFilterNota('todos');
                    }}
                    className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    Restaurar Padrão
                  </Button>
                )}
              </div>
            }
          >
            <Table className="table-system">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-12 text-center">Avaliação</TableHead>
                  <TableHead className="w-1/4">Problemas Relatados</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="w-20">Foto</TableHead>
                  <TableHead className="w-40">Data de Envio</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-28 text-center italic text-muted-foreground">Carregando dados...</TableCell></TableRow>
                ) : filteredOcorrencias.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-28 text-center italic text-muted-foreground">Nenhuma ocorrência encontrada.</TableCell></TableRow>
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
                      <TableCell className="align-top">
                        {oc.foto_url ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto({
                              url: oc.foto_url!,
                              title: `Foto da ocorrência - ${oc.ambiente?.nome || 'Ambiente'}`,
                              desc: oc.observacao || (oc.problemas.length > 0 ? `Problemas: ${oc.problemas.map(p => problemLabels[p] || p).join(', ')}` : undefined),
                            })}
                            className="group relative inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-emerald-500 shadow-xs cursor-pointer"
                            title="Clique para ampliar a foto"
                          >
                            <img
                              src={oc.foto_url}
                              alt={`Foto da ocorrência em ${oc.ambiente?.nome || 'ambiente'}`}
                              className="h-14 w-16 object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-xs italic text-slate-400">Sem foto</span>
                        )}
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





        {/* Tab 3: Ambientes */}
        <TabsContent value="ambientes" className="mt-0">
          <DataTablePanel
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar ambiente..."
                    className="h-8 pl-8 text-xs input-system"
                  />
                </div>
                {filteredAmbientes.length > 0 && (
                  <Button
                    onClick={printAllQrCodes}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir Todos ({filteredAmbientes.length})
                  </Button>
                )}
              </div>
            }
          >
            <Table className="table-system">
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
            <img src="/logo-ifrn-cn.png" alt="Logo IFRN" className="h-16 object-contain mb-3" />
            <div className="text-slate-800 font-extrabold text-sm text-center mb-1">Ajude-nos a melhorar este ambiente!</div>
            <div className="text-slate-500 text-[10px] text-center max-w-xs leading-normal mb-4">
              Escaneie o QR Code para avaliar este espaço ou informar qualquer problema encontrado.
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

      {/* Modal: Visualizador de Foto da Ocorrência */}
      <Dialog open={selectedPhoto !== null} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}>
        <DialogContent className="sm:max-w-[580px] bg-white rounded-2xl shadow-lifted p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              {selectedPhoto?.title}
            </DialogTitle>
            {selectedPhoto?.desc && (
              <DialogDescription className="text-xs text-slate-600">
                {selectedPhoto.desc}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedPhoto && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center my-2 max-h-[420px]">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-h-[400px] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            {selectedPhoto && (
              <a
                href={selectedPhoto.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline font-semibold mr-auto pl-1"
              >
                Abrir imagem original
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button type="button" variant="outline" onClick={() => setSelectedPhoto(null)} className="h-9 text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Drilldown: Detalhamento de Consumo de Insumos */}
      <Dialog open={isConsumoDrilldownOpen} onOpenChange={setIsConsumoDrilldownOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white rounded-2xl shadow-lifted">
          <DialogHeader className="pb-3 border-b border-border-default/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Detalhamento de Consumo de Insumos
                    <Badge variant="outline" className="text-[11px] font-normal border-emerald-300 text-emerald-800 bg-emerald-50">
                      Detalhamento
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Registro analítico detalhado das reposições realizadas no período ({sortedConsumoData.length} registros).
                  </DialogDescription>
                </div>
              </div>
              {/* Badges de filtros de drilldown ativos */}
              {(consumoDrilldownFilterDate || consumoDrilldownFilterMaterial) && (
                <div className="flex items-center gap-1.5">
                  {consumoDrilldownFilterDate && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 text-blue-800">
                      Data: {consumoDrilldownFilterDate}
                      <button onClick={() => setConsumoDrilldownFilterDate(null)} className="ml-1 hover:text-blue-950 font-bold">×</button>
                    </Badge>
                  )}
                  {consumoDrilldownFilterMaterial && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-800">
                      Material: {materialLabels[consumoDrilldownFilterMaterial] || consumoDrilldownFilterMaterial}
                      <button onClick={() => setConsumoDrilldownFilterMaterial(null)} className="ml-1 hover:text-emerald-950 font-bold">×</button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Drilldown Toolbar */}
          <div className="py-3 flex items-center justify-between gap-3 flex-wrap bg-slate-50/70 px-4 -mx-6 border-b border-slate-200/80">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={consumoDrilldownSearch}
                  onChange={(e) => setConsumoDrilldownSearch(e.target.value)}
                  placeholder="Buscar por ambiente, código, bloco..."
                  className="h-8 pl-8 text-xs bg-white input-system"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Agrupar por:</span>
              <Select value={consumoGrouping} onValueChange={(val: any) => setConsumoGrouping(val)}>
                <SelectTrigger className="h-8 text-xs w-48 bg-white input-system">
                  <SelectValue placeholder="Agrupamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amb_dia">Por Ambiente e Dia</SelectItem>
                  <SelectItem value="ambiente">Por Ambiente</SelectItem>
                  <SelectItem value="dia">Por Dia</SelectItem>
                </SelectContent>
              </Select>

              {(consumoDrilldownSearch || consumoDrilldownFilterDate || consumoDrilldownFilterMaterial) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setConsumoDrilldownSearch('');
                    setConsumoDrilldownFilterDate(null);
                    setConsumoDrilldownFilterMaterial(null);
                  }}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Drilldown Table Content */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
            <Table className="table-system">
              <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-xs">
                <TableRow>
                  {consumoGrouping !== 'dia' && <TableHead className="w-1/3">Ambiente</TableHead>}
                  {consumoGrouping !== 'ambiente' && <TableHead className="w-32">Data</TableHead>}
                  <TableHead className="text-right">🧻 Papel Higiênico</TableHead>
                  <TableHead className="text-right">🧴 Sabonete Líquido</TableHead>
                  <TableHead className="text-right">🧻 Papel Toalha</TableHead>
                  <TableHead className="text-right">🗑️ Saco de Lixo</TableHead>
                  <TableHead className="text-right">📦 Outros</TableHead>
                  <TableHead className="text-right font-bold">Total Geral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedConsumoData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={consumoGrouping === 'amb_dia' ? 8 : 7} className="h-36 text-center italic text-muted-foreground">
                      Nenhum registro de consumo localizado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedConsumoData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/60">
                      {consumoGrouping !== 'dia' && (
                        <TableCell>
                          <div className="font-semibold text-slate-900">{row.ambienteNome}</div>
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                            {row.ambienteCodigo && <span>{row.ambienteCodigo}</span>}
                            {row.ambienteBloco && <span>• {row.ambienteBloco}</span>}
                          </div>
                        </TableCell>
                      )}
                      {consumoGrouping !== 'ambiente' && (
                        <TableCell className="font-medium text-slate-700">
                          {row.data}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-slate-700 font-mono">
                        {row.papel_higienico || '-'}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-mono">
                        {row.sabonete_liquido || '-'}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-mono">
                        {row.papel_toalha || '-'}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-mono">
                        {row.saco_lixo || '-'}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-mono">
                        {row.outros || '-'}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-emerald-800 font-mono bg-emerald-50/40">
                        {row.total}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-3 border-t border-border-default/60 flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Total consolidado:{' '}
              <strong className="text-slate-800">
                {sortedConsumoData.reduce((acc, r) => acc + r.total, 0)} unidades
              </strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConsumoDrilldownOpen(false)}
              className="text-xs"
            >
              Fechar Detalhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Drilldown: Detalhamento de Limpezas Realizadas */}
      <Dialog open={isLimpezasDrilldownOpen} onOpenChange={setIsLimpezasDrilldownOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white rounded-2xl shadow-lifted">
          <DialogHeader className="pb-3 border-b border-border-default/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Detalhamento de Limpezas Realizadas
                    <Badge variant="outline" className="text-[11px] font-normal border-blue-300 text-blue-800 bg-blue-50">
                      Detalhamento
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Registro analítico de passagens e intervenções de limpeza no período ({filteredLimpezasDrilldown.length} registros).
                  </DialogDescription>
                </div>
              </div>
              {/* Badges de filtros de drilldown ativos */}
              {(limpezasDrilldownFilterDate || limpezasDrilldownFilterAcao !== 'todos') && (
                <div className="flex items-center gap-1.5">
                  {limpezasDrilldownFilterDate && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 text-blue-800">
                      Data: {limpezasDrilldownFilterDate}
                      <button onClick={() => setLimpezasDrilldownFilterDate(null)} className="ml-1 hover:text-blue-950 font-bold">×</button>
                    </Badge>
                  )}
                  {limpezasDrilldownFilterAcao !== 'todos' && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-purple-100 text-purple-800">
                      Ação: {mapAcaoLabel[limpezasDrilldownFilterAcao] || limpezasDrilldownFilterAcao}
                      <button onClick={() => setLimpezasDrilldownFilterAcao('todos')} className="ml-1 hover:text-purple-950 font-bold">×</button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Drilldown Toolbar */}
          <div className="py-3 flex items-center justify-between gap-3 flex-wrap bg-slate-50/70 px-4 -mx-6 border-b border-slate-200/80">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={limpezasDrilldownSearch}
                  onChange={(e) => setLimpezasDrilldownSearch(e.target.value)}
                  placeholder="Buscar por ambiente, responsável, material..."
                  className="h-8 pl-8 text-xs bg-white input-system"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filtrar por ação:</span>
              <Select value={limpezasDrilldownFilterAcao} onValueChange={setLimpezasDrilldownFilterAcao}>
                <SelectTrigger className="h-8 text-xs w-48 bg-white input-system">
                  <SelectValue placeholder="Todas ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas ações</SelectItem>
                  <SelectItem value="limpeza_padrao">Limpeza Padrão</SelectItem>
                  <SelectItem value="reposicao_insumos">Reposição Insumos</SelectItem>
                  <SelectItem value="varricao">Varrição</SelectItem>
                  <SelectItem value="recolhimento_lixo">Recolhimento Lixo</SelectItem>
                  <SelectItem value="limpeza_pesada">Limpeza Pesada</SelectItem>
                </SelectContent>
              </Select>

              {(limpezasDrilldownSearch || limpezasDrilldownFilterDate || limpezasDrilldownFilterAcao !== 'todos') && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setLimpezasDrilldownSearch('');
                    setLimpezasDrilldownFilterDate(null);
                    setLimpezasDrilldownFilterAcao('todos');
                  }}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Drilldown Table Content */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
            <Table className="table-system">
              <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-xs">
                <TableRow>
                  <TableHead className="w-1/4">Ambiente</TableHead>
                  <TableHead className="w-1/4">Responsável</TableHead>
                  <TableHead className="w-1/4">Ações Realizadas</TableHead>
                  <TableHead>Observações / Consumos</TableHead>
                  <TableHead className="w-36 text-right">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLimpezasDrilldown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-36 text-center italic text-muted-foreground">
                      Nenhum registro de limpeza localizado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLimpezasDrilldown.map((ch) => (
                    <TableRow key={ch.id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{ch.ambiente?.nome}</div>
                        <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                          {ch.ambiente?.codigo && <span>{ch.ambiente?.codigo}</span>}
                          {ch.ambiente?.bloco && <span>• {ch.ambiente?.bloco}</span>}
                        </div>
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
          </div>

          <DialogFooter className="pt-3 border-t border-border-default/60 flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Total consolidado:{' '}
              <strong className="text-slate-800">
                {filteredLimpezasDrilldown.length} passagem(ns)
              </strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLimpezasDrilldownOpen(false)}
              className="text-xs"
            >
              Fechar Detalhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
