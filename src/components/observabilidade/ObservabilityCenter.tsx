import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { DatasetStatusMatrixTable } from '@/components/observabilidade/DatasetStatusMatrixTable';
import { ObservabilityOverviewCards } from '@/components/observabilidade/ObservabilityOverviewCards';
import { UnifiedLogsTable } from '@/components/observabilidade/UnifiedLogsTable';
import { Button } from '@/components/ui/button';
import {
  dataImportLogsService,
  type DatasetStatus,
  type ObservabilityStats,
  type UnifiedLogEntry,
} from '@/services/dataImportLogsService';

export function ObservabilityCenter() {
  const [stats, setStats] = useState<ObservabilityStats | null>(null);
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [logs, setLogs] = useState<UnifiedLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPipelineFilter, setSelectedPipelineFilter] = useState<string | null>(null);

  const loadData = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const [statsData, datasetsData, logsData] = await Promise.all([
        dataImportLogsService.fetchObservabilityStats(),
        dataImportLogsService.fetchDatasetStatusMatrix(),
        dataImportLogsService.fetchUnifiedObservabilityLogs({ limit: 300 }),
      ]);

      setStats(statsData);
      setDatasets(datasetsData);
      setLogs(logsData);

      if (showToast) {
        toast.success('Central de observabilidade atualizada.');
      }
    } catch (err) {
      console.error('Erro ao carregar dados da central de observabilidade:', err);
      toast.error('Não foi possível carregar os logs da central de observabilidade.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const handleSelectDataset = (datasetKey: string) => {
    setSelectedPipelineFilter(datasetKey);
    // Smooth scroll down to the logs table
    const tableEl = document.getElementById('observability-unified-logs');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <ObservabilityOverviewCards stats={stats} isLoading={isLoading} />

      {/* Dataset Health Matrix */}
      <DatasetStatusMatrixTable
        datasets={datasets}
        isLoading={isLoading}
        onSelectDataset={handleSelectDataset}
        onRefresh={() => void loadData(true)}
      />

      {/* Unified Chronological Logs Table */}
      <div id="observability-unified-logs">
        <UnifiedLogsTable
          logs={logs}
          isLoading={isLoading}
          onRefresh={() => void loadData(true)}
          initialPipelineFilter={selectedPipelineFilter}
          onClearPipelineFilter={() => setSelectedPipelineFilter(null)}
        />
      </div>
    </div>
  );
}
