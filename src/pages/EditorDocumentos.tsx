import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Landmark,
  Loader2,
  PanelRightOpen,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import RichTextEditor from '@/components/Editor/RichTextEditor';
import { HeaderActions } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { type ContractPdfAnalysis, type ContractTemplateCandidate } from '@/lib/contractProcessPdf';
import { applyDocxTemplatePlan, type DocxTemplateExportPlan } from '@/lib/docxDocumentTemplate';
import {
  buildDespachoLiquidacaoHtml,
  buildResolvedContextFromSuapProcess,
  documentDefinitions,
  extractProcessNumbers,
  resolveDocumentIntent,
  type DocumentIntent,
  type ResolvedDocumentContext,
  type SupportedDocumentType,
} from '@/lib/documentGeneration';
import {
  buildReferenceTermFieldInstruction,
  buildReferenceTermOptionFields,
  buildReferenceTermOptionPreview,
  getReferenceTermQuestionSourceText,
  sanitizeReferenceTermQuestionnaireSchema,
} from '@/lib/referenceTermQuestionnaire';
import { type ReferenceTermPdfAnalysis } from '@/lib/referenceTermProcessPdf';
import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';
import {
  buildEtpInstitutionalContextSnippet,
  defaultEtpInstitutionalContextId,
  getEtpInstitutionalContextById,
  isEtpInstitutionalContextSnippet,
} from '@/lib/etpInstitutionalContexts';
import { type PreliminaryStudyPdfAnalysis } from '@/lib/preliminaryStudyProcessPdf';
import {
  analyzePreliminaryStudySupplementalAttachmentFile,
  PRELIMINARY_STUDY_SUPPLEMENTAL_ACCEPT,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES,
  type PreliminaryStudySupplementalAttachmentAnalysis,
} from '@/lib/preliminaryStudySupplementalAttachments';
import {
  buildInitialPreliminaryStudyAnswers,
  buildPreliminaryStudyQuestionnaireAnswers,
  isPreliminaryStudyQuestionAnswered,
  preliminaryStudyQuestions,
  type PreliminaryStudyQuestion,
  type PreliminaryStudyQuestionAnswer,
  type PreliminaryStudyQuestionSuggestion,
} from '@/lib/preliminaryStudyQuestionnaire';
import { suapExtensionGithubUrl } from '@/lib/suapExtension';
import { cn, formatarDocumento } from '@/lib/utils';
import { contractDraftsService } from '@/services/contractDrafts';
import type { DocumentTemplateQuestion, DocumentTemplateRecord } from '@/services/documentTemplates';
import {
  preliminaryStudiesService,
  type PreliminaryStudyDraftSection,
} from '@/services/preliminaryStudies';
import {
  referenceTermsService,
  type ReferenceTermQuestionAnswer,
  type ReferenceTermQuestionSuggestion,
} from '@/services/referenceTerms';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

type ScreenState =
  | 'idle'
  | 'resolving'
  | 'ambiguous'
  | 'ai_questionnaire_prefill'
  | 'reference_questionnaire'
  | 'etp_questionnaire_prefill'
  | 'etp_questionnaire'
  | 'not_found';
type FeedbackTone = 'neutral' | 'warning' | 'success';

type ExampleProcessCard = {
  id: string;
  processo: string;
  beneficiario?: string;
  processoCompleto: SuapProcesso;
};

type GeneratedDispatch = {
  id: string;
  title: string;
  subtitle?: string;
  processo?: string;
  html: string;
  documentType: SupportedDocumentType;
  allowClone: boolean;
  allowDocxDownload?: boolean;
  docxFileName?: string;
  docxTemplateBase64?: string;
  docxExportPlan?: DocxTemplateExportPlan;
  sections?: PreliminaryStudyDraftSection[];
  etpContext?: {
    processo?: SuapProcesso | null;
    manualObject?: string;
  };
};

type PendingContractGeneration = {
  processo: SuapProcesso;
  analysis: ContractPdfAnalysis;
};

type PendingReferenceTermGeneration = {
  processo?: SuapProcesso | null;
  analysis?: ReferenceTermPdfAnalysis | null;
  template: DocumentTemplateRecord;
  etpContextSnippets?: DocumentContextSnippet[];
};

type PendingPreliminaryStudyGeneration = {
  processo?: SuapProcesso | null;
  analysis?: PreliminaryStudyPdfAnalysis | null;
  manualObject?: string;
  supplementalSnippets?: DocumentContextSnippet[];
};

type ReferenceTermSuggestionReview = ReferenceTermQuestionSuggestion & {
  decision: 'pending' | 'approved' | 'rejected';
  editedSelectedOptionId?: string;
  editedValue?: string;
  editedJustification?: string;
};

type PreliminaryStudySuggestionReview = PreliminaryStudyQuestionSuggestion & {
  decision: 'pending' | 'approved' | 'rejected';
  editedValue?: string;
  editedJustification?: string;
};

const stripHtml = (html: string) => {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const normalizeContextText = (value: string) =>
  value
    .replace(/\[[^\]]*CAMPO PENDENTE[^\]]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const etpSnippetKindFromTitle = (title: string) => {
  const normalized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('necessidade')) return 'necessidade';
  if (normalized.includes('objeto') || normalized.includes('solucao')) return 'objeto';
  if (normalized.includes('requisito')) return 'requisitos';
  if (normalized.includes('quantit')) return 'quantitativos';
  if (normalized.includes('valor') || normalized.includes('estimativa')) return 'estimativa';
  if (normalized.includes('vigencia') || normalized.includes('prazo')) return 'vigencia';
  if (normalized.includes('sustent')) return 'sustentabilidade';
  if (normalized.includes('parcelamento')) return 'parcelamento';
  if (normalized.includes('resultado')) return 'resultados';
  return 'etp';
};

const buildEtpContextSnippetsFromHtml = (html: string): DocumentContextSnippet[] => {
  if (typeof document === 'undefined') {
    const text = normalizeContextText(html);
    return text
      ? [{
          id: 'etp-editado-1',
          kind: 'etp',
          label: 'ETP editado no editor',
          excerpt: text.slice(0, 1200),
          sourceType: 'etp',
          sourceLabel: 'ETP editado no editor',
        }]
      : [];
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  const sections: DocumentContextSnippet[] = [];
  const headings = Array.from(container.querySelectorAll('h1,h2,h3'));

  if (headings.length > 0) {
    headings.forEach((heading, index) => {
      const title = normalizeContextText(heading.textContent || `Secao ${index + 1}`);
      const parts: string[] = [];
      let current = heading.nextSibling;

      while (current) {
        if (current.nodeType === Node.ELEMENT_NODE && /^H[1-3]$/i.test((current as Element).tagName)) {
          break;
        }
        parts.push(current.textContent || '');
        current = current.nextSibling;
      }

      const excerpt = normalizeContextText(parts.join(' '));
      if (title && excerpt.length >= 20) {
        sections.push({
          id: `etp-editado-${index + 1}`,
          kind: etpSnippetKindFromTitle(title),
          label: title,
          excerpt: excerpt.slice(0, 1200),
          sourceType: 'etp',
          sourceLabel: 'ETP editado no editor',
        });
      }
    });
  }

  if (sections.length > 0) {
    return sections.slice(0, 12);
  }

  const text = normalizeContextText(stripHtml(html));
  return text.length >= 40
    ? [{
        id: 'etp-editado-1',
        kind: 'etp',
        label: 'ETP editado no editor',
        excerpt: text.slice(0, 1200),
        sourceType: 'etp',
        sourceLabel: 'ETP editado no editor',
      }]
    : [];
};

const dividerHtml =
  '<hr style="margin:32px 0;border:none;border-top:4px dotted #475569;page-break-after:always;" />';
const cloneDocumentUrl = 'https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/1026154/';

const buildIntentFromProcess = (processo: string): DocumentIntent => ({
  documentType: 'despacho-liquidacao',
  lookupType: 'processo',
  lookupValue: processo,
  rawPrompt: `Gerar despacho de liquidacao do processo ${processo}`,
});

const normalizeProcessNumber = (value?: string | null) => (value || '').replace(/\D/g, '');
const sanitizeFileName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

const feedbackClasses: Record<FeedbackTone, string> = {
  neutral: 'border-border-default bg-surface-subtle/70 text-text-secondary',
  warning: 'border-warning/20 bg-warning/10 text-foreground',
  success: 'border-status-success/20 bg-status-success/10 text-foreground',
};

const isCopyableValue = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '-' && normalized !== 'null' && normalized !== 'undefined';
};

const copyValue = async (value: string | undefined | null, message: string) => {
  if (!isCopyableValue(value)) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value!);
    toast.success(message);
  } catch {
    toast.error('Nao foi possivel copiar este valor.');
  }
};

