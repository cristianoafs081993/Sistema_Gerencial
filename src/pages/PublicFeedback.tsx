import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Building,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MessageSquare,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type Ambiente,
  manutencaoService,
  OCORRENCIA_FOTO_ACCEPT,
  validateOcorrenciaFoto,
} from '@/services/manutencao';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { buildSuapAuthorizeUrl } from '@/lib/suapAuth';

const emojiMap: Record<number, string> = {
  5: '😀',
  4: '🙂',
  3: '😐',
  2: '🙁',
  1: '😠',
};

const labelMap: Record<number, string> = {
  5: 'Excelente',
  4: 'Bom',
  3: 'Regular',
  2: 'Ruim',
  1: 'Muito Ruim',
};

const problemOptions = [
  { id: 'sujeira', label: 'Sujeira no ambiente' },
  { id: 'falta_papel_higienico', label: 'Falta de papel higiênico' },
  { id: 'falta_sabonete_papel_toalha', label: 'Falta de sabonete / papel toalha' },
  { id: 'ar_condicionado', label: 'Ar condicionado com problema' },
  { id: 'lampada_queimada', label: 'Lâmpada queimada' },
  { id: 'vazamento_hidraulico', label: 'Vazamento / entupimento' },
  { id: 'lixeira_cheia', label: 'Lixeira cheia' },
  { id: 'outros', label: 'Outros problemas' },
];

