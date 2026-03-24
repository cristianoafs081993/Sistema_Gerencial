import { useState } from 'react';
import { 
  FileText, 
  Trash2, 
  Plus, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  CheckCircle2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// --- Types ---
interface Natureza {
  descricao: string;
  valor: number;
}

const macroprocessoData: Record<string, string[]> = {
  "AD - Administração": ["8 - Orçamento", "9 - Contabilidade e Finanças", "10 - Compras e Licitações", "11 - Contratos", "12 - Material", "13 - Patrimônio", "5 - Contratos"],
  "AE - Atividades Estudantis": ["1 - Política de Atividades Estudantis", "2 - Serviço Social", "3 - Saúde Estudantil", "4 - Psicologia Escolar", "5 - Alimentação e Nutrição"],
  "CI - Comunicação Institucional": ["13 - Apoio a Eventos Institucionais"],
  "EN - Ensino": [
    "Política de Ensino - Planejamento", "Supervisão Técnica", "Gestão Pedagógica", "Avaliação e Regulação", 
    "Educação e Interseccionalidades", "Tecnologias Educacionais", "Administração Acadêmica", "Acesso Discente", 
    "Recursos de Informação", "Programas e Projetos", "Apoio ao Ensino"
  ],
  "EX - Extensão": ["1 - Política de Extensão", "2 - Interação com a Sociedade", "3 - Relações com o Mundo", "4 - Difusão e Cultura", "5 - Gestão FIC"],
  "GE - Gestão Estratégica": ["7 - Gestão da Unidade Agrícola"],
  "GO - Governança": ["19 - Suporte aos Colegiados"],
  "GP - Gestão de Pessoas": ["25 - Cadastro e Pagamento", "27 - Desenvolvimento", "28 - Saúde do Servidor"],
  "IE - Infraestrutura": ["14 - Gestão de Manutenção", "15 - Logística e Sustentabilidade"],
  "IN - Internacionalização": ["5 - Relações Internacionais"],
  "PI - Pesquisa, Pós e Inovação": ["2 - Inovação Tecnológica"],
  "TI - Tecnologia da Informação": ["1 - Política TIC", "2 - Governança", "4 - Infraestrutura"]
};

export default function GeradorDocumentos() {
  const [activeTab, setActiveTab] = useState<'despacho' | 'cdo'>('despacho');
  const [step, setStep] = useState(1);
  const [showModal, setShowModal] = useState(false);
  
  // Despacho State
  const [finalidade, setFinalidade] = useState('contrato');
  const [anoProjeto, setAnoProjeto] = useState('2026');
  const [editalProjeto, setEditalProjeto] = useState('10/2026-PROEX/IFRN');
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [tipo, setTipo] = useState('dos serviços de');
  const [descricao, setDescricao] = useState('');
  const [favorecido, setFavorecido] = useState('');
  const [processo, setProcesso] = useState('');
  const [valor, setValor] = useState('');
  const [empenho, setEmpenho] = useState('');

  // CDO State
  const [cdoUnidade, setCdoUnidade] = useState('DG/CN - DIREÇÃO-GERAL DO CAMPUS CURRAIS NOVOS');
  const [cdoProcTopo, setCdoProcTopo] = useState('');
  const [cdoMacro, setCdoMacro] = useState('');
  const [cdoProcDesc, setCdoProcDesc] = useState('');
  const [cdoSetor, setCdoSetor] = useState('PROAD - PRÓ-REITORIA DE ADMINISTRAÇÃO');
  const [cdoAno, setCdoAno] = useState('2026');
  const [cdoFinalidade, setCdoFinalidade] = useState('');
  const [cdoUg, setCdoUg] = useState('158366/151606');
  const [cdoOrigem, setCdoOrigem] = useState('');
  const [cdoPtres, setCdoPtres] = useState('');
  const [cdoPi, setCdoPi] = useState('');
  const [cdoGnd, setCdoGnd] = useState('3 - Outras Despesas Correntes');
  const [cdoFonte, setCdoFonte] = useState('1000000000');
  const [cdoNatDesc, setCdoNatDesc] = useState('339039 - OUTROS SERVICOS DE TERCEIROS - PESSOA JURIDICA');
  const [cdoNatValor, setCdoNatValor] = useState('0,00');
  const [naturezasExtras, setNaturezasExtras] = useState<Natureza[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // --- Helpers ---
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const parseCurrency = (val: string) => parseFloat(val.replace('.', '').replace(',', '.')) || 0;

  const totalCDO = () => {
    const base = parseCurrency(cdoNatValor);
    const extras = naturezasExtras.reduce((acc, n) => acc + n.valor, 0);
    return base + extras;
  };

  const handleAddNatureza = () => {
    const desc = prompt("Descrição da Natureza Extra (Ex: 339030 - MATERIAL):");
    if (!desc) return;
    const valStr = prompt("Valor (Ex: 1500,00):");
    if (!valStr) return;
    const val = parseCurrency(valStr);
    if (val <= 0) return toast.error("Valor inválido");
    setNaturezasExtras([...naturezasExtras, { descricao: desc, valor: val }]);
    setStep(1);
    setHasGenerated(false);
  };

  const handleRemoveNatureza = (index: number) => {
    const next = [...naturezasExtras];
    next.splice(index, 1);
    setNaturezasExtras(next);
    setStep(1);
    setHasGenerated(false);
  };

  const generateDespachoHTML = () => {
    const favorecidoUpper = favorecido.toUpperCase();
    const empenhoUpper = empenho.toUpperCase();
    
    let htmlTexto = "";
    let htmlItens = "";

    if (finalidade === 'contrato') {
      const textoTipo = tipo === "dos serviços de" 
        ? `e a prestação de serviços de <b>${descricao.toUpperCase()}</b>`
        : `e a atestação da aquisição de <b>${descricao.toUpperCase()}</b>`;

      htmlTexto = `Considerando a plena regularidade dos documentos apresentados ${textoTipo} para este <i>campus</i> Currais Novos, (Processo nº <b>${processo}</b>), <b>AUTORIZO</b> a liquidação da despesa no valor de <b>R$ ${valor}</b> referente ao empenho <b>${empenhoUpper}</b>, em favor da empresa <b>${favorecidoUpper}</b>`;
    } else {
      const editalUpper = editalProjeto.toUpperCase();
      htmlTexto = `Considerando a regularidade da documentação e a comprovação da execução das atividades pelo(s) bolsista(s) <b>${favorecidoUpper}</b> do projeto <b>"${nomeProjeto}"</b>, aprovado no Edital nº <b>${editalUpper}</b> (Processo nº <b>${processo}</b>), <b>AUTORIZO</b> a liquidação da despesa no valor de <b>R$ ${valor}</b>.`;
      htmlItens = `<div style="margin-bottom: 12px;"><b>Empenho(s):</b> <span style="color: #d9534f; text-decoration: underline; font-weight: bold; text-transform: uppercase;">${empenhoUpper}</span></div>`;
    }

    return `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: black;">
        <div>À Coordenação de Finanças e Contratos do <i>Campus</i> Currais Novos</div>
        <div style="font-weight: bold; margin-top: 30px;">Assunto: Autorização para Liquidação da Despesa</div>
        <div style="text-indent: 2.5cm; margin-top: 30px; margin-bottom: 25px;">${htmlTexto}</div>
        ${htmlItens}
        <div style="margin-top: 25px;">Na sequência, encaminhe-se o processo à Direção-Geral para análise e posterior autorização do pagamento, em conformidade com o cronograma e a disponibilidade orçamentária desta unidade.</div>
        <div style="margin-top: 40px;">Atenciosamente,</div>
      </div>
    `;
  };

  const generateCDOHTML = () => {
    const total = totalCDO();
    const totalStr = formatCurrency(total);
    
    let linhasTabela = `
      <tr>
        <td style="padding: 10px; border: 1px solid #000;">${cdoNatDesc}</td>
        <td style="padding: 10px; border: 1px solid #000; text-align: right;">R$ ${cdoNatValor}</td>
      </tr>
    `;

    naturezasExtras.forEach(nat => {
      linhasTabela += `
        <tr>
          <td style="padding: 10px; border: 1px solid #000;">${nat.descricao}</td>
          <td style="padding: 10px; border: 1px solid #000; text-align: right;">R$ ${formatCurrency(nat.valor)}</td>
        </tr>
      `;
    });

    return `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: black; line-height: 1.4;">
        <div style="margin-bottom: 2px;"><b>Unidade Administrativa:</b> ${cdoUnidade}</div>
        <div style="margin-bottom: 25px;"><b>Processo:</b> ${cdoProcTopo}</div>
        
        <p style="text-align: justify; line-height: 1.6; margin-bottom: 25px;">
            Visando subsidiar a execução de atividades concernentes ao Macroprocesso <b>${cdoMacro}</b> Processo <b>${cdoProcDesc}</b> gerido por <b>${cdoSetor}</b> programada no plano de atividades do Instituto para ${cdoAno}, certificamos a disponibilidade orçamentária abaixo detalhada com o reforço de empenho para o objetivo de atender à despesa com a finalidade de <b>${cdoFinalidade}</b>, no valor total de <b>R$ ${totalStr}</b>.
        </p>

        <div style="font-weight: bold; margin-bottom: 10px;">Detalhes Orçamentários:</div>
        <ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 25px;">
            <li><b>UG / UGR:</b> ${cdoUg}</li>
            <li><b>Origem de Recursos SUAP:</b> ${cdoOrigem}</li>
            <li><b>PTRES:</b> ${cdoPtres}</li>
            <li><b>PI:</b> ${cdoPi}</li>
            <li><b>Grupo de Natureza de Despesa (GND):</b> ${cdoGnd}</li>
            <li><b>Fonte:</b> ${cdoFonte}</li>
            <li><b>Valor:</b> R$ ${totalStr}</li>
        </ul>

        <div style="font-weight: bold; margin-bottom: 10px;">Naturezas de despesas:</div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #000;">
            <thead>
                <tr style="background-color: #f2f2f2; text-align: left;">
                    <th style="padding: 10px; border: 1px solid #000; font-size: 10pt;">Natureza de despesa</th>
                    <th style="padding: 10px; border: 1px solid #000; text-align: right; font-size: 10pt;">Valor</th>
                </tr>
            </thead>
            <tbody>
                ${linhasTabela}
                <tr style="font-weight: bold; background-color: #f9f9f9;">
                    <td style="padding: 10px; border: 1px solid #000;">Total</td>
                    <td style="padding: 10px; border: 1px solid #000; text-align: right;">R$ ${totalStr}</td>
                </tr>
            </tbody>
        </table>
      </div>
    `;
  };

  const handleCopy = async () => {
    const html = activeTab === 'despacho' ? generateDespachoHTML() : generateCDOHTML();
    const blob = new Blob([html], { type: "text/html" });
    try {
      const data = [new ClipboardItem({ "text/html": blob })];
      await navigator.clipboard.write(data);
      toast.success("Documento copiado com sucesso!");
      setStep(3);
    } catch (err) {
      toast.error("Erro ao copiar o documento");
    }
  };

  const handleClone = () => {
    const id = activeTab === 'despacho' ? '1026154' : '1016427';
    window.open(`https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/${id}/`, '_blank');
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setHasGenerated(false);
    window.location.reload();
  };

  const handleGenerate = () => {
    setStep(2);
    setHasGenerated(true);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      
      {/* Tabs Navigation */}
      <div className="flex bg-muted/50 p-1.5 rounded-xl self-start">
        <button 
          onClick={() => { setActiveTab('despacho'); setStep(1); setHasGenerated(false); }}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
            activeTab === 'despacho' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
          )}
        >
          GERADOR DE DESPACHO
        </button>
        <button 
          onClick={() => { setActiveTab('cdo'); setStep(1); setHasGenerated(false); }}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
            activeTab === 'cdo' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
          )}
        >
          GERADOR DE CDO
        </button>
      </div>

      {/* Horizontal Pipeline (Classic) */}
      <div className="flex items-start justify-between w-full mt-4 mb-2 relative px-8">
        <div className="absolute top-5 left-[15%] right-[15%] h-[3px] bg-muted-foreground/20 z-0" />
        <div 
          className="absolute top-5 left-[15%] h-[3px] z-0 transition-all duration-500 bg-primary" 
          style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '70%' }} 
        />

        {[
          { label: '1. Preencher\nDados', id: 1 },
          { label: '2. Gerar\nDocumento', id: 2 },
          { label: '3. Copiar e\nFinalizar', id: 3 },
        ].map((item) => {
          const isActive = step === item.id;
          const isCompleted = step > item.id;
          return (
            <div key={item.id} className={cn("flex flex-col items-center flex-1 relative z-10 transition-opacity duration-300", step >= item.id ? "opacity-100" : "opacity-40")}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-2 shadow-sm transition-colors",
                isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : 
                isCompleted ? "bg-emerald-600 text-white ring-2 ring-emerald-600 border-none" : 
                "bg-muted text-muted-foreground border-2 border-background"
              )}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : item.id}
              </div>
              <span className={cn(
                "text-sm font-bold text-center whitespace-pre-line leading-tight", 
                isActive ? "text-primary" : 
                isCompleted ? "text-emerald-700" : 
                "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Form Area */}
      <Card className={cn(
        "border-t-4 shadow-lg overflow-hidden transition-all duration-300",
        activeTab === 'despacho' ? "border-t-emerald-500" : "border-t-purple-500"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className={cn("w-5 h-5", activeTab === 'despacho' ? "text-emerald-500" : "text-purple-500")} />
            {activeTab === 'despacho' ? 'Configurar Despacho de Liquidação' : 'Certificado de Dotação Orçamentária'}
          </CardTitle>
          <CardDescription>
            Preencha os campos abaixo para gerar o documento oficial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {activeTab === 'despacho' ? (
            // --- DESPACHO FORM ---
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Finalidade</Label>
                  <Select value={finalidade} onValueChange={v => { setFinalidade(v); setStep(1); setHasGenerated(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contrato">Contrato ou Aquisição Comum</SelectItem>
                      <SelectItem value="projeto">Projeto de Pesquisa / Extensão (Alunos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <AnimatePresence mode="wait">
                  {finalidade === 'projeto' ? (
                    <motion.div 
                      key="proj-fields"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="space-y-2">
                        <Label>Ano</Label>
                        <Input value={anoProjeto} onChange={e => { setAnoProjeto(e.target.value); setStep(1); setHasGenerated(false); }} />
                      </div>
                      <div className="space-y-2">
                        <Label>Identificação do Edital</Label>
                        <Input value={editalProjeto} onChange={e => { setEditalProjeto(e.target.value); setStep(1); setHasGenerated(false); }} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="cont-field"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-2"
                    >
                      <Label>Tipo</Label>
                      <Select value={tipo} onValueChange={v => { setTipo(v); setStep(1); setHasGenerated(false); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dos serviços de">Serviço</SelectItem>
                          <SelectItem value="da aquisição de">Aquisição</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {finalidade === 'projeto' ? (
                <div className="space-y-2">
                  <Label>Nome do Projeto</Label>
                  <Textarea 
                    rows={2} 
                    value={nomeProjeto} 
                    onChange={e => { setNomeProjeto(e.target.value); setStep(1); setHasGenerated(false); }} 
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Descrição Detalhada</Label>
                  <Textarea 
                    rows={2} 
                    value={descricao} 
                    onChange={e => { setDescricao(e.target.value); setStep(1); setHasGenerated(false); }} 
                    placeholder="Ex: SERVIÇOS DE MANUTENÇÃO PREVENTIVA..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{finalidade === 'projeto' ? 'Favorecido (Alunos)' : 'Favorecido (Empresa)'}</Label>
                <Input value={favorecido} onChange={e => { setFavorecido(e.target.value); setStep(1); setHasGenerated(false); }} className="uppercase" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Processo nº</Label>
                  <Input value={processo} onChange={e => { setProcesso(e.target.value); setStep(1); setHasGenerated(false); }} placeholder="23035.XXXXXX/202X-XX" />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input value={valor} onChange={e => { setValor(e.target.value); setStep(1); setHasGenerated(false); }} placeholder="0.000,00" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Número do Empenho</Label>
                <Input value={empenho} onChange={e => { setEmpenho(e.target.value); setStep(1); setHasGenerated(false); }} placeholder="202XNE000XXX" className="uppercase" />
              </div>
            </>
          ) : (
            // --- CDO FORM ---
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade Administrativa</Label>
                  <Input value={cdoUnidade} onChange={e => { setCdoUnidade(e.target.value); setStep(1); setHasGenerated(false); }} />
                </div>
                <div className="space-y-2">
                  <Label>Processo nº</Label>
                  <Input value={cdoProcTopo} onChange={e => { setCdoProcTopo(e.target.value); setStep(1); setHasGenerated(false); }} placeholder="23035.XXXXXX/2026-XX" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Macroprocesso</Label>
                  <Select value={cdoMacro} onValueChange={v => { setCdoMacro(v); setCdoProcDesc(''); setStep(1); setHasGenerated(false); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(macroprocessoData).sort().map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Processo (Descrição)</Label>
                  <Select value={cdoProcDesc} onValueChange={v => { setCdoProcDesc(v); setStep(1); setHasGenerated(false); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(macroprocessoData[cdoMacro] || []).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Gerido por</Label>
                  <Input value={cdoSetor} onChange={e => { setCdoSetor(e.target.value); setStep(1); setHasGenerated(false); }} />
                </div>
                <div className="space-y-2">
                  <Label>Ano Atividades</Label>
                  <Input value={cdoAno} onChange={e => { setCdoAno(e.target.value); setStep(1); setHasGenerated(false); }} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Finalidade (Ex: Custeio Mercatto)</Label>
                <Input value={cdoFinalidade} onChange={e => { setCdoFinalidade(e.target.value); setStep(1); setHasGenerated(false); }} />
              </div>

              <div className="bg-muted/40 p-4 rounded-xl space-y-4 border border-border/60">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>UG / UGR</Label>
                    <Input value={cdoUg} onChange={e => { setCdoUg(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem Recurso SUAP</Label>
                    <Input value={cdoOrigem} onChange={e => { setCdoOrigem(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>PTRES</Label>
                    <Input value={cdoPtres} onChange={e => { setCdoPtres(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>PI</Label>
                    <Input value={cdoPi} onChange={e => { setCdoPi(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GND</Label>
                    <Input value={cdoGnd} onChange={e => { setCdoGnd(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fonte</Label>
                    <Input value={cdoFonte} onChange={e => { setCdoFonte(e.target.value); setStep(1); setHasGenerated(false); }} />
                  </div>
                </div>
              </div>

              <Card className="bg-transparent border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Naturezas de Despesa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Natureza de Despesa (Ex: 339034 - DIARIAS)</Label>
                      <Input value={cdoNatDesc} onChange={e => { setCdoNatDesc(e.target.value); setStep(1); setHasGenerated(false); }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">Valor (R$)</Label>
                      <Input value={cdoNatValor} onChange={e => { setCdoNatValor(e.target.value); setStep(1); setHasGenerated(false); }} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {naturezasExtras.map((n, idx) => (
                      <motion.div 
                        key={`extra-${idx}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between bg-surface-card p-3 rounded-lg border shadow-sm"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-medium truncate">{n.descricao}</p>
                          <p className="text-xs text-primary font-bold">R$ {formatCurrency(n.valor)}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveNatureza(idx)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-dashed bg-cyan-50/50 hover:bg-cyan-100 text-cyan-700 border-cyan-200" 
                    onClick={handleAddNatureza}
                  >
                    <Plus className="w-4 h-4 mr-2" /> ADICIONAR NATUREZA DE DESPESA
                  </Button>

                  <div className="flex justify-between items-center px-4 py-3 bg-blue-50/50 border-2 border-blue-200 rounded-lg text-blue-800">
                    <span className="text-sm font-semibold">TOTAL PREVISTO:</span>
                    <span className="text-lg font-black font-mono tabular-nums">R$ {formatCurrency(totalCDO())}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4 border-t">
            <div className="flex gap-4">
              <Button 
                className={cn(
                  "flex-1 h-12 text-lg font-bold shadow-lg transition-all active:scale-[0.98] text-white",
                  activeTab === 'despacho' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
                )} 
                onClick={handleGenerate}
              >
                <RefreshCw className={cn("w-5 h-5 mr-2", hasGenerated && "animate-spin")} />
                {hasGenerated ? `REGERAR ${activeTab.toUpperCase()}` : `GERAR ${activeTab.toUpperCase()}`}
              </Button>
              <Button variant="outline" className="h-12 w-32 border-2 hover:bg-destructive hover:text-white" onClick={handleReset}>
                LIMPAR
              </Button>
            </div>

            {/* --- SHORTCUT BUTTONS (VISIBLE AFTER GENERATE) --- */}
            <AnimatePresence>
              {hasGenerated && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 gap-4 pb-2"
                >
                  <Button 
                    variant="outline"
                    className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-black transition-all border-none active:scale-[0.98]"
                    onClick={handleClone}
                  >
                    <ExternalLink className="w-5 h-5 mr-2" /> CLONAR NO SUAP
                  </Button>
                  <Button 
                    className={cn(
                      "h-14 font-black transition-all border-none active:scale-[0.98] text-white",
                      activeTab === 'despacho' 
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30" 
                        : "bg-purple-600 hover:bg-purple-700 shadow-purple-500/30"
                    )}
                    onClick={handleCopy}
                  >
                    <Copy className="w-5 h-5 mr-2" /> COPIAR {activeTab.toUpperCase()}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </CardContent>
      </Card>

      {/* Preview Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-background w-full max-w-[23cm] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/20">
                <h3 className="text-xl font-bold text-foreground">Documento Gerado</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-zinc-200/50">
                <div 
                  className="bg-white text-black p-[2.5cm] min-h-[29.7cm] shadow-xl mx-auto w-[21cm] focus:outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: activeTab === 'despacho' ? generateDespachoHTML() : generateCDOHTML() }}
                />
              </div>

              <div className="px-6 py-4 border-t flex gap-4 bg-muted/20 shrink-0">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-sm px-6"
                  onClick={handleClone}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> CLONAR NO SUAP
                </Button>
                
                <div className="flex-1" />

                <Button 
                  className={cn(
                    "font-bold h-12 px-8 shadow-sm text-white",
                    activeTab === 'despacho' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-purple-600 hover:bg-purple-700"
                  )} 
                  onClick={handleCopy}
                >
                  <Copy className="w-4 h-4 mr-2" /> COPIAR {activeTab.toUpperCase()}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
