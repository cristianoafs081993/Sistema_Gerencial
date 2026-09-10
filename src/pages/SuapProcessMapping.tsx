import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  GitBranch,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';

import { DEFAULT_PROCESS_MAPPINGS } from '@/data/defaultProcessMapping';
import { buildSuapProcessFlowSummary } from '@/lib/suapProcessFlow';
import {
  loadLocalStoredMappings,
  processMappingsService,
  saveLocalStoredMappings,
} from '@/services/processMappings';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';
import type {
  ProcessMappingDefinition,
  ProcessMappingNode,
  ProcessMappingRecord,
} from '@/types/processMapping';

import { ProcessMappingAiModal } from '@/components/suap/process-mapping/ProcessMappingAiModal';
import {
  ProcessMappingCanvas,
  type ProcessMappingCanvasHandle,
} from '@/components/suap/process-mapping/ProcessMappingCanvas';
import { ProcessMappingDetailDrawer } from '@/components/suap/process-mapping/ProcessMappingDetailDrawer';
import { ProcessMappingExecutionGuide } from '@/components/suap/process-mapping/ProcessMappingExecutionGuide';
import { ProcessMappingExportModal } from '@/components/suap/process-mapping/ProcessMappingExportModal';
import { ProcessMappingListView } from '@/components/suap/process-mapping/ProcessMappingListView';
import { ProcessMappingModalNew } from '@/components/suap/process-mapping/ProcessMappingModalNew';
import {
  ProcessMappingNavbar,
  type ProcessMappingViewMode,
} from '@/components/suap/process-mapping/ProcessMappingNavbar';
import { Button } from '@/components/ui/button';

const ACTIVE_ID_KEY = 'siages_active_mapping_id';

function loadStoredProcesses(): ProcessMappingRecord[] {
  const local = loadLocalStoredMappings();
  if (local.length > 0) {
    const existingIds = new Set(local.map((p) => p.id));
    const missingDefaults = DEFAULT_PROCESS_MAPPINGS.filter((d) => !existingIds.has(d.id));
    return [...local, ...missingDefaults];
  }
  return DEFAULT_PROCESS_MAPPINGS;
}