export default function PublicFeedback() {
  const { codigo } = useParams<{ codigo: string }>();
  const [ambiente, setAmbiente] = useState<Ambiente | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Form State - Occurrence
  const [rating, setRating] = useState<number | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [observation, setObservation] = useState('');
  const [occurrencePhoto, setOccurrencePhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Form State - Checkin (Staff)
  const [staffTab, setStaffTab] = useState(false); // Toggle to staff login view
  const [staffName, setStaffName] = useState('');
  const [staffActions, setStaffActions] = useState<string[]>([]);
  const [materialsUsed, setMaterialsUsed] = useState<Record<string, number>>({
    papel_higienico: 0,
    sabonete_liquido: 0,
    papel_toalha: 0,
    saco_lixo: 0,
    outros: 0,
  });

  const handleQuantityChange = (material: string, increment: number) => {
    setMaterialsUsed((prev) => ({
      ...prev,
      [material]: Math.max(0, prev[material] + increment),
    }));
  };
  const [staffObservation, setStaffObservation] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(false);

  // SUAP Auth State
  const [suapUser, setSuapUser] = useState<{ nome: string; matricula: string; email: string; foto: string | null } | null>(null);
  const [manualLogged, setManualLogged] = useState(false);

  const isStaffLoggedIn = !!suapUser || manualLogged;

  const handleManualLogin = () => {
    if (!staffName.trim()) {
      toast.error('Preencha seu nome.');
      return;
    }
    if (staffPin.trim() !== '1234') {
      toast.error('PIN de segurança incorreto.');
      return;
    }
    setManualLogged(true);
    toast.success('Autenticado com sucesso!');
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem('suap_staff_user');
    setSuapUser(null);
    setManualLogged(false);
    setStaffName('');
    setStaffPin('');
    toast.info('Sessão encerrada.');
  };

  useEffect(() => {
    const storedUser = sessionStorage.getItem('suap_staff_user');
    console.log('PublicFeedback mount storedUser:', storedUser);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        console.log('Parsed SUAP user:', user);
        setSuapUser(user);
        setStaffName(user.nome || 'Colaborador');
        setStaffTab(true);
      } catch (e) {
        console.error('Erro ao ler usuário do SUAP da sessão:', e);
        sessionStorage.removeItem('suap_staff_user');
      }
    }
  }, []);

  const handleSuapLogin = () => {
    const suapAuthUrl = buildSuapAuthorizeUrl({ state: codigo || '' });
    window.location.href = suapAuthUrl;
  };

  useEffect(() => {
    const fetchAmbiente = async () => {
      if (!codigo) {
        setErrorState('Código de ambiente não fornecido.');
        setLoading(false);
        return;
      }

      try {
        const data = await manutencaoService.getAmbienteByCodigo(codigo);
        if (data) {
          setAmbiente(data);
        } else {
          setErrorState(`Ambiente "${codigo}" não foi encontrado ou está inativo.`);
        }
      } catch (err) {
        console.error(err);
        setErrorState('Erro de conexão ao carregar dados do ambiente.');
      } finally {
        setLoading(false);
      }
    };

    void fetchAmbiente();
  }, [codigo]);

  const handleProblemToggle = (problemId: string) => {
    setSelectedProblems((prev) =>
      prev.includes(problemId)
        ? prev.filter((id) => id !== problemId)
        : [...prev, problemId]
    );
  };

  const clearOccurrencePhoto = () => {
    setPhotoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setOccurrencePhoto(null);
  };

  const resetReport = () => {
    setReportSuccess(false);
    setRating(null);
    setSelectedProblems([]);
    setObservation('');
    clearOccurrencePhoto();
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    const validationError = validateOcorrenciaFoto(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPhotoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setOccurrencePhoto(file);
  };

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambiente || !rating) {
      toast.error('Selecione uma avaliação de 1 a 5.');
      return;
    }

    setSubmittingReport(true);
    try {
      await manutencaoService.createOcorrencia({
        ambiente_id: ambiente.id,
        respondente_tipo: 'anonimo',
        avaliacao: rating,
        problemas: selectedProblems,
        observacao: observation.trim() || null,
      }, occurrencePhoto);
      setReportSuccess(true);
      toast.success('Muito obrigado! Sua avaliação foi enviada.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmitCheckin triggered:', { ambiente, staffName, suapUser, staffPin });
    if (!ambiente || (!suapUser && !staffName)) {
      toast.error('Preencha os dados obrigatórios.');
      return;
    }

    if (!suapUser && !staffPin) {
      toast.error('Informe o PIN de segurança.');
      return;
    }

    if (!suapUser && staffPin.trim() !== '1234') {
      toast.error('PIN de segurança incorreto.');
      return;
    }

    if (staffActions.length === 0) {
      toast.error('Selecione pelo menos uma ação realizada.');
      return;
    }

    setSubmittingCheckin(true);
    try {
      const responsavel = suapUser
        ? `${suapUser.nome} (${suapUser.matricula})`
        : staffName.trim();

      const materiais = Object.entries(materialsUsed)
        .filter(([_, qty]) => qty > 0)
        .map(([mat, qty]) => ({
          material: mat as 'papel_higienico' | 'sabonete_liquido' | 'papel_toalha' | 'saco_lixo' | 'outros',
          quantidade: qty,
        }));

      await manutencaoService.createCheckin({
        ambiente_id: ambiente.id,
        responsavel_nome: responsavel,
        acoes_realizadas: staffActions,
        observacao: staffObservation.trim() || null,
        materiais: materiais.length > 0 ? materiais : undefined,
      });
      setCheckinSuccess(true);
      toast.success('Passagem de conservação registrada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar passagem.');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Carregando dados do ambiente...</p>
      </div>
    );
  }

  if (errorState || !ambiente) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Ops! Ambiente indisponível</h2>
          <p className="text-sm text-slate-500">{errorState || 'Ambiente inválido.'}</p>
          <div className="text-xs text-slate-400 font-mono mt-4">GovAnalytics • IFRN</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center justify-start">
      <div className="max-w-md w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-1.5">
            <span className="text-emerald-600">Gov</span>Analytics
          </h2>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">IFRN Campus Central</p>
        </div>

        {/* Environment Profile Card */}
        <Card className="border shadow-sm overflow-hidden bg-white rounded-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-[6px] bg-emerald-500" />
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-start gap-3">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100 shrink-0">
                <Building className="h-6 w-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-lg font-black text-slate-900 leading-tight truncate">
                  {ambiente.nome}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-700 uppercase">
                    {ambiente.codigo}
                  </Badge>
                  {ambiente.bloco && (
                    <span className="text-xs text-slate-400 font-medium">
                      • {ambiente.bloco}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Interface Cards */}
        {!staffTab ? (
          // USER / VISITOR REPORT MODE
          reportSuccess ? (
            <Card className="border shadow-soft rounded-2xl bg-white text-center py-10 px-6 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">Muito obrigado!</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Seu feedback foi registrado e será usado para aprimorar os serviços de conservação do campus.
                </p>
              </div>
              <div className="pt-2">
                <Button onClick={resetReport} variant="outline" className="h-10">
                  Enviar outro feedback
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="border shadow-soft rounded-2xl bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-extrabold text-slate-800">Avalie este ambiente</CardTitle>
                <CardDescription>Nos ajude a manter a qualidade de limpeza e conservação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmitReport} className="space-y-6">
                  {/* Rating Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block text-center">
                      Qual o estado geral do local?
                    </label>
                    <div className="flex justify-between items-center gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setRating(score)}
                          className={cn(
                            'flex flex-col items-center justify-center flex-1 py-3 border rounded-xl transition-all duration-200',
                            rating === score
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-[1.03]'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                          )}
                        >
                          <span className="text-2xl mb-1">{emojiMap[score]}</span>
                          <span className="text-[10px] font-bold tracking-tight">{labelMap[score]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checklist of problems */}
                  <div className="space-y-3 pt-2 border-t border-dashed">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Marque se houver algum problema (Opcional):
                    </label>
                    <div className="grid gap-2 grid-cols-1">
                      {problemOptions.map((opt) => (
                        <label
                          key={opt.id}
                          htmlFor={opt.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-colors duration-150',
                            selectedProblems.includes(opt.id)
                              ? 'bg-slate-50 border-slate-300'
                              : 'bg-white border-slate-200 hover:bg-slate-50/50'
                          )}
                        >
                          <Checkbox
                            id={opt.id}
                            checked={selectedProblems.includes(opt.id)}
                            onCheckedChange={() => handleProblemToggle(opt.id)}
                          />
                          <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Observation Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Observação / Detalhes (Opcional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <Textarea
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Ex: Ar condicionado pingando, falta papel toalha no dispenser..."
                        className="pl-9 min-h-[90px] input-system"
                      />
                    </div>
                  </div>

                  {/* Optional photo */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Foto do problema (Opcional)
                      </label>
                      <p className="mt-1 text-xs text-slate-400">
                        Use a câmera ou escolha uma imagem JPEG, PNG ou WebP de até 5 MB.
                      </p>
                    </div>

                    <input
                      id="occurrence-photo"
                      type="file"
                      accept={OCORRENCIA_FOTO_ACCEPT}
                      capture="environment"
                      className="sr-only"
                      onChange={handlePhotoChange}
                    />

                    {photoPreviewUrl ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img
                          src={photoPreviewUrl}
                          alt="Pré-visualização da foto selecionada"
                          className="max-h-64 w-full object-cover"
                        />
                        <div className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700">
                              {occurrencePhoto?.name}
                            </p>
                            <p className="text-[11px] text-slate-400">Foto pronta para envio</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearOccurrencePhoto}
                            className="shrink-0 gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="occurrence-photo"
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700"
                      >
                        <Camera className="h-5 w-5" />
                        Tirar ou escolher foto
                      </label>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={!rating || submittingReport}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-sm rounded-xl font-bold gap-2"
                  >
                    {submittingReport ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar Avaliação'
                    )}
                  </Button>
                </form>

                {/* staff login link */}
                <div className="pt-4 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setStaffTab(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Área da equipe de limpeza / check-in
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          // STAFF CHECK-IN MODE
          checkinSuccess ? (
            <Card className="border shadow-soft rounded-2xl bg-white text-center py-10 px-6 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">Passagem Registrada!</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Obrigado, seu registro de conservação foi cadastrado no sistema do campus.
                </p>
              </div>
              <div className="pt-2">
                <Button 
                  onClick={() => { 
                    setCheckinSuccess(false); 
                    setStaffName(''); 
                    setStaffObservation(''); 
                    setStaffPin(''); 
                    setStaffActions([]);
                    setMaterialsUsed({
                      papel_higienico: 0,
                      sabonete_liquido: 0,
                      papel_toalha: 0,
                      saco_lixo: 0,
                      outros: 0,
                    });
                    setManualLogged(false); 
                    setStaffTab(false); 
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6"
                >
                  Voltar ao início
                </Button>
              </div>
            </Card>
          ) : !isStaffLoggedIn ? (
            <Card className="border shadow-soft rounded-2xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-extrabold text-slate-800">Acesso da Equipe</CardTitle>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wide">
                    Identificação
                  </Badge>
                </div>
                <CardDescription>Acesse com o SUAP para continuar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  onClick={handleSuapLogin}
                  className="w-full bg-[#1b5e20] hover:bg-[#1b5e20]/90 text-white h-11 shadow-sm rounded-xl font-bold gap-2 flex items-center justify-center transition-all"
                >
                  <Lock className="h-4 w-4" />
                  Autenticar com o SUAP
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStaffTab(false)}
                  className="w-full h-11 rounded-xl"
                >
                  Voltar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border shadow-soft rounded-2xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-extrabold text-slate-800">Passagem de Conservação</CardTitle>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wide">
                    Equipe
                  </Badge>
                </div>
                <CardDescription>Registre sua passagem ou ação de limpeza neste local.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSubmitCheckin} className="space-y-4">
                  {suapUser ? (
                    <div className="bg-emerald-50/75 border border-emerald-100 rounded-xl p-3.5 flex items-center gap-3">
                      {suapUser.foto ? (
                        <img
                          src={suapUser.foto}
                          alt={suapUser.nome}
                          className="w-10 h-10 rounded-full border border-emerald-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          {suapUser.nome?.charAt(0) || 'C'}
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Conectado via SUAP
                        </div>
                        <div className="text-sm font-bold text-slate-800 truncate">{suapUser.nome}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {suapUser.matricula} • {suapUser.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="ml-auto text-xs text-rose-500 hover:text-rose-700 font-semibold underline shrink-0"
                      >
                        Sair
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                        {(staffName?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Identificado Manualmente
                        </div>
                        <div className="text-sm font-bold text-slate-800 truncate">{staffName}</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="ml-auto text-xs text-rose-500 hover:text-rose-700 font-semibold underline shrink-0"
                      >
                        Sair
                      </button>
                    </div>
                  )}

                  {/* Action Selector (Multiple Checklist) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Ações Realizadas
                    </label>
                    <div className="grid gap-2 grid-cols-2">
                      {[
                        { id: 'limpeza_padrao', label: '🧹 Limpeza Padrão' },
                        { id: 'reposicao_insumos', label: '🔋 Reposição de Insumos' },
                        { id: 'inspecao', label: '🔍 Inspeção / Vistoria' },
                        { id: 'manutencao_corretiva', label: '🛠️ Manutenção Corretiva' },
                      ].map((opt) => (
                        <label
                          key={opt.id}
                          className={cn(
                            'flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors duration-150 text-xs font-bold',
                            staffActions.includes(opt.id)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                          )}
                        >
                          <Checkbox
                            checked={staffActions.includes(opt.id)}
                            onCheckedChange={() => {
                              setStaffActions((prev) =>
                                prev.includes(opt.id)
                                  ? prev.filter((id) => id !== opt.id)
                                  : [...prev, opt.id]
                              );
                            }}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Material Usage Inputs */}
                  {staffActions.includes('reposicao_insumos') && (
                    <div className="space-y-3 pt-3 border-t border-dashed border-slate-200">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Materiais Consumidos
                      </label>
                      <div className="grid gap-3 grid-cols-1">
                        {[
                          { id: 'papel_higienico', label: '🧻 Papel Higiênico (rolos)' },
                          { id: 'sabonete_liquido', label: '🧼 Sabonete Líquido (recargas)' },
                          { id: 'papel_toalha', label: '🧻 Papel Toalha (pacotes)' },
                          { id: 'saco_lixo', label: '🗑️ Saco de Lixo (unidades)' },
                          { id: 'outros', label: '📦 Outros Materiais' },
                        ].map((m) => (
                          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                            <span className="text-xs font-bold text-slate-700">{m.label}</span>
                            <div className="flex items-center gap-2.5">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 w-8 rounded-lg border-slate-200 p-0 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                                onClick={() => handleQuantityChange(m.id, -1)}
                              >
                                -
                              </Button>
                              <span className="text-sm font-black font-mono text-slate-800 w-6 text-center">
                                {materialsUsed[m.id]}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 w-8 rounded-lg border-slate-200 p-0 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                                onClick={() => handleQuantityChange(m.id, 1)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observation (Optional) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Observação (Opcional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 text-slate-400 h-4 w-4" />
                      <Textarea
                        value={staffObservation}
                        onChange={(e) => setStaffObservation(e.target.value)}
                        placeholder="Caso queira relatar alguma observação sobre a limpeza ou manutenção..."
                        className="pl-9 min-h-[70px] input-system"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStaffTab(false)}
                      className="flex-1 h-11 rounded-xl"
                    >
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      disabled={submittingCheckin}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-sm rounded-xl font-bold gap-2"
                    >
                      {submittingCheckin ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        'Confirmar Registro'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )
        )}

        {/* Footer branding */}
        <div className="text-center space-y-1">
          <div className="text-[10px] text-slate-400 font-mono">GovAnalytics Portal de Serviços</div>
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-400">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Conexão segura SSL
            •
            <Clock className="h-3 w-3" />
            Inspeção em tempo real
          </div>
        </div>
      </div>
    </div>
  );
}
