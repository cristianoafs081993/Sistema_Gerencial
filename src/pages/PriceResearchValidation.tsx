import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

import { HeaderSubtitle } from '@/components/HeaderParts';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { priceResearchService } from '@/services/priceResearch';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export default function PriceResearchValidation() {
  const [params] = useSearchParams();
  const researchId = params.get('id')?.trim() || '';
  const providedHash = params.get('auth')?.trim().toLowerCase() || '';

  const missingParams = !researchId || !providedHash;
  const { data: validation, isFetching, error } = useQuery({
    queryKey: ['price-research-validation', researchId],
    queryFn: () => priceResearchService.validateAuthentication(researchId, providedHash),
    enabled: !missingParams,
    staleTime: 0,
  });

  const status = missingParams
    ? 'missing'
    : isFetching
      ? 'loading'
      : error || !validation?.found
        ? 'not-found'
        : validation.isValid
          ? 'valid'
          : 'invalid';

  return (
    <div className="space-y-6">
      <HeaderSubtitle>Validação de relatório de pesquisa de preços</HeaderSubtitle>

      <div>
        <h1 className="font-ui text-2xl font-bold text-text-primary">Validação de relatório de pesquisa de preços</h1>
        <p className="mt-1 font-ui text-sm text-text-secondary">
          Conferência do QR Code de autenticação pelo hash determinístico do snapshot salvo.
        </p>
      </div>

      <SectionPanel
        title="Resultado da validação"
        description="O hash informado no QR Code é comparado com o hash calculado a partir dos dados salvos da pesquisa."
      >
        {status === 'loading' ? (
          <div className="flex items-center gap-3 rounded-radius-lg border border-border-default bg-surface-subtle/50 p-5 text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-ui text-sm font-semibold">Carregando pesquisa para validação...</span>
          </div>
        ) : null}

        {status === 'missing' ? (
          <div className="rounded-radius-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <h3 className="font-ui text-sm font-bold text-amber-900">Link de validação incompleto</h3>
                <p className="mt-1 font-ui text-sm text-amber-800">
                  O QR Code precisa conter o identificador da pesquisa e o hash de autenticação.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {status === 'not-found' ? (
          <div className="rounded-radius-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <h3 className="font-ui text-sm font-bold text-amber-900">Pesquisa não localizada</h3>
                <p className="mt-1 font-ui text-sm text-amber-800">
                  A pesquisa pode não existir ou o link pode ter sido gerado antes da conclusão do salvamento.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {status === 'valid' || status === 'invalid' ? (
          <div className={`rounded-radius-lg border p-5 ${
            status === 'valid'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-red-200 bg-red-50'
          }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                {status === 'valid' ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" />
                ) : (
                  <XCircle className="mt-0.5 h-6 w-6 text-red-700" />
                )}
                <div>
                  <h3 className={`font-ui text-base font-bold ${status === 'valid' ? 'text-emerald-950' : 'text-red-950'}`}>
                    {status === 'valid' ? 'Relatório autenticado' : 'Hash divergente'}
                  </h3>
                  <p className={`mt-1 font-ui text-sm ${status === 'valid' ? 'text-emerald-800' : 'text-red-800'}`}>
                    {status === 'valid'
                      ? 'O QR Code corresponde ao snapshot salvo desta pesquisa.'
                      : 'O hash do QR Code não corresponde aos dados atualmente salvos para esta pesquisa.'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="w-fit bg-white font-mono text-[11px]">
                {validation?.research?.status === 'completed' ? 'Concluída' : 'Em revisão'}
              </Badge>
            </div>
          </div>
        ) : null}
      </SectionPanel>

      {validation?.research ? (
        <SectionPanel title="Dados conferidos" description="Resumo usado para localizar e conferir o relatório.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Processo', validation.research.processNumber || '-'],
              ['Objeto', validation.research.objectDescription],
              ['Responsável', validation.research.responsibleName],
              ['Instituição', validation.research.institutionName || '-'],
              ['Unidade/Setor', validation.research.institutionUnit || '-'],
              ['Data da pesquisa', validation.research.researchDate],
              ['Atualizado em', formatDateTime(validation.research.updatedAt)],
              ['Itens', validation.research.itemsCount.toString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-radius-lg border border-border-default bg-white p-4">
                <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
                <p className="mt-2 line-clamp-3 font-ui text-sm font-bold text-text-primary">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-radius-lg border border-border-default bg-surface-subtle/40 p-4">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted">Hash informado</p>
              <p className="mt-2 break-all font-mono text-xs font-bold text-text-primary">{providedHash}</p>
            </div>
            <div className="rounded-radius-lg border border-border-default bg-surface-subtle/40 p-4">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted">Hash recalculado</p>
              <p className="mt-2 break-all font-mono text-xs font-bold text-text-primary">{validation.expectedHash}</p>
            </div>
          </div>
        </SectionPanel>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild type="button" variant="outline" className="gap-2">
          <Link to="/pesquisa-precos">
            <ShieldCheck className="h-4 w-4" />
            Abrir pesquisa de preços
          </Link>
        </Button>
      </div>
    </div>
  );
}