function ModelSubmenu({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-radius-lg border border-border-default/70 bg-surface-subtle/50 px-3 py-2">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Modelos</p>
      </div>

      <div className="space-y-1.5 pl-2">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Liquidação</p>
        <button
          type="button"
          onClick={onClick}
          className="group flex w-full items-start gap-3 rounded-radius-lg border border-primary/15 bg-primary/[0.06] px-3 py-3 text-left transition-all duration-200 hover:border-primary/25 hover:bg-primary/[0.09]"
        >
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-radius-md bg-primary text-primary-foreground shadow-soft">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{title}</p>
            <p className="mt-1 font-ui text-[11px] leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function DocumentModelMenu({
  activeId,
  onSelect,
}: {
  activeId: SupportedDocumentType;
  onSelect: (documentType: SupportedDocumentType) => void;
}) {
  const options = [
    {
      id: 'despacho-liquidacao' as const,
      group: 'Liquidacao',
      title: 'Despacho de Liquidacao',
      subtitle: 'Gera a minuta a partir do numero do processo',
      icon: <Wand2 className="h-3.5 w-3.5" />,
    },
    {
      id: 'contrato-servico-ifrn' as const,
      group: 'Contratos',
      title: 'Contrato de Servico IFRN',
      subtitle: 'Le o PDF do processo, identifica o modelo e monta o contrato com IA',
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      id: 'termo-referencia-compras' as const,
      group: 'Compras',
      title: 'Termo de Referencia - Compras',
      subtitle: 'Usa o modelo DOCX ativo e os dados do processo para montar o rascunho com IA',
      icon: <ReceiptText className="h-3.5 w-3.5" />,
    },
    {
      id: 'estudo-tecnico-preliminar-servicos-continuos' as const,
      group: 'Planejamento',
      title: 'ETP - Servicos Continuos',
      subtitle: 'Monta o estudo tecnico preliminar com processo SUAP ou objeto digitado',
      icon: <FileText className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-radius-lg border border-border-default/70 bg-surface-subtle/50 px-3 py-2">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Modelos</p>
      </div>

      <div className="space-y-3 pl-2">
        {options.map((option) => {
          const isActive = option.id === activeId;

          return (
            <div key={option.id} className="space-y-1.5">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">{option.group}</p>
              <button
                type="button"
                onClick={() => onSelect(option.id)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-radius-lg border px-3 py-3 text-left transition-all duration-200',
                  isActive
                    ? 'border-primary/25 bg-primary/[0.09]'
                    : 'border-border-default/80 bg-surface-card hover:border-primary/20 hover:bg-primary/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-radius-md shadow-soft',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-surface-subtle text-text-primary',
                  )}
                >
                  {option.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{option.title}</p>
                  <p className="mt-1 font-ui text-[11px] leading-relaxed text-text-secondary">{option.subtitle}</p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CopyValueButton({
  value,
  message,
  className,
}: {
  value?: string | null;
  message: string;
  className?: string;
}) {
  const canCopy = isCopyableValue(value);

  return (
    <button
      type="button"
      disabled={!canCopy}
      title={message}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-radius-md border border-border-default/70 bg-surface-card text-text-secondary shadow-xs transition',
        'hover:border-border-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      onClick={() => {
        void copyValue(value, message);
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function SidebarSection({
  icon,
  title,
  children,
  contentClassName,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="h-0.5 w-full bg-slate-200" />
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 font-ui text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        {title}
      </div>
        <div className={cn('space-y-2', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

function SidebarField({
  label,
  value,
  copyValue: valueToCopy,
  copyMessage,
  mono = false,
}: {
  label: string;
  value: string;
  copyValue?: string | null;
  copyMessage: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/70 px-3 py-2">
      <div className="min-w-0">
        <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={cn('mt-0.5 break-words font-ui text-[13px] text-foreground', mono && 'font-mono text-[12px] font-semibold')}>
          {value}
        </p>
      </div>
      <CopyValueButton value={valueToCopy} message={copyMessage} className="h-7 w-7 shrink-0 border-border bg-white shadow-none" />
    </div>
  );
}

function ExampleProcessRow({
  processo,
  beneficiario,
  onPreview,
  onSelect,
  isSelected,
  selectDisabled = false,
  selectTitle = 'Selecionar processo',
}: {
  processo: string;
  beneficiario?: string;
  onPreview: () => void;
  onSelect: () => void;
  isSelected: boolean;
  selectDisabled?: boolean;
  selectTitle?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-radius-lg border bg-surface-card p-1.5 shadow-xs transition-all duration-200',
        isSelected
          ? 'border-primary/30 bg-primary/[0.05] shadow-soft'
          : 'border-border-default/70 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/40 hover:shadow-soft',
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 rounded-radius-md px-2 py-1 text-left"
      >
        <span className="block truncate font-mono text-[11px] font-semibold text-text-primary">{processo}</span>
        <span className="mt-0.5 line-clamp-1 block font-ui text-[10px] leading-snug text-text-secondary">
          {beneficiario || 'Sincronizado no SUAP'}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/80">
          <PanelRightOpen className="h-3 w-3" />
          Ver detalhes
        </span>
      </button>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect()}
          aria-label={isSelected ? `Remover processo ${processo} da selecao` : selectTitle}
          title={isSelected ? `Remover processo ${processo} da selecao` : selectTitle}
          disabled={selectDisabled}
          className="h-5 w-5 rounded-[4px] border-border-default bg-surface-card shadow-xs transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: ResolvedDocumentContext;
  onSelect: (candidate: ResolvedDocumentContext) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className="w-full rounded-radius-xl border border-border-default bg-surface-card px-4 py-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/30 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{candidate.title}</p>
          <p className="mt-1 font-ui text-sm text-text-secondary">{candidate.subtitle || 'Selecionar esta minuta'}</p>
        </div>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/45" />
      </div>
    </button>
  );
}

function ContractModelCandidateCard({
  candidate,
  onSelect,
}: {
  candidate: ContractTemplateCandidate;
  onSelect: (candidate: ContractTemplateCandidate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className="w-full rounded-radius-xl border border-border-default bg-surface-card px-4 py-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/30 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{candidate.title}</p>
          <p className="mt-1 font-ui text-sm text-text-secondary">{candidate.subtitle}</p>
          <p className="mt-2 line-clamp-3 font-ui text-[11px] leading-relaxed text-text-secondary">{candidate.excerpt}</p>
        </div>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/45" />
      </div>
    </button>
  );
}

function ReferenceTermQuestionCard({
  question,
  sourceText,
  answer,
  onAnswer,
  onSkip,
}: {
  question: DocumentTemplateQuestion;
  sourceText?: string;
  answer?: ReferenceTermQuestionAnswer;
  onAnswer: (answer: ReferenceTermQuestionAnswer) => void;
  onSkip: () => void;
}) {
  const getInlineChoiceInputValue = (choice: { inputValuePrefix?: string }, storedValue?: string) => {
    const value = storedValue || '';
    if (!choice.inputValuePrefix) return value;
    return value.startsWith(choice.inputValuePrefix) ? value.slice(choice.inputValuePrefix.length) : value;
  };

  const buildInlineChoiceStoredValue = (choice: { inputValuePrefix?: string }, inputValue: string) =>
    `${choice.inputValuePrefix || ''}${inputValue}`.trim();

  const isSkipped = answer?.skipped === true;
  const [fieldValue, setFieldValue] = useState(isSkipped ? '' : answer?.value || '');
  const [selectedOptionId, setSelectedOptionId] = useState(answer?.selectedOptionId || '');
  const [optionValues, setOptionValues] = useState<Record<string, string>>(answer?.optionValues || {});
  const [inlineChoiceSelections, setInlineChoiceSelections] = useState<Record<string, string>>({});
  const fieldInstruction = question.kind === 'field' ? buildReferenceTermFieldInstruction(question, sourceText) : null;
  const selectedOption = getQuestionOptionById(question, selectedOptionId);
  const selectedOptionFields = selectedOption ? buildReferenceTermOptionFields(selectedOption) : [];
  const canSubmitOptionAnswer =
    Boolean(selectedOptionId) &&
    selectedOptionFields.every((field) => {
      if (field.kind !== 'choice') {
        return (optionValues[field.key] || '').trim();
      }

      const selectedChoiceKey = inlineChoiceSelections[field.key];
      const selectedChoice = field.choices.find((choice) => choice.key === selectedChoiceKey);
      if (!selectedChoice) return false;
      return selectedChoice.requiresInput
        ? Boolean(getInlineChoiceInputValue(selectedChoice, optionValues[selectedChoice.key]).trim())
        : true;
    });
  const questionTitle = fieldInstruction?.label || question.title;
  const normalizedQuestionTitle = questionTitle.trim().toLocaleLowerCase('pt-BR');
  const isGenericKindTitle =
    (question.kind === 'exclusive' &&
      (normalizedQuestionTitle === 'escolha exclusiva' || normalizedQuestionTitle === 'escolha de clausula alternativa')) ||
    (question.kind === 'optional' && normalizedQuestionTitle === 'opcional');
  const shouldShowQuestionTitle = !isGenericKindTitle;

  useEffect(() => {
    setFieldValue(isSkipped ? '' : answer?.value || '');
  }, [answer?.value, isSkipped, question.id]);

  useEffect(() => {
    setSelectedOptionId(isSkipped ? '' : answer?.selectedOptionId || '');
  }, [answer?.selectedOptionId, isSkipped, question.id]);

  useEffect(() => {
    setOptionValues(isSkipped ? {} : answer?.optionValues || {});
  }, [answer?.optionValues, isSkipped, question.id]);

  useEffect(() => {
    if (isSkipped || !selectedOptionFields.length) {
      setInlineChoiceSelections({});
      return;
    }

    setInlineChoiceSelections(
      selectedOptionFields.reduce<Record<string, string>>((current, field) => {
        if (field.kind !== 'choice') return current;
        const selectedChoice = field.choices.find((choice) => (answer?.optionValues?.[choice.key] || '').trim());
        if (selectedChoice) {
          current[field.key] = selectedChoice.key;
        }
        return current;
      }, {}),
    );
  }, [answer?.optionValues, isSkipped, question.id, selectedOptionId]);

  const submitFieldAnswer = () => {
    const value = fieldValue.trim();
    if (!value) {
      return;
    }

    onAnswer({
      questionId: question.id,
      kind: 'field',
      value,
      skipped: false,
    });
  };

  const selectOption = (optionId: string) => {
    const option = getQuestionOptionById(question, optionId);
    if (!option) return;

    const nextOptionFields = buildReferenceTermOptionFields(option);
    setSelectedOptionId(optionId);
    if (nextOptionFields.length === 0) {
      onAnswer({
        questionId: question.id,
        kind: question.kind,
        selectedOptionId: optionId,
        skipped: false,
      });
      return;
    }

    const nextOptionValues = nextOptionFields.reduce<Record<string, string>>((current, field) => {
      if (field.kind === 'choice') {
        for (const choice of field.choices) {
          const existingValue = answer?.selectedOptionId === optionId
            ? answer.optionValues?.[choice.key] || answer.optionValues?.[choice.placeholder]
            : undefined;
          current[choice.key] = existingValue || '';
        }
        return current;
      }

      const existingValue = answer?.selectedOptionId === optionId
        ? answer.optionValues?.[field.key] || answer.optionValues?.[field.placeholder]
        : undefined;
      current[field.key] = existingValue || '';
      return current;
    }, {});
    setOptionValues(nextOptionValues);
    setInlineChoiceSelections(
      nextOptionFields.reduce<Record<string, string>>((current, field) => {
        if (field.kind !== 'choice') return current;
        const selectedChoice = field.choices.find((choice) => (nextOptionValues[choice.key] || '').trim());
        if (selectedChoice) {
          current[field.key] = selectedChoice.key;
        }
        return current;
      }, {}),
    );
  };

  const submitOptionAnswer = () => {
    if (!selectedOptionId || !canSubmitOptionAnswer) {
      return;
    }

    onAnswer({
      questionId: question.id,
      kind: question.kind,
      selectedOptionId,
      optionValues: selectedOptionFields.reduce<Record<string, string>>((current, field) => {
        if (field.kind === 'choice') {
          for (const choice of field.choices) {
            current[choice.key] = (optionValues[choice.key] || '').trim();
          }
          return current;
        }

        current[field.key] = (optionValues[field.key] || '').trim();
        return current;
      }, {}),
      skipped: false,
    });
  };

  return (
    <div className="rounded-radius-xl border border-border-default/70 bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isSkipped ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                Pendente
              </Badge>
            ) : null}
          </div>
          {shouldShowQuestionTitle ? <p className="mt-2 font-ui text-sm font-semibold text-text-primary">{questionTitle}</p> : null}
          {fieldInstruction ? (
            <div className="mt-3 rounded-radius-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
              <p className="font-ui text-sm leading-6 text-text-primary">{fieldInstruction.instruction}</p>
              <p className="mt-1 font-ui text-xs leading-5 text-text-secondary">
                Campo do modelo: <span className="font-medium text-text-primary">{fieldInstruction.modelField}</span>
              </p>
              {sourceText ? <ReferenceTermOriginalTextHover originalText={sourceText} className="mt-2" /> : null}
            </div>
          ) : (
            <>
              <p className="mt-1 font-ui text-sm leading-6 text-text-secondary">{question.prompt}</p>
              {question.guidance && question.kind !== 'exclusive' ? (
                <p className="mt-1 font-ui text-xs leading-5 text-text-muted">{question.guidance}</p>
              ) : null}
            </>
          )}
        </div>

        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onSkip}>
          Pular
        </Button>
      </div>

      {question.kind === 'field' ? (
        <Textarea
          value={fieldValue}
          onChange={(event) => setFieldValue(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              submitFieldAnswer();
            }
          }}
          placeholder={fieldInstruction?.inputPlaceholder || 'Preencha este campo, salve a resposta ou pule para manter pendente.'}
          className="mt-3 min-h-[116px] rounded-radius-lg border-border-default bg-white text-sm"
        />
      ) : null}

      {question.kind === 'field' ? (
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" className="h-9 gap-2" onClick={submitFieldAnswer} disabled={!fieldValue.trim()}>
            <Check className="h-4 w-4" />
            Salvar resposta
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-2">
            {(question.options || []).map((option) => {
              const isSelected = selectedOptionId === option.id && !isSkipped;

              return (
                <ReferenceTermOptionButton
                  key={option.id}
                  option={option}
                  isSelected={isSelected}
                  onClick={() => selectOption(option.id)}
                />
              );
            })}
          </div>

          {selectedOptionFields.length > 0 ? (
            <div className="mt-3 space-y-3 rounded-radius-lg border border-border-default/70 bg-surface-subtle/25 p-3">
              {selectedOptionFields.map((field) => (
                field.kind === 'choice' ? (
                  <div key={field.label} className="grid gap-2">
                    <span className="font-ui text-sm font-semibold text-text-primary">{field.label}</span>
                    <span className="font-ui text-xs leading-5 text-text-secondary">{field.instruction}</span>
                    <div className="grid gap-2">
                      {field.choices.map((choice) => {
                        const isChoiceSelected = inlineChoiceSelections[field.key] === choice.key;

                        return (
                          <button
                            key={choice.key}
                            type="button"
                            className={cn(
                              'w-full rounded-radius-lg border px-3 py-2 text-left text-sm transition-all duration-200',
                              isChoiceSelected
                                ? 'border-primary/35 bg-primary/[0.08] text-text-primary shadow-soft'
                                : 'border-border-default bg-white text-text-secondary hover:border-primary/20 hover:bg-primary/[0.04]',
                            )}
                            onClick={() => {
                              setOptionValues((current) => {
                                const next = { ...current };
                                for (const item of field.choices) {
                                  next[item.key] = item.key === choice.key && !item.requiresInput ? item.value || current[item.key] || '' : '';
                                }
                                return next;
                              });
                              setInlineChoiceSelections((selections) => ({
                                ...selections,
                                [field.key]: choice.key,
                              }));
                            }}
                          >
                            {choice.label}
                          </button>
                        );
                      })}
                    </div>
                    {field.choices
                      .filter((choice) => choice.requiresInput && inlineChoiceSelections[field.key] === choice.key)
                      .map((choice) => (
                        <Textarea
                          key={`${choice.key}-input`}
                          value={getInlineChoiceInputValue(choice, optionValues[choice.key])}
                          onChange={(event) =>
                            setOptionValues((current) => ({
                              ...current,
                              [choice.key]: buildInlineChoiceStoredValue(choice, event.target.value),
                            }))
                          }
                          placeholder={choice.inputPlaceholder || 'Preencha este trecho com base no processo.'}
                          className="min-h-[76px] rounded-radius-lg border-border-default bg-white text-sm"
                        />
                      ))}
                  </div>
                ) : (
                  <label key={field.key} className="grid gap-1.5">
                    <span className="font-ui text-sm font-semibold text-text-primary">{field.instruction.label}</span>
                    <span className="font-ui text-xs leading-5 text-text-secondary">{field.instruction.instruction}</span>
                    <span className="font-ui text-xs text-text-muted">
                      Campo da clausula: <span className="font-medium text-text-primary">{field.instruction.modelField}</span>
                    </span>
                    <Textarea
                      value={optionValues[field.key] || ''}
                      onChange={(event) =>
                        setOptionValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.instruction.inputPlaceholder}
                      className="min-h-[76px] rounded-radius-lg border-border-default bg-white text-sm"
                    />
                  </label>
                )
              ))}

              <div className="flex justify-end">
                <Button type="button" className="h-9 gap-2" onClick={submitOptionAnswer} disabled={!canSubmitOptionAnswer}>
                  <Check className="h-4 w-4" />
                  Salvar resposta
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReferenceTermOriginalTextHover({
  originalText,
  className,
}: {
  originalText: string;
  className?: string;
}) {
  if (!originalText.trim()) return null;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-radius-sm text-xs font-medium text-text-secondary underline decoration-border-default underline-offset-2 transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
      title={originalText}
    >
      <FileText className="h-3.5 w-3.5" />
      Ver texto original do TR
    </button>
  );
}

function getQuestionOptionById(
  question: Pick<DocumentTemplateQuestion, 'options'>,
  optionId?: string,
) {
  if (!optionId) return undefined;
  return (question.options || []).find((option) => option.id === optionId);
}

function getQuestionAnswerMissingOptionFields(
  question: DocumentTemplateQuestion,
  answer?: ReferenceTermQuestionAnswer,
) {
  if (!answer || answer.skipped || (question.kind !== 'exclusive' && question.kind !== 'optional')) {
    return [];
  }

  const option = getQuestionOptionById(question, answer.selectedOptionId);
  if (!option) return [];

  return buildReferenceTermOptionFields(option).filter((field) => {
    if (field.kind === 'choice') {
      return !field.choices.some((choice) => (answer.optionValues?.[choice.key] || answer.optionValues?.[choice.placeholder])?.trim());
    }

    return !(answer.optionValues?.[field.key] || answer.optionValues?.[field.placeholder])?.trim();
  });
}

function isReferenceTermQuestionAnswered(
  question: DocumentTemplateQuestion,
  answer?: ReferenceTermQuestionAnswer,
) {
  if (!answer || answer.skipped) return false;

  if (question.kind === 'field') {
    return Boolean(answer.value?.trim());
  }

  if (!answer.selectedOptionId) {
    return false;
  }

  return getQuestionAnswerMissingOptionFields(question, answer).length === 0;
}

function ReferenceTermOptionButton({
  option,
  isSelected,
  onClick,
}: {
  option: NonNullable<DocumentTemplateQuestion['options']>[number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const optionPreview = buildReferenceTermOptionPreview(option);
  return (
    <button
      type="button"
      onClick={onClick}
      title={optionPreview.originalText || 'Passe o mouse para ver o texto original do TR'}
      className={cn(
        'w-full rounded-radius-lg border px-3 py-2.5 text-left transition-all duration-200',
        isSelected
          ? 'border-primary/35 bg-primary/[0.08] text-text-primary shadow-soft'
          : 'border-border-default bg-surface-subtle/40 text-text-secondary hover:border-primary/20 hover:bg-primary/[0.04]',
      )}
    >
      <span className="block font-ui text-sm font-semibold leading-6">{optionPreview.summary}</span>
    </button>
  );
}

function ReferenceTermSuggestionReviewCard({
  question,
  sourceText,
  review,
  onChange,
  onApprove,
  onReject,
}: {
  question: DocumentTemplateQuestion;
  sourceText?: string;
  review: ReferenceTermSuggestionReview;
  onChange: (review: ReferenceTermSuggestionReview) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isApproved = review.decision === 'approved';
  const isRejected = review.decision === 'rejected';
  const canApprove = review.kind === 'field'
    ? Boolean((review.editedValue ?? review.value ?? '').trim())
    : Boolean(review.editedSelectedOptionId ?? review.selectedOptionId);
  const fieldInstruction = question.kind === 'field' ? buildReferenceTermFieldInstruction(question, sourceText) : null;

  return (
    <div
      className={cn(
        'rounded-radius-xl border bg-surface-card p-4 shadow-xs transition-all duration-200',
        isApproved
          ? 'border-status-success/25 bg-status-success/[0.04]'
          : isRejected
            ? 'border-warning/25 bg-warning/[0.06]'
            : 'border-border-default',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] text-primary">
              Sugestao da IA
            </Badge>
            <Badge variant="outline" className="border-border-default bg-surface-subtle text-text-secondary">
              {review.confidence === 'high' ? 'Alta confianca' : 'Confianca media'}
            </Badge>
            {isApproved ? (
              <Badge variant="outline" className="border-status-success/25 bg-status-success/10 text-foreground">
                Aprovada
              </Badge>
            ) : null}
            {isRejected ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                Vai para pendencias
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 font-ui text-sm font-semibold text-text-primary">{question.title}</p>
          <p className="mt-1 font-ui text-sm leading-6 text-text-secondary">{question.prompt}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReject}>
            Rejeitar
          </Button>
          <Button type="button" size="sm" className="gap-2" onClick={onApprove} disabled={!canApprove}>
            <Check className="h-4 w-4" />
            Aprovar
          </Button>
        </div>
      </div>

      {review.kind === 'field' ? (
        <>
          {fieldInstruction ? (
            <div className="mt-3 rounded-radius-lg border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
              <p className="font-ui text-sm leading-6 text-text-primary">{fieldInstruction.instruction}</p>
              <p className="mt-1 font-ui text-xs leading-5 text-text-secondary">
                Campo do modelo: <span className="font-medium text-text-primary">{fieldInstruction.modelField}</span>
              </p>
              {sourceText ? <ReferenceTermOriginalTextHover originalText={sourceText} className="mt-2" /> : null}
            </div>
          ) : null}
          <Textarea
            value={review.editedValue ?? review.value ?? ''}
            onChange={(event) => onChange({ ...review, editedValue: event.target.value, decision: 'pending' })}
            className="mt-3 min-h-[88px] rounded-radius-lg border-border-default bg-white text-sm"
          />
        </>
      ) : (
        <div className="mt-3 grid gap-2">
          {(question.options || []).map((option) => {
            const selectedOptionId = review.editedSelectedOptionId ?? review.selectedOptionId;
            const isSelected = selectedOptionId === option.id;

            return (
              <ReferenceTermOptionButton
                key={option.id}
                option={option}
                isSelected={isSelected}
                onClick={() => onChange({ ...review, editedSelectedOptionId: option.id, decision: 'pending' })}
              />
            );
          })}
        </div>
      )}

      <div className="mt-3 grid gap-2 rounded-radius-lg border border-border-default/70 bg-surface-subtle/35 p-3">
        <label className="grid gap-1">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Justificativa</span>
          <Textarea
            value={review.editedJustification ?? review.justification ?? ''}
            onChange={(event) => onChange({ ...review, editedJustification: event.target.value, decision: 'pending' })}
            className="min-h-[64px] rounded-radius-lg border-border-default bg-white text-sm"
          />
        </label>
        <p className="font-ui text-xs leading-5 text-text-secondary">
          Fonte: pagina {review.sourcePage}. {review.sourceExcerpt}
        </p>
      </div>
    </div>
  );
}

function PreliminaryStudyQuestionCard({
  question,
  answer,
  onAnswer,
  onSkip,
  onGenerateText,
}: {
  question: PreliminaryStudyQuestion;
  answer?: PreliminaryStudyQuestionAnswer;
  onAnswer: (answer: PreliminaryStudyQuestionAnswer) => void;
  onSkip: () => void;
  onGenerateText: (currentValue: string) => Promise<string>;
}) {
  const [value, setValue] = useState(answer?.value || '');
  const [generatedByAi, setGeneratedByAi] = useState(answer?.origin === 'ai');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [generationError, setGenerationError] = useState('');

  useEffect(() => {
    setValue(answer?.value || '');
    setGeneratedByAi(answer?.origin === 'ai');
    setGenerationError('');
  }, [answer?.origin, answer?.value, question.id]);

  const handleGenerateText = async () => {
    setGenerationError('');
    setIsGeneratingText(true);
    try {
      const generatedText = await onGenerateText(value);
      if (!generatedText.trim()) {
        setGenerationError('A IA nao retornou texto para esta secao.');
        return;
      }
      setValue(generatedText);
      setGeneratedByAi(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel gerar o texto da secao.';
      setGenerationError(message);
    } finally {
      setIsGeneratingText(false);
    }
  };

  return (
    <div className="space-y-4 rounded-radius-xl border border-border-default bg-surface-card p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-ui text-sm font-semibold text-text-primary">{question.title}</p>
          {question.required ? (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
              Obrigatorio
            </Badge>
          ) : null}
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={question.placeholder}
        className="min-h-[240px] resize-y rounded-radius-lg border-border-default bg-surface-subtle/35 text-sm text-text-primary"
      />
      {generationError ? (
        <p className="font-ui text-xs leading-5 text-warning">{generationError}</p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" className="h-9" onClick={onSkip}>
          Pular
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={handleGenerateText}
            disabled={isGeneratingText}
          >
            {isGeneratingText ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar texto com IA
          </Button>
          <Button
            type="button"
            className="h-9"
            onClick={() =>
              onAnswer({
                questionId: question.id,
                value,
                skipped: false,
                origin: generatedByAi ? 'ai' : 'user',
                approved: generatedByAi || undefined,
              })
            }
            disabled={!value.trim()}
          >
            Salvar resposta
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreliminaryStudySuggestionReviewCard({
  question,
  review,
  onChange,
  onApprove,
  onReject,
}: {
  question: PreliminaryStudyQuestion;
  review: PreliminaryStudySuggestionReview;
  onChange: (review: PreliminaryStudySuggestionReview) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const value = review.editedValue ?? review.value ?? '';
  const justification = review.editedJustification ?? review.justification ?? '';

  return (
    <div
      className={cn(
        'rounded-radius-xl border p-4 transition-all duration-200',
        review.decision === 'approved'
          ? 'border-status-success/25 bg-status-success/10'
          : review.decision === 'rejected'
            ? 'border-border-default bg-surface-subtle/40 opacity-70'
            : 'border-border-default bg-surface-card',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="font-ui text-sm font-semibold text-text-primary">{question.title}</p>
            {question.required ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                Obrigatorio
              </Badge>
            ) : null}
          </div>
          <p className="font-ui text-xs leading-5 text-text-secondary">{question.prompt}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onReject}>
            Rejeitar
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={onApprove}>
            Aprovar
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Textarea
          value={value}
          onChange={(event) => onChange({ ...review, editedValue: event.target.value })}
          className="min-h-[96px] resize-none rounded-radius-lg border-border-default bg-white text-sm"
        />
        <label className="grid gap-1.5">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Justificativa
          </span>
          <Textarea
            value={justification}
            onChange={(event) => onChange({ ...review, editedJustification: event.target.value })}
            className="min-h-[64px] resize-none rounded-radius-lg border-border-default bg-white text-xs"
          />
        </label>
        <p className="font-ui text-xs leading-5 text-text-secondary">
          Fonte: {review.sourcePage ? `pagina ${review.sourcePage}` : review.sourceLabel || 'ETP editado no editor'}. {review.sourceExcerpt}
        </p>
      </div>
    </div>
  );
}

const VALID_MODEL_IDS: SupportedDocumentType[] = [
  'despacho-liquidacao',
  'contrato-servico-ifrn',
  'termo-referencia-compras',
  'estudo-tecnico-preliminar-servicos-continuos',
];

export default function EditorDocumentos() {
  const { empenhos, contratos, contratosEmpenhos } = useData();
  const { modelId } = useParams<{ modelId?: string }>();
  const navigate = useNavigate();
  const editorCardRef = useRef<HTMLDivElement | null>(null);
  const preliminaryStudySupplementalInputRef = useRef<HTMLInputElement | null>(null);

  // Deriva o modelo ativo da URL; fallback para despacho-liquidacao
  const activeDocumentId: SupportedDocumentType =
    VALID_MODEL_IDS.includes(modelId as SupportedDocumentType)
      ? (modelId as SupportedDocumentType)
      : 'despacho-liquidacao';

  const setActiveDocumentId = (documentType: SupportedDocumentType) => {
    navigate(`/editor-documentos/${documentType}`, { replace: true });
  };
  const [processInput, setProcessInput] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('neutral');
  const [pendingCandidates, setPendingCandidates] = useState<ResolvedDocumentContext[]>([]);
  const [pendingContractCandidates, setPendingContractCandidates] = useState<ContractTemplateCandidate[]>([]);
  const [pendingContractGeneration, setPendingContractGeneration] = useState<PendingContractGeneration | null>(null);
  const [pendingReferenceTermGeneration, setPendingReferenceTermGeneration] = useState<PendingReferenceTermGeneration | null>(null);
  const [pendingPreliminaryStudyGeneration, setPendingPreliminaryStudyGeneration] =
    useState<PendingPreliminaryStudyGeneration | null>(null);
  const [referenceTermAnswers, setReferenceTermAnswers] = useState<Record<string, ReferenceTermQuestionAnswer>>({});
  const [referenceTermSuggestionReviews, setReferenceTermSuggestionReviews] = useState<ReferenceTermSuggestionReview[]>([]);
  const [referenceTermManualQuestionIds, setReferenceTermManualQuestionIds] = useState<string[]>([]);
  const [referenceTermQuestionIndex, setReferenceTermQuestionIndex] = useState(0);
  const [preliminaryStudyAnswers, setPreliminaryStudyAnswers] = useState<Record<string, PreliminaryStudyQuestionAnswer>>({});
  const [preliminaryStudySuggestionReviews, setPreliminaryStudySuggestionReviews] = useState<PreliminaryStudySuggestionReview[]>([]);
  const [preliminaryStudyManualQuestionIds, setPreliminaryStudyManualQuestionIds] = useState<string[]>([]);
  const [preliminaryStudyQuestionIndex, setPreliminaryStudyQuestionIndex] = useState(0);
  const [editorContent, setEditorContent] = useState('<p></p>');
  const [selectedTitle, setSelectedTitle] = useState('Despacho de Liquidacao');
  const [generatedDispatches, setGeneratedDispatches] = useState<GeneratedDispatch[]>([]);
  const [copiedDispatchIds, setCopiedDispatchIds] = useState<string[]>([]);
  const [copiedSectionIds, setCopiedSectionIds] = useState<string[]>([]);
  const [clonedDispatchIds, setClonedDispatchIds] = useState<string[]>([]);
  const [downloadedDocxIds, setDownloadedDocxIds] = useState<string[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [generationProcessIds, setGenerationProcessIds] = useState<string[]>([]);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [preliminaryStudySupplementalAnalyses, setPreliminaryStudySupplementalAnalyses] = useState<PreliminaryStudySupplementalAttachmentAnalysis[]>([]);
  const [isAnalyzingPreliminaryStudySupplementalAttachment, setIsAnalyzingPreliminaryStudySupplementalAttachment] = useState(false);

  const resources = useMemo(
    () => ({ empenhos, contratos, contratosEmpenhos }),
    [empenhos, contratos, contratosEmpenhos],
  );

  const activeDocument = documentDefinitions.find((document) => document.id === activeDocumentId) || documentDefinitions[0];
  const isContractDocument = activeDocumentId === 'contrato-servico-ifrn';
  const isReferenceTermDocument = activeDocumentId === 'termo-referencia-compras';
  const isPreliminaryStudyDocument = activeDocumentId === 'estudo-tecnico-preliminar-servicos-continuos';
  const etpInstitutionalContext = useMemo(
    () => getEtpInstitutionalContextById(defaultEtpInstitutionalContextId),
    [],
  );
  const etpInstitutionalSnippet = useMemo(
    () => (etpInstitutionalContext ? buildEtpInstitutionalContextSnippet(etpInstitutionalContext) : null),
    [etpInstitutionalContext],
  );
  const preliminaryStudySupplementalSnippets = useMemo(
    () => [
      ...preliminaryStudySupplementalAnalyses.flatMap((analysis) => analysis.snippets),
      ...(etpInstitutionalSnippet ? [etpInstitutionalSnippet] : []),
    ],
    [etpInstitutionalSnippet, preliminaryStudySupplementalAnalyses],
  );

  const {
    data: syncedProcesses = [],
    isLoading: isLoadingSyncedProcesses,
    isError: isSyncedProcessesError,
  } = useQuery({
    queryKey: ['suap-processos', 'editor-exemplos'],
    queryFn: suapProcessosService.getAll,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const exampleProcesses = useMemo<ExampleProcessCard[]>(
    () =>
      [...syncedProcesses]
        .filter((processo) => processo.numProcesso || processo.suapId)
        .sort((left, right) => {
          const leftHasProcessNumber = Boolean(left.numProcesso?.trim());
          const rightHasProcessNumber = Boolean(right.numProcesso?.trim());

          if (leftHasProcessNumber !== rightHasProcessNumber) {
            return Number(rightHasProcessNumber) - Number(leftHasProcessNumber);
          }

          return (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0);
        })
        .map((processo) => ({
          id: processo.id,
          processo: processo.numProcesso?.trim() || `SUAP ${processo.suapId}`,
          beneficiario: processo.beneficiario || processo.assunto,
          processoCompleto: processo,
        })),
    [syncedProcesses],
  );

  const selectedProcess = useMemo(
    () => exampleProcesses.find((processo) => processo.id === selectedProcessId)?.processoCompleto || null,
    [exampleProcesses, selectedProcessId],
  );
  const generationProcesses = useMemo(
    () =>
      generationProcessIds
        .map((id) => exampleProcesses.find((processo) => processo.id === id)?.processoCompleto || null)
        .filter((processo): processo is SuapProcesso => Boolean(processo)),
    [exampleProcesses, generationProcessIds],
  );
  const findSyncedProcessByNumber = (processNumber: string) =>
    syncedProcesses.find((processo) => normalizeProcessNumber(processo.numProcesso) === normalizeProcessNumber(processNumber));
  const visibleRetencoes = useMemo(
    () =>
      selectedProcess
        ? ([
            ['ISS', selectedProcess.dadosCompletos?.retencoes_tributarias?.iss],
            ['INSS', selectedProcess.dadosCompletos?.retencoes_tributarias?.inss],
            ['IR', selectedProcess.dadosCompletos?.retencoes_tributarias?.ir],
            ['CSLL', selectedProcess.dadosCompletos?.retencoes_tributarias?.csll],
            ['COFINS', selectedProcess.dadosCompletos?.retencoes_tributarias?.cofins],
            ['PIS/PASEP', selectedProcess.dadosCompletos?.retencoes_tributarias?.pis_pasep],
          ] as Array<[string, string | undefined]>).filter(([, value]) => isCopyableValue(value))
        : [],
    [selectedProcess],
  );

  const focusEditor = () => {
    window.setTimeout(() => {
      if (typeof editorCardRef.current?.scrollIntoView === 'function') {
        editorCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const editable = editorCardRef.current?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      editable?.focus();
    }, 0);
  };

  const resetPreliminaryStudySupplementalFiles = () => {
    setPreliminaryStudySupplementalAnalyses([]);
    if (preliminaryStudySupplementalInputRef.current) {
      preliminaryStudySupplementalInputRef.current.value = '';
    }
  };

  const resetPendingStates = () => {
    setPendingCandidates([]);
    setPendingContractCandidates([]);
    setPendingContractGeneration(null);
    setPendingReferenceTermGeneration(null);
    setPendingPreliminaryStudyGeneration(null);
    setReferenceTermAnswers({});
    setReferenceTermSuggestionReviews([]);
    setReferenceTermManualQuestionIds([]);
    setReferenceTermQuestionIndex(0);
    setPreliminaryStudyAnswers({});
    setPreliminaryStudySuggestionReviews([]);
    setPreliminaryStudyManualQuestionIds([]);
    setPreliminaryStudyQuestionIndex(0);
  };

  const handleAddPreliminaryStudySupplementalAttachments = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (preliminaryStudySupplementalInputRef.current) {
      preliminaryStudySupplementalInputRef.current.value = '';
    }
    if (selectedFiles.length === 0) return;

    const availableSlots = PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES - preliminaryStudySupplementalAnalyses.length;
    if (availableSlots <= 0) {
      toast.warning(`O limite e de ${PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES} anexos auxiliares.`);
      return;
    }

    const filesToAnalyze = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      toast.warning(`Somente ${availableSlots} arquivo(s) foram adicionados por causa do limite.`);
    }

    setIsAnalyzingPreliminaryStudySupplementalAttachment(true);
    try {
      const analyses = await Promise.all(filesToAnalyze.map((file) => analyzePreliminaryStudySupplementalAttachmentFile(file)));
      setPreliminaryStudySupplementalAnalyses((current) => [...current, ...analyses]);

      const warningCount = analyses.reduce((count, analysis) => count + analysis.warnings.length, 0);
      const snippetCount = analyses.reduce((count, analysis) => count + analysis.snippets.length, 0);
      if (snippetCount > 0) {
        toast.success(`${snippetCount} trecho(s) extraido(s) dos anexos auxiliares.`);
      }
      if (warningCount > 0) {
        toast.warning('Um ou mais anexos auxiliares exigem revisao.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel analisar o anexo auxiliar.';
      toast.error(message);
    } finally {
      setIsAnalyzingPreliminaryStudySupplementalAttachment(false);
    }
  };

  const handleRemovePreliminaryStudySupplementalAttachment = (fileName: string) => {
    setPreliminaryStudySupplementalAnalyses((current) => current.filter((analysis) => analysis.fileName !== fileName));
  };

  const effectiveReferenceTermQuestionnaireSchema = useMemo(
    () => sanitizeReferenceTermQuestionnaireSchema(
      pendingReferenceTermGeneration?.template.questionnaireSchema,
      pendingReferenceTermGeneration?.template.editableBlocks,
    ),
    [pendingReferenceTermGeneration?.template.editableBlocks, pendingReferenceTermGeneration?.template.questionnaireSchema],
  );
  const referenceTermQuestions = effectiveReferenceTermQuestionnaireSchema?.questions || [];
  const referenceTermQuestionSourceById = useMemo(
    () =>
      new Map(
        referenceTermQuestions.map((question) => [
          question.id,
          getReferenceTermQuestionSourceText(question, pendingReferenceTermGeneration?.template.editableBlocks),
        ]),
      ),
    [pendingReferenceTermGeneration?.template.editableBlocks, referenceTermQuestions],
  );
  const answeredReferenceTermQuestions = referenceTermQuestions.filter((question) => {
    const answer = referenceTermAnswers[question.id];
    return isReferenceTermQuestionAnswered(question, answer);
  }).length;
  const skippedReferenceTermQuestions = referenceTermQuestions.filter((question) => referenceTermAnswers[question.id]?.skipped).length;
  const completedReferenceTermQuestions = answeredReferenceTermQuestions + skippedReferenceTermQuestions;
  const referenceTermQuestionById = new Map(referenceTermQuestions.map((question) => [question.id, question]));
  const referenceTermManualQuestions = referenceTermManualQuestionIds
    .map((questionId) => referenceTermQuestionById.get(questionId))
    .filter((question): question is DocumentTemplateQuestion => Boolean(question));
  const currentReferenceTermQuestion =
    referenceTermManualQuestions[Math.min(referenceTermQuestionIndex, Math.max(referenceTermManualQuestions.length - 1, 0))];
  const isReferenceTermQuestionnaireReviewStep =
    referenceTermManualQuestions.length > 0 && referenceTermQuestionIndex >= referenceTermManualQuestions.length;
  const referenceTermQuestionProgress = referenceTermQuestions.length
    ? Math.round((completedReferenceTermQuestions / referenceTermQuestions.length) * 100)
    : 0;
  const pendingReferenceTermSuggestionReviews = referenceTermSuggestionReviews.filter((review) => review.decision !== 'rejected');
  const approvedReferenceTermSuggestionReviews = referenceTermSuggestionReviews.filter((review) => review.decision === 'approved');

  const preliminaryStudyQuestionById = new Map(preliminaryStudyQuestions.map((question) => [question.id, question]));
  const preliminaryStudyManualQuestions = preliminaryStudyManualQuestionIds
    .map((questionId) => preliminaryStudyQuestionById.get(questionId))
    .filter((question): question is PreliminaryStudyQuestion => Boolean(question));
  const currentPreliminaryStudyQuestion =
    preliminaryStudyManualQuestions[
      Math.min(preliminaryStudyQuestionIndex, Math.max(preliminaryStudyManualQuestions.length - 1, 0))
    ];
  const isPreliminaryStudyQuestionnaireReviewStep =
    preliminaryStudyManualQuestions.length > 0 && preliminaryStudyQuestionIndex >= preliminaryStudyManualQuestions.length;
  const answeredPreliminaryStudyQuestions = preliminaryStudyQuestions.filter((question) =>
    isPreliminaryStudyQuestionAnswered(preliminaryStudyAnswers[question.id]),
  ).length;
  const skippedPreliminaryStudyQuestions = preliminaryStudyQuestions.filter((question) => preliminaryStudyAnswers[question.id]?.skipped).length;
  const completedPreliminaryStudyQuestions = answeredPreliminaryStudyQuestions + skippedPreliminaryStudyQuestions;
  const preliminaryStudyQuestionProgress = preliminaryStudyQuestions.length
    ? Math.round((completedPreliminaryStudyQuestions / preliminaryStudyQuestions.length) * 100)
    : 0;
  const pendingPreliminaryStudySuggestionReviews = preliminaryStudySuggestionReviews.filter((review) => review.decision !== 'rejected');
  const approvedPreliminaryStudySuggestionReviews = preliminaryStudySuggestionReviews.filter((review) => review.decision === 'approved');

  const advanceReferenceTermQuestion = () => {
    setReferenceTermQuestionIndex((current) => Math.min(current + 1, referenceTermManualQuestions.length));
  };

  const setReferenceTermAnswer = (answer: ReferenceTermQuestionAnswer) => {
    setReferenceTermAnswers((current) => ({
      ...current,
      [answer.questionId]: answer,
    }));
  };

  const skipReferenceTermQuestion = (question: DocumentTemplateQuestion) => {
    setReferenceTermAnswer({
      questionId: question.id,
      kind: question.kind,
      skipped: true,
    });
    advanceReferenceTermQuestion();
  };

  const cancelReferenceTermQuestionnaire = () => {
    setPendingReferenceTermGeneration(null);
    setReferenceTermAnswers({});
    setReferenceTermSuggestionReviews([]);
    setReferenceTermManualQuestionIds([]);
    setReferenceTermQuestionIndex(0);
    setScreenState('idle');
    setFeedback('Questionario do Termo de Referencia cancelado.');
    setFeedbackTone('neutral');
  };

  const buildReferenceTermQuestionnaireAnswers = () =>
    referenceTermQuestions.map((question) => {
      const answer = referenceTermAnswers[question.id];
      return answer || {
        questionId: question.id,
        kind: question.kind,
        skipped: true,
      };
    });

  const suggestionReviewToAnswer = (review: ReferenceTermSuggestionReview): ReferenceTermQuestionAnswer | null => {
    if (review.status !== 'suggested' || review.decision !== 'approved') {
      return null;
    }

    const selectedOptionId = review.editedSelectedOptionId ?? review.selectedOptionId;
    const value = (review.editedValue ?? review.value ?? '').trim();
    const justification = (review.editedJustification ?? review.justification ?? '').trim();

    if ((review.kind === 'exclusive' || review.kind === 'optional') && !selectedOptionId) {
      return null;
    }

    if (review.kind === 'field' && !value) {
      return null;
    }

    return {
      questionId: review.questionId,
      kind: review.kind,
      selectedOptionId: selectedOptionId || undefined,
      value: value || undefined,
      optionValues: undefined,
      skipped: false,
      origin: 'ai',
      approved: true,
      confidence: review.confidence,
      sourcePage: review.sourcePage,
      sourceExcerpt: review.sourceExcerpt,
      justification: justification || undefined,
    };
  };

  const buildApprovedSuggestionAnswers = (reviews = referenceTermSuggestionReviews) => {
    const answers: Record<string, ReferenceTermQuestionAnswer> = {};

    for (const review of reviews) {
      const answer = suggestionReviewToAnswer(review);
      if (answer) {
        answers[answer.questionId] = answer;
      }
    }

    return answers;
  };

  const continueAfterReferenceTermSuggestions = async (reviews = referenceTermSuggestionReviews) => {
    if (!pendingReferenceTermGeneration) return;

    const approvedAnswers = buildApprovedSuggestionAnswers(reviews);
    const nextAnswers = {
      ...referenceTermAnswers,
      ...approvedAnswers,
    };
    const pendingQuestionIds = referenceTermQuestions
      .filter((question) => !isReferenceTermQuestionAnswered(question, nextAnswers[question.id]))
      .map((question) => question.id);

    setReferenceTermAnswers(nextAnswers);
    setReferenceTermManualQuestionIds(pendingQuestionIds);
    setReferenceTermQuestionIndex(0);

    if (pendingQuestionIds.length === 0) {
      await handleGenerateReferenceTermDraft(
        pendingReferenceTermGeneration.processo,
        pendingReferenceTermGeneration.analysis,
        pendingReferenceTermGeneration.template,
        referenceTermQuestions.map((question) => nextAnswers[question.id]).filter(Boolean),
      );
      return;
    }

    setFeedback(`${pendingQuestionIds.length} pergunta(s) ainda precisam de revisao manual.`);
    setFeedbackTone('neutral');
    setScreenState('reference_questionnaire');
  };

  const approveReferenceTermSuggestion = (questionId: string) => {
    setReferenceTermSuggestionReviews((current) => {
      const next = current.map((review) => (
        review.questionId === questionId ? { ...review, decision: 'approved' as const } : review
      ));
      setReferenceTermAnswers((answers) => ({
        ...answers,
        ...buildApprovedSuggestionAnswers(next),
      }));
      return next;
    });
  };

  const rejectReferenceTermSuggestion = (questionId: string) => {
    setReferenceTermSuggestionReviews((current) => current.map((review) => (
      review.questionId === questionId ? { ...review, decision: 'rejected' as const } : review
    )));
    setReferenceTermAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const updateReferenceTermSuggestionReview = (updatedReview: ReferenceTermSuggestionReview) => {
    setReferenceTermSuggestionReviews((current) => current.map((review) => (
      review.questionId === updatedReview.questionId ? updatedReview : review
    )));
    setReferenceTermAnswers((current) => {
      const next = { ...current };
      delete next[updatedReview.questionId];
      return next;
    });
  };

  const approveAllReferenceTermSuggestions = () => {
    setReferenceTermSuggestionReviews((current) => {
      const next = current.map((review) => (
        review.status === 'suggested' ? { ...review, decision: 'approved' as const } : review
      ));
      setReferenceTermAnswers((answers) => ({
        ...answers,
        ...buildApprovedSuggestionAnswers(next),
      }));
      return next;
    });
  };

  const advancePreliminaryStudyQuestion = () => {
    setPreliminaryStudyQuestionIndex((current) => Math.min(current + 1, preliminaryStudyManualQuestions.length));
  };

  const setPreliminaryStudyAnswer = (answer: PreliminaryStudyQuestionAnswer) => {
    setPreliminaryStudyAnswers((current) => ({
      ...current,
      [answer.questionId]: answer,
    }));
  };

  const skipPreliminaryStudyQuestion = (question: PreliminaryStudyQuestion) => {
    setPreliminaryStudyAnswer({
      questionId: question.id,
      skipped: true,
    });
    advancePreliminaryStudyQuestion();
  };

  const cancelPreliminaryStudyQuestionnaire = () => {
    setPendingPreliminaryStudyGeneration(null);
    setPreliminaryStudyAnswers({});
    setPreliminaryStudySuggestionReviews([]);
    setPreliminaryStudyManualQuestionIds([]);
    setPreliminaryStudyQuestionIndex(0);
    resetPreliminaryStudySupplementalFiles();
    setScreenState('idle');
    setFeedback('Questionario do ETP cancelado.');
    setFeedbackTone('neutral');
  };

  const preliminaryStudySuggestionReviewToAnswer = (
    review: PreliminaryStudySuggestionReview,
  ): PreliminaryStudyQuestionAnswer | null => {
    if (review.status !== 'suggested' || review.decision !== 'approved') {
      return null;
    }

    const value = (review.editedValue ?? review.value ?? '').trim();
    const justification = (review.editedJustification ?? review.justification ?? '').trim();
    if (!value) return null;

    return {
      questionId: review.questionId,
      value,
      skipped: false,
      origin: 'ai',
      approved: true,
      confidence: review.confidence,
      sourcePage: review.sourcePage,
      sourceType: review.sourceType,
      sourceLabel: review.sourceLabel,
      sourceExcerpt: review.sourceExcerpt,
      justification: justification || undefined,
    };
  };

  const buildApprovedPreliminaryStudySuggestionAnswers = (reviews = preliminaryStudySuggestionReviews) => {
    const answers: Record<string, PreliminaryStudyQuestionAnswer> = {};

    for (const review of reviews) {
      const answer = preliminaryStudySuggestionReviewToAnswer(review);
      if (answer) {
        answers[answer.questionId] = answer;
      }
    }

    return answers;
  };

  const continueAfterPreliminaryStudySuggestions = async (reviews = preliminaryStudySuggestionReviews) => {
    if (!pendingPreliminaryStudyGeneration) return;

    const approvedAnswers = buildApprovedPreliminaryStudySuggestionAnswers(reviews);
    const nextAnswers = {
      ...preliminaryStudyAnswers,
      ...approvedAnswers,
    };
    const pendingQuestionIds = preliminaryStudyQuestions
      .filter((question) => !isPreliminaryStudyQuestionAnswered(nextAnswers[question.id]))
      .map((question) => question.id);

    setPreliminaryStudyAnswers(nextAnswers);
    setPreliminaryStudyManualQuestionIds(pendingQuestionIds);
    setPreliminaryStudyQuestionIndex(0);

    if (pendingQuestionIds.length === 0) {
      await handleGeneratePreliminaryStudyDraft(
        pendingPreliminaryStudyGeneration,
        preliminaryStudyQuestions.map((question) => nextAnswers[question.id]).filter(Boolean),
      );
      return;
    }

    setFeedback(`${pendingQuestionIds.length} pergunta(s) do ETP ainda precisam de revisao manual.`);
    setFeedbackTone('neutral');
    setScreenState('etp_questionnaire');
  };

  const approvePreliminaryStudySuggestion = (questionId: string) => {
    setPreliminaryStudySuggestionReviews((current) => {
      const next = current.map((review) => (
        review.questionId === questionId ? { ...review, decision: 'approved' as const } : review
      ));
      setPreliminaryStudyAnswers((answers) => ({
        ...answers,
        ...buildApprovedPreliminaryStudySuggestionAnswers(next),
      }));
      return next;
    });
  };

  const rejectPreliminaryStudySuggestion = (questionId: string) => {
    setPreliminaryStudySuggestionReviews((current) => current.map((review) => (
      review.questionId === questionId ? { ...review, decision: 'rejected' as const } : review
    )));
    setPreliminaryStudyAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const updatePreliminaryStudySuggestionReview = (updatedReview: PreliminaryStudySuggestionReview) => {
    setPreliminaryStudySuggestionReviews((current) => current.map((review) => (
      review.questionId === updatedReview.questionId ? updatedReview : review
    )));
    setPreliminaryStudyAnswers((current) => {
      const next = { ...current };
      const answer = preliminaryStudySuggestionReviewToAnswer(updatedReview);
      if (answer) {
        next[answer.questionId] = answer;
      }
      return next;
    });
  };

  const approveAllPreliminaryStudySuggestions = () => {
    setPreliminaryStudySuggestionReviews((current) => {
      const next = current.map((review) => (
        review.status === 'suggested' ? { ...review, decision: 'approved' as const } : review
      ));
      setPreliminaryStudyAnswers((answers) => ({
        ...answers,
        ...buildApprovedPreliminaryStudySuggestionAnswers(next),
      }));
      return next;
    });
  };

  const openGeneratedDocument = (
    document: GeneratedDispatch,
    options?: {
      feedbackMessage?: string;
      feedbackTone?: FeedbackTone;
    },
  ) => {
    setSelectedTitle(document.title || activeDocument.name);
    setEditorContent(document.html);
    setGeneratedDispatches([document]);
    setCopiedDispatchIds([]);
    setCopiedSectionIds([]);
    setClonedDispatchIds([]);
    setDownloadedDocxIds([]);
    resetPendingStates();
    setFeedback(options?.feedbackMessage || '');
    setFeedbackTone(options?.feedbackTone || 'neutral');
    setScreenState('idle');
    focusEditor();
  };

  const openContext = (
    context: ResolvedDocumentContext,
    options?: {
      feedbackMessage?: string;
      feedbackTone?: FeedbackTone;
    },
  ) => {
    const html = buildDespachoLiquidacaoHtml(context);
    openGeneratedDocument(
      {
        id: context.candidateId,
        title: context.title || activeDocument.name,
        subtitle: context.subtitle,
        processo: context.processo,
        html,
        documentType: 'despacho-liquidacao',
        allowClone: true,
      },
      options,
    );
  };

  const handleSelectGenerationProcess = (processo: SuapProcesso) => {
    setGenerationProcessIds((current) =>
      current.includes(processo.id) ? current.filter((id) => id !== processo.id) : [...current, processo.id],
    );
    setFeedback('');
    setScreenState('idle');

    if (isContractDocument || isReferenceTermDocument || isPreliminaryStudyDocument) {
      setProcessInput('');
    }
  };

  const handleGenerateContractDraft = async (
    processo: SuapProcesso,
    analysis: ContractPdfAnalysis,
    candidate: ContractTemplateCandidate,
  ) => {
    setFeedback('');
    setScreenState('resolving');

    try {
      const result = await contractDraftsService.generateDraft({ processo, analysis, candidate });

      if (result.status === 'blocked') {
        setFeedback(result.blockedReason || 'Nao foi possivel confirmar um modelo contratual claro neste processo.');
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const warningCount = result.warnings.length + result.missingRequiredFields.length;
      openGeneratedDocument(
        {
          id: candidate.id,
          title: result.title,
          subtitle: result.subtitle || candidate.subtitle,
          processo: processo.numProcesso,
          html: result.html || '<p></p>',
          documentType: 'contrato-servico-ifrn',
          allowClone: false,
        },
        {
          feedbackMessage: warningCount > 0 ? `Contrato gerado com ${warningCount} alerta(s) para revisao.` : 'Contrato gerado.',
          feedbackTone: warningCount > 0 ? 'neutral' : 'success',
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o contrato.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGenerateContract = async (processo: SuapProcesso) => {
    if (!processo.numProcesso?.trim()) {
      const message = 'O processo precisa estar sincronizado com numero valido para gerar contrato.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    if (!processo.pdfUrl) {
      const message = 'Este processo ainda nao possui PDF sincronizado no SUAP.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    setFeedback('');
    resetPendingStates();
    setScreenState('resolving');

    try {
      const analysis = await contractDraftsService.analyzeProcessPdf(processo);

      if (analysis.searchablePageCount === 0) {
        const message = analysis.warnings[0] || 'O PDF do processo nao trouxe texto pesquisavel para a IA.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      if (analysis.templateCandidates.length === 0) {
        const message = analysis.warnings[0] || 'Nao encontrei minuta ou termo de contrato dentro do processo.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      if (analysis.templateCandidates.length > 1) {
        setPendingContractCandidates(analysis.templateCandidates);
        setPendingContractGeneration({ processo, analysis });
        setFeedback(
          analysis.warnings[analysis.warnings.length - 1] ||
            'Encontrei mais de um modelo de contrato possivel. Selecione o correto para continuar.',
        );
        setFeedbackTone('neutral');
        setScreenState('ambiguous');
        return;
      }

      await handleGenerateContractDraft(processo, analysis, analysis.templateCandidates[0]);
      setSelectedProcessId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao analisar o PDF do processo.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGenerateReferenceTermDraft = async (
    processo: SuapProcesso | null | undefined,
    analysis: ReferenceTermPdfAnalysis | null | undefined,
    template: DocumentTemplateRecord,
    questionnaireAnswers: ReferenceTermQuestionAnswer[] = [],
    etpContextSnippets: DocumentContextSnippet[] = [],
  ) => {
    const questionnaireSchema = sanitizeReferenceTermQuestionnaireSchema(
      template.questionnaireSchema,
      template.editableBlocks,
    );

    setFeedback('');
    setScreenState('resolving');

    try {
      const result = await referenceTermsService.generateDraft({
        processo,
        analysis,
        template,
        questionnaireSchema,
        questionnaireAnswers,
        etpContextSnippets,
      });

      if (result.status === 'blocked') {
        setFeedback(result.blockedReason || 'Nao foi possivel gerar o Termo de Referencia com o modelo ativo.');
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const warningCount = result.warnings.length + result.missingRequiredFields.length;
      const fileName = sanitizeFileName(
        `Termo de Referencia - ${processo?.numProcesso || processo?.suapId || 'compras'}.docx`,
      );

      openGeneratedDocument(
        {
          id: `${processo?.id || 'etp-manual'}-termo-referencia-${Date.now()}`,
          title: result.title,
          subtitle: result.subtitle || template.versionLabel || template.fileName,
          processo: processo?.numProcesso,
          html: result.html || '<p></p>',
          documentType: 'termo-referencia-compras',
          allowClone: false,
          allowDocxDownload: Boolean(result.templatePlan),
          docxFileName: fileName,
          docxTemplateBase64: template.templateBase64,
          docxExportPlan: result.templatePlan,
        },
        {
          feedbackMessage:
            warningCount > 0
              ? `Termo de Referencia gerado com ${warningCount} alerta(s) para revisao.`
              : 'Termo de Referencia gerado.',
          feedbackTone: warningCount > 0 ? 'neutral' : 'success',
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o Termo de Referencia.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleContinueReferenceTermQuestionnaire = async () => {
    if (!pendingReferenceTermGeneration) return;

    const answers = buildReferenceTermQuestionnaireAnswers();
    await handleGenerateReferenceTermDraft(
      pendingReferenceTermGeneration.processo,
      pendingReferenceTermGeneration.analysis,
      pendingReferenceTermGeneration.template,
      answers,
      pendingReferenceTermGeneration.etpContextSnippets || [],
    );
  };

  const handleGenerateReferenceTerm = async (processo: SuapProcesso) => {
    if (!processo.numProcesso?.trim()) {
      const message = 'O processo precisa estar sincronizado com numero valido para gerar o Termo de Referencia.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    if (!processo.pdfUrl) {
      const message = 'Este processo ainda nao possui PDF sincronizado no SUAP.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    setFeedback('');
    resetPendingStates();
    setScreenState('resolving');

    try {
      const template = await referenceTermsService.getActiveTemplate();
      if (!template) {
        const message = 'Nao existe modelo ativo para Termo de Referencia - Compras. Publique o DOCX em Modelos de documentos.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (template.editableBlocks.length === 0) {
        const message = 'O modelo ativo nao possui blocos editaveis reconhecidos. Reenvie o DOCX atualizado em Modelos de documentos.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      const analysis = await referenceTermsService.analyzeProcessPdf(processo);

      if (analysis.searchablePageCount === 0) {
        const message = analysis.warnings[0] || 'O PDF do processo nao trouxe texto pesquisavel para a IA.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const questionnaireSchema = sanitizeReferenceTermQuestionnaireSchema(
        template.questionnaireSchema,
        template.editableBlocks,
      );
      const questions = questionnaireSchema?.questions || [];
      if (questions.length > 0) {
        setPendingReferenceTermGeneration({ processo, analysis, template });
        setReferenceTermAnswers({});
        setReferenceTermSuggestionReviews([]);
        setReferenceTermManualQuestionIds(questions.map((question) => question.id));
        setReferenceTermQuestionIndex(0);
        setFeedback(`Analisando processo e sugerindo respostas para ${questions.length} pergunta(s) do modelo AGU.`);
        setFeedbackTone('neutral');
        setScreenState('resolving');
        setSelectedProcessId(null);

        try {
          const suggestionResult = await referenceTermsService.suggestQuestionnaireAnswers({
            processo,
            analysis,
            template,
            questionnaireSchema,
          });
          const suggestedReviews = suggestionResult.suggestions
            .filter((suggestion) => suggestion.status === 'suggested')
            .map((suggestion) => ({
              ...suggestion,
              decision: 'pending' as const,
            }));

          setReferenceTermSuggestionReviews(suggestedReviews);

          if (suggestedReviews.length > 0) {
            setFeedback(`${suggestedReviews.length} sugestao(oes) da IA encontradas com fonte explicita no processo.`);
            setFeedbackTone('success');
            setScreenState('ai_questionnaire_prefill');
            return;
          }

          setFeedback('A IA nao encontrou respostas com fonte explicita. Revise manualmente as perguntas pendentes.');
          setFeedbackTone('warning');
          setScreenState('reference_questionnaire');
          return;
        } catch (suggestionError) {
          const suggestionMessage = suggestionError instanceof Error
            ? suggestionError.message
            : 'Nao foi possivel sugerir respostas automaticamente.';
          setFeedback(`${suggestionMessage} O questionario manual continua disponivel.`);
          setFeedbackTone('warning');
          setScreenState('reference_questionnaire');
          return;
        }
      }

      await handleGenerateReferenceTermDraft(processo, analysis, template);
      setSelectedProcessId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao analisar o PDF do processo.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleProceedFromPreliminaryStudyToReferenceTerm = async (dispatch: GeneratedDispatch) => {
    const etpContextSnippets = buildEtpContextSnippetsFromHtml(editorContent);
    if (etpContextSnippets.length === 0) {
      const message = 'Revise o ETP no editor antes de prosseguir para o Termo de Referencia.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    setFeedback('');
    resetPendingStates();
    setActiveDocumentId('termo-referencia-compras');
    setScreenState('resolving');

    const processo = dispatch.etpContext?.processo || null;

    try {
      const template = await referenceTermsService.getActiveTemplate();
      if (!template) {
        const message = 'Nao existe modelo ativo para Termo de Referencia - Compras. Publique o DOCX em Modelos de documentos.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (template.editableBlocks.length === 0) {
        const message = 'O modelo ativo nao possui blocos editaveis reconhecidos. Reenvie o DOCX atualizado em Modelos de documentos.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      let analysis: ReferenceTermPdfAnalysis | null = null;
      if (processo?.pdfUrl) {
        try {
          analysis = await referenceTermsService.analyzeProcessPdf(processo);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Nao foi possivel analisar o PDF do processo.';
          toast.warning(`${message} O Termo de Referencia usara o ETP editado como fonte principal.`);
        }
      }

      const questionnaireSchema = sanitizeReferenceTermQuestionnaireSchema(
        template.questionnaireSchema,
        template.editableBlocks,
      );
      const questions = questionnaireSchema?.questions || [];

      if (questions.length > 0) {
        setPendingReferenceTermGeneration({ processo, analysis, template, etpContextSnippets });
        setReferenceTermAnswers({});
        setReferenceTermSuggestionReviews([]);
        setReferenceTermManualQuestionIds(questions.map((question) => question.id));
        setReferenceTermQuestionIndex(0);
        setFeedback(`Analisando ETP e sugerindo respostas para ${questions.length} pergunta(s) do modelo AGU.`);
        setFeedbackTone('neutral');

        try {
          const suggestionResult = await referenceTermsService.suggestQuestionnaireAnswers({
            processo,
            analysis,
            template,
            questionnaireSchema,
            etpContextSnippets,
          });
          const suggestedReviews = suggestionResult.suggestions
            .filter((suggestion) => suggestion.status === 'suggested')
            .map((suggestion) => ({
              ...suggestion,
              decision: 'pending' as const,
            }));

          setReferenceTermSuggestionReviews(suggestedReviews);

          if (suggestedReviews.length > 0) {
            setFeedback(`${suggestedReviews.length} sugestao(oes) da IA encontradas com fonte no ETP.`);
            setFeedbackTone('success');
            setScreenState('ai_questionnaire_prefill');
            return;
          }

          setFeedback('A IA nao encontrou respostas suficientes no ETP. Revise manualmente as perguntas pendentes.');
          setFeedbackTone('warning');
          setScreenState('reference_questionnaire');
          return;
        } catch (suggestionError) {
          const suggestionMessage = suggestionError instanceof Error
            ? suggestionError.message
            : 'Nao foi possivel sugerir respostas automaticamente.';
          setFeedback(`${suggestionMessage} O questionario manual continua disponivel com o ETP como contexto.`);
          setFeedbackTone('warning');
          setScreenState('reference_questionnaire');
          return;
        }
      }

      await handleGenerateReferenceTermDraft(processo, analysis, template, [], etpContextSnippets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao iniciar o Termo de Referencia a partir do ETP.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGeneratePreliminaryStudyDraft = async (
    pending: PendingPreliminaryStudyGeneration,
    questionnaireAnswers: PreliminaryStudyQuestionAnswer[] = [],
  ) => {
    setFeedback('');
    setScreenState('resolving');

    try {
      const result = await preliminaryStudiesService.generateDraft({
        processo: pending.processo,
        manualObject: pending.manualObject,
        analysis: pending.analysis,
        questionnaireAnswers,
        supplementalSnippets: pending.supplementalSnippets,
      });

      if (result.status === 'blocked') {
        setFeedback(result.blockedReason || 'Nao foi possivel gerar o ETP.');
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const warningCount = result.warnings.length + result.missingRequiredFields.length;
      const processoLabel = pending.processo?.numProcesso || pending.processo?.suapId;

      openGeneratedDocument(
        {
          id: `${pending.processo?.id || 'manual'}-etp-${Date.now()}`,
          title: result.title,
          subtitle: result.subtitle || (processoLabel ? `Processo ${processoLabel}` : pending.manualObject),
          processo: pending.processo?.numProcesso,
          html: result.html || '<p></p>',
          documentType: 'estudo-tecnico-preliminar-servicos-continuos',
          allowClone: false,
          sections: result.sections || [],
          etpContext: {
            processo: pending.processo || null,
            manualObject: pending.manualObject,
          },
        },
        {
          feedbackMessage:
            warningCount > 0
              ? `ETP gerado com ${warningCount} alerta(s) para revisao.`
              : 'ETP gerado.',
          feedbackTone: warningCount > 0 ? 'neutral' : 'success',
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o ETP.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleContinuePreliminaryStudyQuestionnaire = async () => {
    if (!pendingPreliminaryStudyGeneration) return;

    const answers = buildPreliminaryStudyQuestionnaireAnswers(preliminaryStudyAnswers);
    await handleGeneratePreliminaryStudyDraft(pendingPreliminaryStudyGeneration, answers);
  };

  const handleGeneratePreliminaryStudyQuestionText = async (
    question: PreliminaryStudyQuestion,
    currentValue: string,
  ) => {
    if (!pendingPreliminaryStudyGeneration) {
      throw new Error('O contexto do ETP nao esta disponivel.');
    }

    const result = await preliminaryStudiesService.generateQuestionText({
      processo: pendingPreliminaryStudyGeneration.processo,
      manualObject: pendingPreliminaryStudyGeneration.manualObject,
      analysis: pendingPreliminaryStudyGeneration.analysis,
      questionnaireAnswers: buildPreliminaryStudyQuestionnaireAnswers(preliminaryStudyAnswers),
      supplementalSnippets: pendingPreliminaryStudyGeneration.supplementalSnippets,
      question,
      userNotes: currentValue,
    });

    if (result.warnings.length > 0) {
      toast.warning(result.warnings[0]);
    }

    return result.value;
  };

  const startPreliminaryStudyQuestionnaire = async (
    pending: PendingPreliminaryStudyGeneration,
    options?: { trySuggestions?: boolean; notice?: string; tone?: FeedbackTone },
  ) => {
    const initialAnswers = buildInitialPreliminaryStudyAnswers(pending.manualObject);
    const pendingQuestionIds = preliminaryStudyQuestions
      .filter((question) => !isPreliminaryStudyQuestionAnswered(initialAnswers[question.id]))
      .map((question) => question.id);

    setPendingPreliminaryStudyGeneration(pending);
    setPreliminaryStudyAnswers(initialAnswers);
    setPreliminaryStudySuggestionReviews([]);
    setPreliminaryStudyManualQuestionIds(pendingQuestionIds);
    setPreliminaryStudyQuestionIndex(0);
    setSelectedProcessId(null);

    if (options?.notice) {
      setFeedback(options.notice);
      setFeedbackTone(options.tone || 'neutral');
    }

    const suggestionSnippetCount =
      (pending.analysis?.snippets.length || 0) +
      (pending.supplementalSnippets?.filter((snippet) => !isEtpInstitutionalContextSnippet(snippet)).length || 0);

    if (options?.trySuggestions && suggestionSnippetCount > 0) {
      setScreenState('resolving');
      try {
        const suggestionResult = await preliminaryStudiesService.suggestQuestionnaireAnswers({
          processo: pending.processo,
          manualObject: pending.manualObject,
          analysis: pending.analysis,
          supplementalSnippets: pending.supplementalSnippets,
        });
        const suggestedReviews = suggestionResult.suggestions
          .filter((suggestion) => suggestion.status === 'suggested')
          .map((suggestion) => ({
            ...suggestion,
            decision: 'pending' as const,
          }));

        setPreliminaryStudySuggestionReviews(suggestedReviews);

        if (suggestedReviews.length > 0) {
          setFeedback(`${suggestedReviews.length} sugestao(oes) da IA encontradas com fonte explicita no processo.`);
          setFeedbackTone('success');
          setScreenState('etp_questionnaire_prefill');
          return;
        }

        setFeedback('A IA nao encontrou respostas com fonte explicita. Revise manualmente as perguntas do ETP.');
        setFeedbackTone('warning');
      } catch (suggestionError) {
        const suggestionMessage = suggestionError instanceof Error
          ? suggestionError.message
          : 'Nao foi possivel sugerir respostas automaticamente.';
        setFeedback(`${suggestionMessage} O questionario manual do ETP continua disponivel.`);
        setFeedbackTone('warning');
      }
    }

    setScreenState('etp_questionnaire');
  };

  const handleGeneratePreliminaryStudy = async ({
    processo,
    manualObject,
  }: {
    processo?: SuapProcesso | null;
    manualObject?: string;
  }) => {
    const objectFallback = manualObject?.trim() || processo?.assunto || '';
    const supplementalSnippets = preliminaryStudySupplementalSnippets;
    if (!processo && !objectFallback.trim()) {
      const message = 'Informe um processo sincronizado ou descreva o objeto da licitacao para gerar o ETP.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    resetPendingStates();
    setFeedback('');
    setScreenState('resolving');

    if (!processo?.pdfUrl) {
      await startPreliminaryStudyQuestionnaire(
        {
          processo,
          analysis: null,
          manualObject: objectFallback,
          supplementalSnippets,
        },
        {
          notice: processo
            ? 'Este processo ainda nao possui PDF sincronizado. O ETP sera montado pelo questionario manual.'
            : 'Preencha o questionario do ETP com base no objeto informado.',
          tone: processo ? 'warning' : 'neutral',
          trySuggestions: supplementalSnippets.some((snippet) => !isEtpInstitutionalContextSnippet(snippet)),
        },
      );
      return;
    }

    try {
      const analysis = await preliminaryStudiesService.analyzeProcessPdf(processo);
      if (analysis.searchablePageCount === 0) {
        await startPreliminaryStudyQuestionnaire(
          {
            processo,
            analysis,
            manualObject: objectFallback,
            supplementalSnippets,
          },
          {
            notice: analysis.warnings[0] || 'O PDF do processo nao trouxe texto pesquisavel. O ETP sera montado pelo questionario manual.',
            tone: 'warning',
            trySuggestions: supplementalSnippets.some((snippet) => !isEtpInstitutionalContextSnippet(snippet)),
          },
        );
        return;
      }

      await startPreliminaryStudyQuestionnaire(
        {
          processo,
          analysis,
          manualObject: objectFallback,
          supplementalSnippets,
        },
        { trySuggestions: true },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao analisar o PDF do processo.';
      await startPreliminaryStudyQuestionnaire(
        {
          processo,
          analysis: null,
          manualObject: objectFallback,
          supplementalSnippets,
        },
        {
          notice: `${message} O questionario manual do ETP continua disponivel.`,
          tone: 'warning',
          trySuggestions: supplementalSnippets.some((snippet) => !isEtpInstitutionalContextSnippet(snippet)),
        },
      );
    }
  };

  const handleBatchResolve = async (rawInput = processInput) => {
    const processes = extractProcessNumbers(rawInput);

    if (isPreliminaryStudyDocument) {
      resetPendingStates();
      setFeedback('');

      if (processes.length > 1) {
        const message = 'A geracao do ETP funciona com um processo por vez.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (processes.length === 1) {
        const matchedProcess = findSyncedProcessByNumber(processes[0]);
        if (!matchedProcess) {
          const message = 'Para usar PDF do processo no ETP, o processo precisa estar sincronizado no SUAP. Sem isso, descreva o objeto da licitacao no campo.';
          setFeedback(message);
          setFeedbackTone('warning');
          setScreenState('not_found');
          toast.error(message);
          return;
        }

        await handleGeneratePreliminaryStudy({ processo: matchedProcess });
        return;
      }

      const manualObject = rawInput.trim();
      if (!manualObject) {
        const message = 'Informe um processo sincronizado ou descreva o objeto da licitacao para gerar o ETP.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      await handleGeneratePreliminaryStudy({ manualObject });
      return;
    }

    if (processes.length === 0) {
      const message = 'Informe pelo menos um numero de processo valido para gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      resetPendingStates();
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    resetPendingStates();
    setFeedback('');
    setScreenState('resolving');

    if (isContractDocument || isReferenceTermDocument) {
      if (processes.length !== 1) {
        const message = isReferenceTermDocument
          ? 'A geracao do Termo de Referencia funciona com um processo por vez.'
          : 'A geracao de contrato funciona com um processo por vez.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      const matchedProcess = findSyncedProcessByNumber(processes[0]);
      if (!matchedProcess) {
        const message = isReferenceTermDocument
          ? 'Para gerar o Termo de Referencia, o processo precisa estar sincronizado no SUAP com PDF disponivel.'
          : 'Para gerar contrato, o processo precisa estar sincronizado no SUAP com PDF disponivel.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (isReferenceTermDocument) {
        await handleGenerateReferenceTerm(matchedProcess);
      } else {
        await handleGenerateContract(matchedProcess);
      }
      return;
    }

    try {
      const results = await Promise.all(
        processes.map((processo) => resolveDocumentIntent(buildIntentFromProcess(processo), resources)),
      );

      if (processes.length === 1) {
        const result = results[0];

        if (result.status === 'resolved') {
          openContext(result.context, {
            feedbackMessage: '1 minuta gerada.',
            feedbackTone: 'success',
          });
          return;
        }

        if (result.status === 'ambiguous') {
          setPendingCandidates(result.candidates);
          setFeedback(result.message);
          setFeedbackTone('neutral');
          setScreenState('ambiguous');
          return;
        }

        setFeedback(result.message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const resolvedContexts = results.flatMap((result) => (result.status === 'resolved' ? [result.context] : []));
      const ambiguousResults = results.flatMap((result) =>
        result.status === 'ambiguous' ? [{ processo: result.intent.lookupValue, count: result.candidates.length }] : [],
      );
      const notFoundProcesses = results.flatMap((result) =>
        result.status === 'not_found' ? [result.intent.lookupValue] : [],
      );

      if (resolvedContexts.length === 0) {
        const message = ambiguousResults.length > 0
          ? 'Nao consegui montar o lote automaticamente. Gere os processos pendentes individualmente.'
          : 'Nao encontrei dados suficientes para os processos informados.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const combinedHtml = resolvedContexts
        .map((context) => buildDespachoLiquidacaoHtml(context))
        .join(dividerHtml);
      const dispatches = resolvedContexts.map((context) => ({
        id: context.candidateId,
        title: context.title || activeDocument.name,
        subtitle: context.subtitle,
        processo: context.processo,
        html: buildDespachoLiquidacaoHtml(context),
        documentType: 'despacho-liquidacao' as const,
        allowClone: true,
      }));

      setSelectedTitle(
        resolvedContexts.length === 1 ? resolvedContexts[0].title || activeDocument.name : 'Lote de Despachos de Liquidacao',
      );
      setEditorContent(combinedHtml);
      setGeneratedDispatches(dispatches);
      setCopiedDispatchIds([]);
      setCopiedSectionIds([]);
      setClonedDispatchIds([]);
      setDownloadedDocxIds([]);
      resetPendingStates();
      setScreenState('idle');

      const messageParts = [`${resolvedContexts.length} minuta${resolvedContexts.length > 1 ? 's' : ''} gerada${resolvedContexts.length > 1 ? 's' : ''}`];
      if (ambiguousResults.length > 0) {
        messageParts.push(
          `${ambiguousResults.length} processo${ambiguousResults.length > 1 ? 's' : ''} precisa${ambiguousResults.length > 1 ? 'm' : ''} de selecao manual`,
        );
      }
      if (notFoundProcesses.length > 0) {
        messageParts.push(
          `${notFoundProcesses.length} processo${notFoundProcesses.length > 1 ? 's' : ''} sem dados suficientes`,
        );
      }

      setFeedback(`${messageParts.join('. ')}.`);
      setFeedbackTone(ambiguousResults.length > 0 || notFoundProcesses.length > 0 ? 'neutral' : 'success');
      focusEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGenerateProcess = async (processo: SuapProcesso) => {
    const processValue = processo.numProcesso?.trim() || processo.suapId.trim();

    if (!processValue) {
      return;
    }

    if (isContractDocument) {
      await handleGenerateContract(processo);
      return;
    }

    if (isReferenceTermDocument) {
      await handleGenerateReferenceTerm(processo);
      return;
    }

    if (isPreliminaryStudyDocument) {
      await handleGeneratePreliminaryStudy({ processo });
      return;
    }

    if (processo.numProcesso?.trim()) {
      setProcessInput(processo.numProcesso.trim());
    }
    resetPendingStates();
    setFeedback('');
    setScreenState('resolving');

    try {
      const context = await buildResolvedContextFromSuapProcess(processo, resources);
      openContext(context, {
        feedbackMessage: '1 minuta gerada.',
        feedbackTone: 'success',
      });
      setSelectedProcessId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGenerateSelectedDespachos = async () => {
    if (generationProcesses.length === 0) {
      const message = 'Selecione pelo menos um processo sincronizado para gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      resetPendingStates();
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    resetPendingStates();
    setFeedback('');
    setScreenState('resolving');

    try {
      const results = await Promise.allSettled(
        generationProcesses.map((processo) => buildResolvedContextFromSuapProcess(processo, resources)),
      );
      const resolvedContexts = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const failedCount = results.length - resolvedContexts.length;

      if (resolvedContexts.length === 0) {
        const message = 'Nao encontrei dados suficientes para os processos selecionados.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      const combinedHtml = resolvedContexts.map((context) => buildDespachoLiquidacaoHtml(context)).join(dividerHtml);
      const dispatches = resolvedContexts.map((context) => ({
        id: context.candidateId,
        title: context.title || activeDocument.name,
        subtitle: context.subtitle,
        processo: context.processo,
        html: buildDespachoLiquidacaoHtml(context),
        documentType: 'despacho-liquidacao' as const,
        allowClone: true,
      }));

      setSelectedTitle(
        resolvedContexts.length === 1 ? resolvedContexts[0].title || activeDocument.name : 'Lote de Despachos de Liquidacao',
      );
      setEditorContent(combinedHtml);
      setGeneratedDispatches(dispatches);
      setCopiedDispatchIds([]);
      setCopiedSectionIds([]);
      setClonedDispatchIds([]);
      setDownloadedDocxIds([]);
      resetPendingStates();
      setScreenState('idle');
      setFeedback(
        failedCount > 0
          ? `${resolvedContexts.length} minuta${resolvedContexts.length > 1 ? 's' : ''} gerada${resolvedContexts.length > 1 ? 's' : ''}. ${failedCount} processo${failedCount > 1 ? 's' : ''} sem dados suficientes.`
          : `${resolvedContexts.length} minuta${resolvedContexts.length > 1 ? 's' : ''} gerada${resolvedContexts.length > 1 ? 's' : ''}.`,
      );
      setFeedbackTone(failedCount > 0 ? 'neutral' : 'success');
      focusEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar as minutas.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handlePrimaryGenerate = async () => {
    if (isContractDocument || isReferenceTermDocument) {
      if (generationProcesses.length !== 1) {
        const message = isReferenceTermDocument
          ? 'Selecione exatamente um processo sincronizado para gerar o Termo de Referencia.'
          : 'Selecione exatamente um processo sincronizado para gerar contrato.';
        setFeedback(message);
        setFeedbackTone('warning');
        resetPendingStates();
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (isReferenceTermDocument) {
        await handleGenerateReferenceTerm(generationProcesses[0]);
      } else {
        await handleGenerateContract(generationProcesses[0]);
      }
      return;
    }

    if (isPreliminaryStudyDocument) {
      if (generationProcesses.length > 1) {
        const message = 'A geracao do ETP funciona com um processo por vez.';
        setFeedback(message);
        setFeedbackTone('warning');
        resetPendingStates();
        setScreenState('not_found');
        toast.error(message);
        return;
      }

      if (generationProcesses.length === 1) {
        await handleGeneratePreliminaryStudy({ processo: generationProcesses[0] });
        return;
      }

      await handleBatchResolve(processInput);
      return;
    }

    await handleGenerateSelectedDespachos();
  };

  const handleOpenPdf = async (processo: SuapProcesso) => {
    if (!processo.pdfUrl) {
      toast.info('Este processo ainda nao possui PDF sincronizado.');
      return;
    }

    setOpeningPdfId(processo.id);
    try {
      const signedUrl = await suapProcessosService.getPdfSignedUrl(processo.pdfUrl);
      if (!signedUrl) {
        toast.error('Nao foi possivel gerar o link do PDF.');
        return;
      }

      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao abrir o PDF sincronizado.');
    } finally {
      setOpeningPdfId(null);
    }
  };

  const handleDownloadDocx = async (dispatch: GeneratedDispatch) => {
    if (!dispatch.docxTemplateBase64 || !dispatch.docxExportPlan) {
      toast.error('Este documento ainda nao possui plano de exportacao para DOCX.');
      return;
    }

    try {
      const bytes = await applyDocxTemplatePlan(dispatch.docxTemplateBase64, dispatch.docxExportPlan);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = dispatch.docxFileName || 'documento.docx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setDownloadedDocxIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
      toast.success(`DOCX gerado para ${dispatch.processo || dispatch.title}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao montar o DOCX final.');
    }
  };

  const handleCopy = async () => {
    const html = editorContent;
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const clipboard = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([stripHtml(html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      toast.success('Minuta copiada com sucesso.');
    } catch {
      await navigator.clipboard.writeText(stripHtml(html));
      toast.success('Minuta copiada em texto simples.');
    }
  };

  const handleCopyDispatch = async (dispatch: GeneratedDispatch) => {
    try {
      const blob = new Blob([dispatch.html], { type: 'text/html' });
      const clipboard = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([stripHtml(dispatch.html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      setCopiedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
      toast.success(`Documento ${dispatch.processo || dispatch.title} copiado.`);
    } catch {
      await navigator.clipboard.writeText(stripHtml(dispatch.html));
      setCopiedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
      toast.success(`Documento ${dispatch.processo || dispatch.title} copiado em texto simples.`);
    }
  };

  const handleCopySection = async (dispatch: GeneratedDispatch, section: PreliminaryStudyDraftSection) => {
    const sectionKey = `${dispatch.id}:${section.id}`;
    try {
      const blob = new Blob([section.html], { type: 'text/html' });
      const clipboard = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([stripHtml(section.html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      setCopiedSectionIds((current) => (current.includes(sectionKey) ? current : [...current, sectionKey]));
      toast.success(`Secao ${section.title} copiada.`);
    } catch {
      await navigator.clipboard.writeText(stripHtml(section.html));
      setCopiedSectionIds((current) => (current.includes(sectionKey) ? current : [...current, sectionKey]));
      toast.success(`Secao ${section.title} copiada em texto simples.`);
    }
  };

  const handleCloneDispatch = (dispatch: GeneratedDispatch) => {
    setClonedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
    window.open(cloneDocumentUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Clonagem aberta para ${dispatch.processo || dispatch.title}.`);
  };

  const showManualObjectTextarea = isPreliminaryStudyDocument && generationProcesses.length === 0;
  const processCounterLabel = generationProcesses.length > 0
    ? `${generationProcesses.length} processo${generationProcesses.length !== 1 ? 's' : ''} selecionado${generationProcesses.length !== 1 ? 's' : ''}`
    : isPreliminaryStudyDocument
      ? 'Objeto manual'
      : '0 processos selecionados';

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] w-[calc(100%+2rem)] bg-surface-page lg:-m-8 lg:w-[calc(100%+4rem)]">
      <HeaderActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-space-9 gap-space-2 border-border-default bg-white text-foreground shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
          onClick={() => window.open(suapExtensionGithubUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" />
          Baixar extensão
        </Button>
      </HeaderActions>

      <div className="mx-auto flex max-w-[1560px] flex-col gap-5 px-4 py-5 lg:px-8 lg:py-6">
          <div className="grid gap-4">
            <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  {exampleProcesses.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                          Processos sincronizados
                        </p>
                      </div>

                      <div className="rounded-radius-xl border border-border-default/70 bg-surface-subtle/35 p-2">
                        <div>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                          {exampleProcesses.map((example) => (
                            <ExampleProcessRow
                              key={example.id}
                              processo={example.processo}
                              beneficiario={example.beneficiario}
                              isSelected={generationProcessIds.includes(example.id)}
                              onPreview={() => setSelectedProcessId(example.id)}
                              onSelect={() => handleSelectGenerationProcess(example.processoCompleto)}
                              selectTitle={`Selecionar processo ${example.processo}`}
                            />
                          ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isLoadingSyncedProcesses ? (
                    <div className="rounded-radius-xl border border-border-default/70 bg-surface-subtle/35 px-4 py-3">
                      <p className="font-ui text-sm text-text-secondary">Carregando processos sincronizados...</p>
                    </div>
                  ) : null}

                  {!isLoadingSyncedProcesses && !isSyncedProcessesError && exampleProcesses.length === 0 ? (
                    <div className="rounded-radius-xl border border-dashed border-border-default/70 bg-surface-subtle/35 px-4 py-3">
                      <p className="font-ui text-sm text-text-secondary">
                        Nenhum processo sincronizado disponivel para selecao no modo publico. Use o botao Baixar extensao no cabecalho ou continue pelo preenchimento manual quando o modelo permitir.
                      </p>
                    </div>
                  ) : null}

                  {isSyncedProcessesError ? (
                    <div className="rounded-radius-xl border border-warning/20 bg-warning/10 px-4 py-3">
                      <p className="font-ui text-sm text-foreground">
                        Nao foi possivel carregar a lista publica de processos sincronizados agora. A geracao manual continua disponivel.
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-3 rounded-radius-xl border border-border-default/70 bg-surface-subtle/40 p-3">
                    {showManualObjectTextarea ? (
                      <Textarea
                        value={processInput}
                        onChange={(event) => setProcessInput(event.target.value)}
                        placeholder="Descreva o objeto da licitacao."
                        className="min-h-[116px] resize-none rounded-radius-lg border-border-default bg-surface-card font-mono text-sm text-text-primary shadow-xs placeholder:font-ui placeholder:text-text-muted"
                      />
                    ) : null}

                    {isPreliminaryStudyDocument ? (
                      <div className="rounded-radius-lg border border-dashed border-border-default/80 bg-surface-card px-3 py-3">
                        <input
                          ref={preliminaryStudySupplementalInputRef}
                          type="file"
                          accept={PRELIMINARY_STUDY_SUPPLEMENTAL_ACCEPT}
                          multiple
                          className="hidden"
                          onChange={(event) => void handleAddPreliminaryStudySupplementalAttachments(event.target.files)}
                        />
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-ui text-xs font-semibold text-text-primary">Anexos auxiliares opcionais</p>
                            <p className="mt-1 font-ui text-xs leading-5 text-text-secondary">
                              Insira PDFs, planilhas, CSV, TXT, ou DOCX
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 gap-2"
                            onClick={() => preliminaryStudySupplementalInputRef.current?.click()}
                            disabled={
                              isAnalyzingPreliminaryStudySupplementalAttachment ||
                              preliminaryStudySupplementalAnalyses.length >= PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES
                            }
                          >
                            {isAnalyzingPreliminaryStudySupplementalAttachment ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Adicionar arquivo
                          </Button>
                        </div>
                        {preliminaryStudySupplementalAnalyses.length > 0 ? (
                          <div className="mt-3 grid gap-2">
                            {preliminaryStudySupplementalAnalyses.map((analysis) => (
                              <div
                                key={analysis.fileName}
                                className="flex flex-col gap-2 rounded-radius-md border border-border-default/70 bg-surface-subtle/45 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-ui text-xs font-semibold text-text-primary">{analysis.fileName}</p>
                                  <p className="mt-0.5 font-ui text-[11px] text-text-secondary">
                                    {analysis.fileType} | {analysis.snippets.length} trecho(s) util(eis), {analysis.sourceSummary}
                                  </p>
                                  {analysis.warnings.length > 0 ? (
                                    <p className="mt-1 font-ui text-[11px] text-foreground">{analysis.warnings[0]}</p>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 justify-start px-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                                  onClick={() => handleRemovePreliminaryStudySupplementalAttachment(analysis.fileName)}
                                >
                                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                  Remover
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2 font-ui text-xs text-text-secondary">
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {processCounterLabel}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="h-10 gap-2"
                          onClick={() => void handlePrimaryGenerate()}
                          disabled={screenState === 'resolving'}
                        >
                          {screenState === 'resolving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {isContractDocument
                            ? 'Gerar contrato'
                            : isReferenceTermDocument
                              ? 'Gerar Termo de Referencia'
                              : isPreliminaryStudyDocument
                                ? 'Gerar ETP'
                                : 'Gerar minuta'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {feedback ? (
                    <div className={`rounded-radius-xl border px-4 py-3 font-ui text-sm ${feedbackClasses[feedbackTone]}`}>{feedback}</div>
                  ) : null}

                  {screenState === 'ambiguous' && pendingCandidates.length > 0 ? (
                    <div className="space-y-3 rounded-radius-xl border border-border-default/70 bg-surface-subtle/40 p-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        {pendingCandidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.candidateId}
                            candidate={candidate}
                            onSelect={(selectedCandidate) =>
                              openContext(selectedCandidate, {
                                feedbackMessage: '1 minuta gerada.',
                                feedbackTone: 'success',
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {screenState === 'ambiguous' && pendingContractCandidates.length > 0 && pendingContractGeneration ? (
                    <div className="space-y-3 rounded-radius-xl border border-border-default/70 bg-surface-subtle/40 p-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        {pendingContractCandidates.map((candidate) => (
                          <ContractModelCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onSelect={(selectedCandidate) =>
                              void handleGenerateContractDraft(
                                pendingContractGeneration.processo,
                                pendingContractGeneration.analysis,
                                selectedCandidate,
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                </div>
              </CardContent>
            </Card>
          </div>

        <Card ref={editorCardRef} className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
          <CardContent className="p-0">
            <RichTextEditor
              content={editorContent}
              onChange={setEditorContent}
              placeholder={
                isContractDocument
                  ? 'O contrato sera montado aqui...'
                  : isReferenceTermDocument
                    ? 'O Termo de Referencia sera montado aqui...'
                    : isPreliminaryStudyDocument
                      ? 'O ETP sera montado aqui...'
                      : 'A minuta sera montada aqui...'
              }
              toolbarLeft={
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-radius-md bg-primary/10 text-primary">
                    <Wand2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-ui text-xs font-semibold text-text-primary">{selectedTitle}</span>
                </div>
              }
              toolbarRight={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge variant="outline" className="border-border-default bg-surface-subtle text-text-secondary">
                    Editor
                  </Badge>
                </div>
              }
            />
          </CardContent>
        </Card>

        {generatedDispatches.length > 0 ? (
          <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
            <CardContent className="bg-surface-subtle/40 px-4 py-3">
              <div className="mb-3 flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                <Copy className="h-3.5 w-3.5" />
                {generatedDispatches.length > 1 ? 'Copiar por documento' : 'Acoes do documento'}
              </div>
              <div className={cn('grid gap-2', generatedDispatches.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : 'max-w-md')}>
                {generatedDispatches.map((dispatch, index) => {
                  const isCopied = copiedDispatchIds.includes(dispatch.id);
                  const isCloned = clonedDispatchIds.includes(dispatch.id);

                  return (
                    <div
                      key={dispatch.id}
                      className="rounded-radius-lg border border-border-default/70 bg-surface-card px-2.5 py-2 shadow-xs transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/15 hover:shadow-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] font-semibold text-text-primary">
                          {dispatch.processo ||
                            `${
                              dispatch.documentType === 'contrato-servico-ifrn'
                                ? 'Contrato'
                                : dispatch.documentType === 'termo-referencia-compras'
                                  ? 'TR'
                                  : dispatch.documentType === 'estudo-tecnico-preliminar-servicos-continuos'
                                    ? 'ETP'
                                  : 'Despacho'
                            } ${index + 1}`}
                        </p>
                        <p className="mt-0.5 truncate font-ui text-[11px] text-text-secondary">
                          {dispatch.subtitle || dispatch.title}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-border-default/60 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={isCopied ? 'Documento copiado' : 'Copiar documento'}
                          className={[
                            'h-7 px-2 transition-all duration-200 hover:-translate-y-px active:scale-95',
                            isCopied
                              ? 'bg-status-success/12 text-status-success shadow-sm hover:bg-status-success/18 hover:text-status-success'
                              : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                          ].join(' ')}
                          onClick={() => void handleCopyDispatch(dispatch)}
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        {dispatch.allowDocxDownload ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={[
                              'h-7 bg-surface-card px-2.5 font-ui text-[11px] transition-all duration-200 hover:-translate-y-px active:scale-95',
                              downloadedDocxIds.includes(dispatch.id)
                                ? 'border-primary/30 bg-primary/[0.08] text-primary shadow-sm hover:bg-primary/[0.12]'
                                : 'border-border-default text-text-primary hover:border-primary/20 hover:bg-surface-subtle',
                            ].join(' ')}
                            onClick={() => void handleDownloadDocx(dispatch)}
                          >
                            {downloadedDocxIds.includes(dispatch.id) ? 'DOCX baixado' : 'Baixar DOCX'}
                          </Button>
                        ) : dispatch.documentType === 'estudo-tecnico-preliminar-servicos-continuos' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 bg-surface-card px-2.5 font-ui text-[11px] transition-all duration-200 hover:-translate-y-px active:scale-95"
                            onClick={() => void handleProceedFromPreliminaryStudyToReferenceTerm(dispatch)}
                            disabled={screenState === 'resolving'}
                          >
                            {screenState === 'resolving' ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Prosseguir para Termo de Referencia
                          </Button>
                        ) : dispatch.allowClone ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={[
                              'h-7 bg-surface-card px-2.5 font-ui text-[11px] transition-all duration-200 hover:-translate-y-px active:scale-95',
                              isCloned
                                ? 'border-primary/30 bg-primary/[0.08] text-primary shadow-sm hover:bg-primary/[0.12]'
                                : 'border-border-default text-text-primary hover:border-primary/20 hover:bg-surface-subtle',
                            ].join(' ')}
                            onClick={() => handleCloneDispatch(dispatch)}
                          >
                            {isCloned ? 'Clonado' : 'Clonar no SUAP'}
                          </Button>
                        ) : (
                          <span className="font-ui text-[11px] text-text-muted">
                            {dispatch.documentType === 'termo-referencia-compras'
                              ? 'Revise e exporte em DOCX'
                              : dispatch.documentType === 'estudo-tecnico-preliminar-servicos-continuos'
                                ? 'Copie o documento ou as secoes'
                                : 'Edite e copie no editor'}
                          </span>
                        )}
                      </div>
                      {dispatch.sections?.length ? (
                        <div className="mt-2 grid gap-1 border-t border-border-default/60 pt-2">
                          {dispatch.sections.map((section) => {
                            const sectionKey = `${dispatch.id}:${section.id}`;
                            const isSectionCopied = copiedSectionIds.includes(sectionKey);
                            return (
                              <Button
                                key={section.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'h-7 justify-start px-2 font-ui text-[11px]',
                                  isSectionCopied
                                    ? 'bg-status-success/12 text-status-success hover:bg-status-success/18 hover:text-status-success'
                                    : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                                )}
                                onClick={() => void handleCopySection(dispatch, section)}
                              >
                                {isSectionCopied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                                Copiar {section.title}
                              </Button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={(screenState === 'ai_questionnaire_prefill' || screenState === 'reference_questionnaire') && Boolean(pendingReferenceTermGeneration)}
        onOpenChange={(open) => {
          if (!open && (screenState === 'ai_questionnaire_prefill' || screenState === 'reference_questionnaire')) {
            cancelReferenceTermQuestionnaire();
          }
        }}
      >
        <DialogContent
          className="grid max-h-[calc(100dvh-1rem)] w-[min(96vw,980px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border-default bg-surface-card p-0 shadow-xl"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          {pendingReferenceTermGeneration ? (
            <>
              <DialogHeader className="space-y-3 border-b border-border-default/70 bg-surface-subtle/45 px-5 py-4 text-left">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] text-primary">
                        Termo de Referencia
                      </Badge>
                      {screenState === 'reference_questionnaire' &&
                      currentReferenceTermQuestion &&
                      !isReferenceTermQuestionnaireReviewStep &&
                      currentReferenceTermQuestion.kind !== 'field' ? (
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {currentReferenceTermQuestion.kind === 'exclusive'
                            ? 'Escolha exclusiva'
                            : currentReferenceTermQuestion.kind === 'optional'
                              ? 'Opcional'
                              : null}
                        </Badge>
                      ) : null}
                    </div>
                    {screenState === 'ai_questionnaire_prefill' ? (
                      <>
                        <DialogTitle className="font-ui text-lg font-semibold tracking-tight text-text-primary">
                          Sugestoes da IA para o Termo de Referencia
                        </DialogTitle>
                        <DialogDescription className="mt-1 font-ui text-sm leading-5 text-text-secondary">
                          Revise as sugestoes com fonte explicita antes das pendencias.
                        </DialogDescription>
                      </>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {screenState === 'ai_questionnaire_prefill' ? (
                      <>
                        <Badge variant="outline" className="border-status-success/25 bg-status-success/10 text-foreground">
                          {approvedReferenceTermSuggestionReviews.length} aprovada(s)
                        </Badge>
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {pendingReferenceTermSuggestionReviews.length} sugerida(s)
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {answeredReferenceTermQuestions} respondida(s)
                        </Badge>
                        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                          {skippedReferenceTermQuestions} pulada(s)
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-surface-card ring-1 ring-border-default/70">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${referenceTermQuestionProgress}%` }}
                  />
                </div>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto bg-white px-5 py-4">
                {screenState === 'ai_questionnaire_prefill' ? (
                  <div className="grid gap-3">
                    {referenceTermSuggestionReviews.map((review) => {
                      const question = referenceTermQuestionById.get(review.questionId);
                      if (!question) return null;

                      return (
                        <ReferenceTermSuggestionReviewCard
                          key={review.questionId}
                          question={question}
                          sourceText={referenceTermQuestionSourceById.get(review.questionId)}
                          review={review}
                          onChange={updateReferenceTermSuggestionReview}
                          onApprove={() => approveReferenceTermSuggestion(review.questionId)}
                          onReject={() => rejectReferenceTermSuggestion(review.questionId)}
                        />
                      );
                    })}
                  </div>
                ) : isReferenceTermQuestionnaireReviewStep ? (
                  <div className="rounded-radius-xl border border-primary/20 bg-primary/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-radius-lg bg-primary/10 text-primary">
                        <ShieldCheck className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="font-ui text-sm font-semibold text-text-primary">Questionario pronto para geracao</p>
                        <p className="mt-1 font-ui text-sm leading-6 text-text-secondary">
                          As perguntas respondidas serao enviadas para a IA. As perguntas puladas permanecerao como pendencias de revisao juridica no documento.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : currentReferenceTermQuestion ? (
                  <ReferenceTermQuestionCard
                    key={currentReferenceTermQuestion.id}
                    question={currentReferenceTermQuestion}
                    sourceText={referenceTermQuestionSourceById.get(currentReferenceTermQuestion.id)}
                    answer={referenceTermAnswers[currentReferenceTermQuestion.id]}
                    onAnswer={(answer) => {
                      setReferenceTermAnswer(answer);
                      advanceReferenceTermQuestion();
                    }}
                    onSkip={() => skipReferenceTermQuestion(currentReferenceTermQuestion)}
                  />
                ) : null}
              </div>

              <DialogFooter className="gap-2 border-t border-border-default/70 bg-surface-subtle/45 px-5 py-4 sm:justify-between sm:space-x-0">
                <Button type="button" variant="outline" className="h-10" onClick={cancelReferenceTermQuestionnaire}>
                  Cancelar
                </Button>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  {screenState === 'ai_questionnaire_prefill' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={approveAllReferenceTermSuggestions}
                        disabled={referenceTermSuggestionReviews.length === 0}
                      >
                        Aprovar todas
                      </Button>
                      <Button
                        type="button"
                        className="h-10 gap-2"
                        onClick={() => void continueAfterReferenceTermSuggestions()}
                      >
                        <Sparkles className="h-4 w-4" />
                        Continuar para pendencias
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() => setReferenceTermQuestionIndex((current) => Math.max(current - 1, 0))}
                        disabled={referenceTermQuestionIndex <= 0}
                      >
                        Voltar
                      </Button>
                      {isReferenceTermQuestionnaireReviewStep ? (
                        <Button
                          type="button"
                          className="h-10 gap-2"
                          onClick={() => void handleContinueReferenceTermQuestionnaire()}
                        >
                          <Sparkles className="h-4 w-4" />
                          Continuar geracao
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={(screenState === 'etp_questionnaire_prefill' || screenState === 'etp_questionnaire') && Boolean(pendingPreliminaryStudyGeneration)}
        onOpenChange={(open) => {
          if (!open && (screenState === 'etp_questionnaire_prefill' || screenState === 'etp_questionnaire')) {
            cancelPreliminaryStudyQuestionnaire();
          }
        }}
      >
        <DialogContent
          className="grid max-h-[calc(100dvh-2rem)] w-[min(94vw,760px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border-default bg-surface-card p-0 shadow-xl"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          {pendingPreliminaryStudyGeneration ? (
            <>
              <DialogHeader className="space-y-3 border-b border-border-default/70 bg-surface-subtle/45 px-5 py-4 text-left">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] text-primary">
                        ETP
                      </Badge>
                      <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                        Servicos continuos
                      </Badge>
                    </div>
                    {screenState === 'etp_questionnaire_prefill' ? (
                      <>
                        <DialogTitle className="font-ui text-lg font-semibold tracking-tight text-text-primary">
                          Sugestoes da IA para o ETP
                        </DialogTitle>
                        <DialogDescription className="mt-1 font-ui text-sm leading-5 text-text-secondary">
                          Revise as sugestoes com fonte explicita antes das pendencias.
                        </DialogDescription>
                      </>
                    ) : (
                      <>
                        <DialogTitle className="font-ui text-lg font-semibold tracking-tight text-text-primary">
                          Questionario do ETP
                        </DialogTitle>
                        <DialogDescription className="mt-1 font-ui text-sm leading-5 text-text-secondary">
                          Responda uma pendencia por vez. Campos pulados permanecem marcados para revisao.
                        </DialogDescription>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {screenState === 'etp_questionnaire_prefill' ? (
                      <>
                        <Badge variant="outline" className="border-status-success/25 bg-status-success/10 text-foreground">
                          {approvedPreliminaryStudySuggestionReviews.length} aprovada(s)
                        </Badge>
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {pendingPreliminaryStudySuggestionReviews.length} sugerida(s)
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                          {answeredPreliminaryStudyQuestions} respondida(s)
                        </Badge>
                        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                          {skippedPreliminaryStudyQuestions} pulada(s)
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-surface-card ring-1 ring-border-default/70">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${preliminaryStudyQuestionProgress}%` }}
                  />
                </div>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto bg-white px-5 py-4">
                {screenState === 'etp_questionnaire_prefill' ? (
                  <div className="grid gap-3">
                    {preliminaryStudySuggestionReviews.map((review) => {
                      const question = preliminaryStudyQuestionById.get(review.questionId);
                      if (!question) return null;

                      return (
                        <PreliminaryStudySuggestionReviewCard
                          key={review.questionId}
                          question={question}
                          review={review}
                          onChange={updatePreliminaryStudySuggestionReview}
                          onApprove={() => approvePreliminaryStudySuggestion(review.questionId)}
                          onReject={() => rejectPreliminaryStudySuggestion(review.questionId)}
                        />
                      );
                    })}
                  </div>
                ) : isPreliminaryStudyQuestionnaireReviewStep ? (
                  <div className="rounded-radius-xl border border-primary/20 bg-primary/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-radius-lg bg-primary/10 text-primary">
                        <ShieldCheck className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="font-ui text-sm font-semibold text-text-primary">Questionario pronto para geracao</p>
                        <p className="mt-1 font-ui text-sm leading-6 text-text-secondary">
                          As respostas serao enviadas para gerar o rascunho editavel. Campos pulados permanecerao como pendencias no ETP.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : currentPreliminaryStudyQuestion ? (
                  <PreliminaryStudyQuestionCard
                    key={currentPreliminaryStudyQuestion.id}
                    question={currentPreliminaryStudyQuestion}
                    answer={preliminaryStudyAnswers[currentPreliminaryStudyQuestion.id]}
                    onAnswer={(answer) => {
                      setPreliminaryStudyAnswer(answer);
                      advancePreliminaryStudyQuestion();
                    }}
                    onSkip={() => skipPreliminaryStudyQuestion(currentPreliminaryStudyQuestion)}
                    onGenerateText={(currentValue) =>
                      handleGeneratePreliminaryStudyQuestionText(currentPreliminaryStudyQuestion, currentValue)
                    }
                  />
                ) : null}
              </div>

              <DialogFooter className="gap-2 border-t border-border-default/70 bg-surface-subtle/45 px-5 py-4 sm:justify-between sm:space-x-0">
                <Button type="button" variant="outline" className="h-10" onClick={cancelPreliminaryStudyQuestionnaire}>
                  Cancelar
                </Button>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  {screenState === 'etp_questionnaire_prefill' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={approveAllPreliminaryStudySuggestions}
                        disabled={preliminaryStudySuggestionReviews.length === 0}
                      >
                        Aprovar todas
                      </Button>
                      <Button
                        type="button"
                        className="h-10 gap-2"
                        onClick={() => void continueAfterPreliminaryStudySuggestions()}
                      >
                        <Sparkles className="h-4 w-4" />
                        Continuar para pendencias
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() => setPreliminaryStudyQuestionIndex((current) => Math.max(current - 1, 0))}
                        disabled={preliminaryStudyQuestionIndex <= 0}
                      >
                        Voltar
                      </Button>
                      {isPreliminaryStudyQuestionnaireReviewStep ? (
                        <Button
                          type="button"
                          className="h-10 gap-2"
                          onClick={() => void handleContinuePreliminaryStudyQuestionnaire()}
                        >
                          <Sparkles className="h-4 w-4" />
                          Continuar geracao
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="h-10 gap-2"
                          onClick={() => void handleContinuePreliminaryStudyQuestionnaire()}
                        >
                          <Sparkles className="h-4 w-4" />
                          Gerar com pendencias
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedProcess)} onOpenChange={(open) => !open && setSelectedProcessId(null)}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[min(95vw,1140px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-none bg-white p-0 text-foreground shadow-2xl">
          {selectedProcess ? (
            <>
              <DialogHeader className="relative space-y-1 border-b border-border bg-muted/80 p-4">
                <div className="absolute left-0 top-0 h-1 w-full bg-cyan-500" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-600">
                      <PanelRightOpen className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DialogTitle className="font-ui text-[24px] font-black tracking-tight text-foreground">
                          {selectedProcess.numProcesso || selectedProcess.suapId}
                        </DialogTitle>
                        <CopyValueButton
                          value={selectedProcess.numProcesso || selectedProcess.suapId}
                          message="Numero do processo copiado."
                          className="h-7 w-7 border-border bg-white shadow-none"
                        />
                      </div>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600/70">
                        Processo Sincronizado
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[24px] font-black tracking-tight text-foreground">
                        {selectedProcess.suapId}
                      </span>
                      <CopyValueButton
                        value={selectedProcess.suapId}
                        message="SUAP ID copiado."
                        className="h-7 w-7 border-border bg-white shadow-none"
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      SUAP ID
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto bg-white p-4">
                <div className="space-y-3">
                <SidebarSection
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  title="Beneficiario e assunto"
                  contentClassName="space-y-3"
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    <SidebarField label="Nome" value={selectedProcess.beneficiario || 'Nao extraido'} copyValue={selectedProcess.beneficiario} copyMessage="Beneficiario copiado." />
                    <SidebarField
                      label="Documento"
                      value={selectedProcess.cpfCnpj ? formatarDocumento(selectedProcess.cpfCnpj) : 'Sem documento'}
                      copyValue={selectedProcess.cpfCnpj}
                      copyMessage="Documento copiado."
                      mono
                    />
                  </div>

                  <div className="space-y-2">
                    <SidebarField
                      label="Descricao"
                      value={selectedProcess.assunto || 'Sem assunto extraido'}
                      copyValue={selectedProcess.assunto}
                      copyMessage="Assunto copiado."
                    />
                  </div>
                </SidebarSection>

                <SidebarSection
                  icon={<Landmark className="h-3.5 w-3.5" />}
                  title="Contrato, nota fiscal, bancos, retencoes e empenhos"
                  contentClassName="space-y-3"
                >
                    <div className="space-y-2.5">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <SidebarField
                          label="Contrato"
                          value={selectedProcess.contrato || selectedProcess.dadosCompletos?.contrato_numero || '-'}
                          copyValue={selectedProcess.contrato || selectedProcess.dadosCompletos?.contrato_numero}
                          copyMessage="Contrato copiado."
                        />
                        <SidebarField
                          label="Nota fiscal"
                          value={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.numero || '-'}
                          copyValue={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.numero}
                          copyMessage="Numero da nota fiscal copiado."
                          mono
                        />
                        <SidebarField
                          label="Emissao"
                          value={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.data_emissao || 'Sem data de emissao'}
                          copyValue={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.data_emissao}
                          copyMessage="Data de emissao copiada."
                        />
                        <SidebarField
                          label="Valor"
                          value={selectedProcess.dadosCompletos?.val_nf || '-'}
                          copyValue={selectedProcess.dadosCompletos?.val_nf}
                          copyMessage="Valor copiado."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          Dados bancarios
                        </p>
                        <div className="rounded-lg border border-border bg-muted/70 px-3 py-2">
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Banco</p>
                                <p className="mt-0.5 break-words font-ui text-[13px] text-foreground">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.banco || 'Sem banco extraido'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.banco}
                                message="Banco copiado."
                                className="h-7 w-7 shrink-0 border-border bg-white shadow-none"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Agencia</p>
                                <p className="mt-0.5 break-words font-mono text-[12px] font-semibold text-foreground">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.agencia || '-'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.agencia}
                                message="Agencia copiada."
                                className="h-7 w-7 shrink-0 border-border bg-white shadow-none"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Conta</p>
                                <p className="mt-0.5 break-words font-mono text-[12px] font-semibold text-foreground">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.conta || '-'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.conta}
                                message="Conta copiada."
                                className="h-7 w-7 shrink-0 border-border bg-white shadow-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {(selectedProcess.dadosCompletos?.empenhos || []).length > 0 ? (
                        <div className="min-w-0 xl:w-[38%] xl:max-w-[420px] space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              Empenhos
                            </p>
                            <CopyValueButton value={(selectedProcess.dadosCompletos?.empenhos || []).join(', ')} message="Lista de empenhos copiada." className="h-7 w-7" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/70 px-3 py-2">
                            {(selectedProcess.dadosCompletos?.empenhos || []).map((empenho) => (
                              <div
                                key={empenho}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1"
                              >
                                <span className="font-mono text-[12px] font-semibold text-text-primary">{empenho}</span>
                                <CopyValueButton value={empenho} message="Empenho copiado." className="h-6 w-6 border-0 bg-transparent shadow-none" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {(selectedProcess.dadosCompletos?.retencoes_tributarias?.optante_simples_nacional ||
                      visibleRetencoes.length > 0) ? (
                      <>
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              Retencoes
                            </p>
                            {selectedProcess.dadosCompletos?.retencoes_tributarias?.optante_simples_nacional ? (
                              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-foreground">
                                Optante pelo Simples Nacional
                              </Badge>
                            ) : null}
                          </div>

                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {visibleRetencoes.map(([label, value]) => (
                              <SidebarField key={label} label={label} value={value || '-'} copyValue={value} copyMessage={`${label} copiado.`} />
                            ))}
                          </div>
                        </div>

                      </>
                    ) : (
                      <p className="font-ui text-sm text-muted-foreground">Nenhuma retencao extraida para este processo.</p>
                    )}
                  </SidebarSection>
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t border-border bg-muted/80 px-4 py-2.5 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 border-border bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground shadow-sm shadow-none hover:bg-muted"
                  onClick={() => window.open(selectedProcess.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir no SUAP
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 border-border bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground shadow-sm shadow-none hover:bg-muted"
                  onClick={() => void handleOpenPdf(selectedProcess)}
                  disabled={!selectedProcess.pdfUrl || openingPdfId === selectedProcess.id}
                >
                  {openingPdfId === selectedProcess.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Abrir PDF
                </Button>
                <Button
                  type="button"
                  className="h-9 gap-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                  onClick={() => void handleGenerateProcess(selectedProcess)}
                  disabled={!isPreliminaryStudyDocument && !selectedProcess.numProcesso}
                >
                  <FileText className="h-4 w-4" />
                  {isContractDocument
                    ? 'Gerar Contrato'
                    : isReferenceTermDocument
                      ? 'Gerar Termo de Referencia'
                      : isPreliminaryStudyDocument
                        ? 'Gerar ETP'
                      : 'Gerar Documento'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedProcessId(null)}
                  className="border border-border bg-white px-6 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground shadow-sm shadow-none hover:bg-muted"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