export default function SuapProcessMappingPage() {
  const { mappingId } = useParams<{ mappingId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const suapId = searchParams.get('suapId') || undefined;

  // Process collection state
  const [processes, setProcesses] = useState<ProcessMappingRecord[]>(() => loadStoredProcesses());
  const [activeProcessId, setActiveProcessId] = useState<string>(() => {
    if (mappingId) return mappingId;
    try {
      const saved = localStorage.getItem(ACTIVE_ID_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return processes[0]?.id || DEFAULT_PROCESS_MAPPINGS[0].id;
  });

  // Views & Controls
  const [viewMode, setViewMode] = useState<ProcessMappingViewMode>('canvas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<ProcessMappingNode | null>(null);

  // Canvas controls & state (forwarded from header)
  const canvasRef = useRef<ProcessMappingCanvasHandle>(null);
  const [canvasZoom, setCanvasZoom] = useState<number>(0.85);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hasSelectedEdge, setHasSelectedEdge] = useState<boolean>(false);

  // External Process Integration (SUAP)
  const [process, setProcess] = useState<SuapProcesso | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isNewProcessOpen, setIsNewProcessOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Sincronizar processos iniciais com serviço remoto / fallback
  useEffect(() => {
    let active = true;
    const fetchMapping = typeof processMappingsService.getById === 'function'
      ? processMappingsService.getById(mappingId)
      : Promise.resolve(null);
    const fetchList = typeof processMappingsService.listPublished === 'function'
      ? processMappingsService.listPublished()
      : Promise.resolve(DEFAULT_PROCESS_MAPPINGS);

    Promise.all([
      fetchMapping,
      fetchList,
      suapId ? suapProcessosService.getBySuapId(suapId) : Promise.resolve(null),
    ])
      .then(([currentMap, publishedList, nextProcess]) => {
        if (!active) return;
        const listToMerge = publishedList?.length ? publishedList : DEFAULT_PROCESS_MAPPINGS;
        setProcesses((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          listToMerge.forEach((p) => {
            if (!map.has(p.id)) map.set(p.id, p);
          });
          if (currentMap && !map.has(currentMap.id)) {
            map.set(currentMap.id, currentMap);
          }
          const merged = Array.from(map.values());
          saveLocalStoredMappings(merged);
          return merged;
        });

        if (currentMap) {
          setActiveProcessId(currentMap.id);
        } else if (mappingId) {
          setActiveProcessId(mappingId);
        }

        setProcess(nextProcess);
        setError(null);
      })
      .catch((caught) => {
        if (active) {
          console.warn('SuapProcessMappingPage load error:', caught);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mappingId, suapId]);

  // Se mappingId vier na URL, sincronizar activeProcessId
  useEffect(() => {
    if (mappingId && mappingId !== activeProcessId) {
      const found = processes.find((p) => p.id === mappingId || p.code === mappingId);
      if (found) {
        setActiveProcessId(found.id);
      }
    }
  }, [mappingId, processes, activeProcessId]);

  // Persistir activeProcessId
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_ID_KEY, activeProcessId);
    } catch {
      // ignore
    }
  }, [activeProcessId]);

  // Persistir lista de processos sempre que for alterada
  const handleUpdateProcessList = useCallback((updatedList: ProcessMappingRecord[]) => {
    setProcesses(updatedList);
    saveLocalStoredMappings(updatedList);
    void processMappingsService.saveAll(updatedList);
  }, []);

  const activeProcess = useMemo(() => {
    return (
      processes.find((p) => p.id === activeProcessId || p.code === activeProcessId) ||
      processes[0] ||
      DEFAULT_PROCESS_MAPPINGS[0]
    );
  }, [processes, activeProcessId]);

  // Handler para trocar processo ativo
  const handleSelectProcess = useCallback(
    (id: string) => {
      setActiveProcessId(id);
      setSelectedNode(null);
      navigate(`/mapeamentos/${id}${suapId ? `?suapId=${encodeURIComponent(suapId)}` : ''}`);
    },
    [navigate, suapId]
  );

  // Handler para atualizar o processo ativo (nós, conexões, etc.)
  const handleUpdateActiveProcess = useCallback(
    (updated: ProcessMappingDefinition | ProcessMappingRecord) => {
      const fullRecord: ProcessMappingRecord = {
        ...activeProcess,
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      const updatedList = processes.map((p) => (p.id === fullRecord.id ? fullRecord : p));
      setProcesses(updatedList);
      saveLocalStoredMappings(updatedList);
      void processMappingsService.saveMapping(fullRecord);
    },
    [activeProcess, processes]
  );

  // Handler para atualizar um nó a partir do Drawer
  const handleUpdateNode = useCallback(
    (updatedNode: ProcessMappingNode) => {
      const updatedNodes = activeProcess.nodes.map((n) =>
        n.id === updatedNode.id ? updatedNode : n
      );
      handleUpdateActiveProcess({ ...activeProcess, nodes: updatedNodes });
      setSelectedNode(updatedNode);
    },
    [activeProcess, handleUpdateActiveProcess]
  );

  // Handler para excluir um nó
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const updatedNodes = activeProcess.nodes.filter((n) => n.id !== nodeId);
      const updatedEdges = activeProcess.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      handleUpdateActiveProcess({
        ...activeProcess,
        nodes: updatedNodes,
        edges: updatedEdges,
      });
      setSelectedNode(null);
    },
    [activeProcess, handleUpdateActiveProcess]
  );

  // Handler para adicionar novo nó pela paleta da Sidebar
  const handleAddNodeFromPalette = useCallback(
    (type: 'task' | 'gateway' | 'end' | 'start') => {
      const maxX =
        activeProcess.nodes.length > 0
          ? Math.max(...activeProcess.nodes.map((n) => n.position.x))
          : 60;
      const targetLane = activeProcess.lanes[0]?.id;
      const responsible = activeProcess.lanes[0]?.name || 'Equipe';

      let newNode: ProcessMappingNode;

      if (type === 'start' || type === 'end') {
        newNode = {
          id: `node-${Date.now()}`,
          code: type === 'start' ? 'INÍCIO' : 'FIM',
          title: type === 'start' ? 'Início do Fluxo' : 'Processo Concluído',
          description: type === 'start' ? 'Início da atividade.' : 'Finalização do processo.',
          type,
          position: { x: maxX + 180, y: 110 },
          width: 52,
          height: 52,
          responsible,
          laneId: targetLane,
          status: 'pending',
        };
      } else if (type === 'gateway') {
        newNode = {
          id: `node-${Date.now()}`,
          code: 'DECISÃO',
          title: 'Critério de Decisão?',
          description: 'Ponto de ramificação ou verificação de conformidade.',
          type: 'gateway',
          gatewayType: 'exclusive',
          position: { x: maxX + 180, y: 110 },
          width: 68,
          height: 68,
          responsible,
          laneId: targetLane,
          status: 'pending',
        };
      } else {
        const nextCode = (
          activeProcess.nodes.filter((n) => n.type === 'task').length + 1
        ).toString();
        newNode = {
          id: `node-${Date.now()}`,
          code: nextCode,
          title: 'Nova Atividade',
          description: 'Descreva os procedimentos e instruções operacionais da etapa.',
          type: 'task',
          position: { x: maxX + 200, y: 90 },
          width: 190,
          height: 105,
          responsible,
          laneId: targetLane,
          status: 'pending',
          checklist: [],
          inputDocuments: [],
          outputDocuments: [],
          slaDays: 3,
        };
      }

      handleUpdateActiveProcess({
        ...activeProcess,
        nodes: [...activeProcess.nodes, newNode],
      });
      setSelectedNode(newNode);
    },
    [activeProcess, handleUpdateActiveProcess]
  );

  // Handler para criar novo processo
  const handleCreateProcess = useCallback(
    (newProcess: ProcessMappingRecord) => {
      const nextList = [newProcess, ...processes];
      handleUpdateProcessList(nextList);
      handleSelectProcess(newProcess.id);
    },
    [processes, handleUpdateProcessList, handleSelectProcess]
  );

  // Handler para restaurar mapeamentos padrões
  const handleResetDefaults = useCallback(() => {
    if (
      window.confirm(
        'Deseja restaurar os mapeamentos de processos padrões da Lei 14.133/2021 e SUAP?'
      )
    ) {
      handleUpdateProcessList(DEFAULT_PROCESS_MAPPINGS);
      handleSelectProcess(DEFAULT_PROCESS_MAPPINGS[0].id);
      setSelectedNode(null);
    }
  }, [handleUpdateProcessList, handleSelectProcess]);

  // Análise de fluxo SUAP
  const flow = useMemo(() => {
    if (!activeProcess) return undefined;
    return buildSuapProcessFlowSummary(activeProcess, undefined, {
      suapId,
      processCompleted: Boolean(process?.dadosCompletos?.workflow?.concluido),
    });
  }, [activeProcess, process, suapId]);

  if (loading) {
    return (
      <main className="flex min-h-[600px] items-center justify-center bg-[#f8fafc] font-ui">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          Carregando mapeamento de processos...
        </div>
      </main>
    );
  }

  if (error || !activeProcess) {
    return (
      <main className="flex min-h-[600px] items-center justify-center bg-[#f8fafc] p-6 font-ui">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center shadow-sm">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-black text-slate-900">Mapeamento indisponível</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || 'Não foi possível encontrar o mapeamento de processos solicitado.'}
          </p>
          <Button asChild className="mt-5 bg-emerald-600 hover:bg-emerald-700">
            <button type="button" onClick={() => handleSelectProcess(DEFAULT_PROCESS_MAPPINGS[0].id)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ver Mapeamento Padrão
            </button>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 bg-slate-100 font-ui text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <ProcessMappingNavbar
        processes={processes}
        activeProcess={activeProcess}
        viewMode={viewMode}
        searchTerm={searchTerm}
        onSelectProcess={handleSelectProcess}
        onChangeViewMode={setViewMode}
        onSearchChange={setSearchTerm}
        onOpenNewProcessModal={() => setIsNewProcessOpen(true)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenExportModal={() => setIsExportOpen(true)}
        onResetDefaults={handleResetDefaults}
        suapId={suapId}
        zoom={canvasZoom}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitView={() => canvasRef.current?.fitView()}
        onResetZoom={() => canvasRef.current?.resetZoom()}
        showGrid={showGrid}
        onToggleGrid={() => canvasRef.current?.toggleGrid()}
        onAddNode={handleAddNodeFromPalette}
        hasSelectedEdge={hasSelectedEdge}
        onDeleteSelectedEdge={() => canvasRef.current?.deleteSelectedEdge()}
      />

      {/* Main Container: Full Width Canvas / Views */}
      <main className="flex-1 relative flex flex-col overflow-hidden bg-slate-100 min-h-0">
        <h1 className="sr-only">{activeProcess.title}</h1>

        {/* Views */}
        {viewMode === 'canvas' && (
          <div className="flex-1 flex flex-col min-h-0 h-full">
            <ProcessMappingCanvas
              ref={canvasRef}
              mapping={activeProcess}
              flow={flow}
              selectedNode={selectedNode}
              searchTerm={searchTerm}
              onSelectNode={setSelectedNode}
              onUpdateMapping={handleUpdateActiveProcess}
              onAddNode={handleAddNodeFromPalette}
              onZoomChange={setCanvasZoom}
              onGridChange={setShowGrid}
              onSelectedEdgeChange={setHasSelectedEdge}
            />
          </div>
        )}

          {viewMode === 'table' && (
            <div className="flex-1 overflow-y-auto">
              <ProcessMappingListView
                process={activeProcess}
                onSelectNode={setSelectedNode}
                onAddNewNode={() => handleAddNodeFromPalette('task')}
              />
            </div>
          )}

          {viewMode === 'execution' && (
            <div className="flex-1 overflow-y-auto">
              <ProcessMappingExecutionGuide
                process={activeProcess}
                onUpdateProcess={handleUpdateActiveProcess}
                onSelectNode={setSelectedNode}
              />
            </div>
          )}
        </main>

      {/* Slide-out Detail Drawer */}
      <ProcessMappingDetailDrawer
        node={selectedNode}
        lanes={activeProcess.lanes}
        isOpen={Boolean(selectedNode)}
        processTitle={activeProcess.title}
        onClose={() => setSelectedNode(null)}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
      />

      {/* New Process Modal */}
      <ProcessMappingModalNew
        isOpen={isNewProcessOpen}
        onClose={() => setIsNewProcessOpen(false)}
        onCreateProcess={handleCreateProcess}
      />

      {/* Export & Import Modal */}
      <ProcessMappingExportModal
        isOpen={isExportOpen}
        activeProcess={activeProcess}
        onClose={() => setIsExportOpen(false)}
        onImportProcess={(imported) => {
          handleCreateProcess(imported);
          setIsExportOpen(false);
        }}
      />

      {/* AI Assistant Modal */}
      <ProcessMappingAiModal
        isOpen={isAiModalOpen}
        activeProcess={activeProcess}
        onClose={() => setIsAiModalOpen(false)}
        onApplyGeneratedProcess={(generated) => {
          handleCreateProcess(generated);
          setSelectedNode(null);
        }}
      />
    </div>
  );
}
