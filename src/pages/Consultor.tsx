import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bot, 
  Send, 
  Paperclip, 
  FileText, 
  X, 
  ShieldCheck, 
  Loader2,
  Trash2,
  MessageSquare,
  AlertCircle,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
// PDF.js import (using dynamic import to avoid SSR issues if any, but since it's vite, standard import works)
import * as pdfjsLib from 'pdfjs-dist';

// Configurar o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachedFile?: { name: string; text: string; base64?: string };
  sources?: any[];
};

export default function Consultor() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('consultor-chat-history');
      if (saved) {
        // Validação básica do dado salvo
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler histórico de chat', e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Olá! Sou o seu Consultor Jurídico especializado nos normativos do IFRN. \n\nVocê pode me fazer perguntas diretas ou **anexar um PDF (ex: Minuta de TR)** para que eu analise se ele fere as regras de contratação vigentes. Como posso ajudar hoje?'
      }
    ];
  });
  
  // Portals state to ensure targets exist after mount
  const [portalTargets, setPortalTargets] = useState<{
    actions: HTMLElement | null;
    subtitle: HTMLElement | null;
  }>({ actions: null, subtitle: null });

  useEffect(() => {
    setPortalTargets({
      actions: document.getElementById('header-actions'),
      subtitle: document.getElementById('header-subtitle')
    });
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = [
    "Analisando normativos do IFRN...",
    "Consultando a base de conhecimento jurídica...",
    "Lendo documentos e extraindo contexto...",
    "Procurando regras aplicáveis ao caso...",
    "Formulando resposta do Consultor..."
  ];

  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string; base64?: string; file: File } | null>(null);
  
  // RAG Metadata Filters state
  const [metadataFilters, setMetadataFilters] = useState({
    categoria: '',
    servico: ''
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ciclo dinâmico do texto de carregamento
  useEffect(() => {
    if (!isLoading) {
      setLoadingTextIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 2200); // Troca a cada 2.2s
    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-scroll para a última mensagem e salva no localStorage
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      // Remover o Base64 pesado antes de salvar na persistência para não estourar os 5MB do Storage
      const pl = messages.map(m => ({
        ...m,
        attachedFile: m.attachedFile ? { name: m.attachedFile.name, text: m.attachedFile.text } : undefined
      }));
      localStorage.setItem('consultor-chat-history', JSON.stringify(pl));
    } catch (e) {
      console.warn('LocalStorage limit reached for chat history', e);
      toast.warning('Histórico muito grande. Não foi possível salvar o último documento na memória permanente da aba.');
    }
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Por favor, envie apenas arquivos PDF.');
      return;
    }

    const loadToast = toast.loading('Lendo PDF...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
        
        // Optimisation: Stop parsing if we have enough context for the LLM
        // This prevents the browser from freezing on massive PDFs (e.g. 500 pages)
        if (fullText.length > 35000) {
           break;
        }
      }

      // Detecção Automática de Roteamento (Auto-Tagging Local Heurístico)
      const scanContext = fullText.slice(0, 5000).toLowerCase(); // Vasculhar Objeto
      let autoService = '';
      if (scanContext.includes('limpeza e conservação') || scanContext.includes('serviços contínuos de limpeza')) {
         autoService = 'limpeza';
      } else if (scanContext.includes('manutenção predial') || scanContext.includes('serviços continuados de engenharia')) {
         autoService = 'manutencao';
      } else if (scanContext.includes('condução de veículos') || scanContext.includes('motorista')) {
         autoService = 'veiculos';
      } else if (scanContext.includes('vigilância') || scanContext.includes('segurança armada')) {
         autoService = 'vigilancia';
      }
      setMetadataFilters(prev => ({ ...prev, servico: autoService }));

      // Converte para Base64 para leitura Multimodal do LLM (Geração)
      const base64Data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve((fr.result as string).split(',')[1]);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });

      setAttachedFile({ 
        name: file.name, 
        text: fullText,
        base64: base64Data,
        file
      });
      toast.success('PDF carregado! Faça sua pergunta.', { id: loadToast });
      
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ler o PDF. Tente novamente.', { id: loadToast });
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      attachedFile: attachedFile ? { name: attachedFile.name, text: attachedFile.text, base64: attachedFile.base64 } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultor`;
      
      const allMsgs = messages.concat(userMsg);
      // Sempre buscar o último PDF anexado na conversa para manter o contexto
      const activeFileMeta = [...allMsgs].reverse().find(m => m.attachedFile?.text)?.attachedFile;
      const lastPdfText = activeFileMeta?.text;
      const lastPdfBase64 = activeFileMeta?.base64;

      const metadataPayload = metadataFilters.servico ? { servicos: [metadataFilters.servico] } : null;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ 
          messages: allMsgs.slice(-10).map(m => ({ role: m.role, content: m.content })),
          fileText: lastPdfText || null,
          fileBase64: lastPdfBase64 || null,
          tipoFiltro: metadataFilters.categoria || null,
          metadataFiltro: metadataPayload
        })
      });

      if (!response.ok) throw new Error('Falha de conexão');
      if (!response.body) throw new Error('Sem resposta');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantText = '';
      let fontesDisponiveis: any[] = [];
      let aiMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', sources: [] }]);
      setIsLoading(false); // Retira o loading spinner, pois as letras já vão começar a aparecer

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
           buffer += decoder.decode(value, { stream: true });
        }

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              if (data.__metadata) {
                fontesDisponiveis = data.fontes_disponiveis || [];
              } else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                assistantText += data.candidates[0].content.parts[0].text;
                
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const targetIndex = newMsgs.findIndex(m => m.id === aiMsgId);
                  if (targetIndex === -1) return newMsgs;

                  const target = { ...newMsgs[targetIndex] };
                  
                  // Atualiza a UI removendo as marcações [número] do display visual
                  target.content = assistantText.replace(/(\s*\[\d+\]\s*,?)+/g, '').trim();

                  // Atualiza as fontes inferindo a partir do texto sujo (assistantText)
                  const citationsMatch = assistantText.match(/\[(\d+)\]/g);
                  if (citationsMatch && fontesDisponiveis.length > 0) {
                    const citedNumbers = [...new Set(citationsMatch.map(s => parseInt(s.replace(/\D/g, ''))))];
                    target.sources = citedNumbers
                      .filter(num => num > 0 && num <= fontesDisponiveis.length)
                      .map(num => fontesDisponiveis[num - 1]);
                  }

                  newMsgs[targetIndex] = target;
                  return newMsgs;
                });
              } else if (data.candidates && data.candidates[0]?.finishReason) {
                 // Check if the model explicitly stopped early
                 const reason = data.candidates[0].finishReason;
                 if (reason !== 'STOP') {
                    console.warn('Gemini Finish reason:', reason);
                    assistantText += `\n\n*[Aviso do Sistema: O servidor de IA interrompeu a análise na metade. Motivo técnico: ${reason}]*`;
                    setMessages(prev => {
                       const newMsgs = [...prev];
                       const target = { ...newMsgs[newMsgs.length - 1] };
                       target.content = assistantText.replace(/(\s*\[\d+\]\s*,?)+/g, '').trim();
                       newMsgs[newMsgs.length - 1] = target;
                       return newMsgs;
                    });
                 }
              }
            } catch (e) {
              console.error('SSE JSON falhou', e, 'Dado Original:', jsonStr.substring(0, 100));
            }
          }
        }
        
        if (done) break;
      }

    } catch (err: any) {
      console.error(err);
      toast.error('Erro de conexão com o Consultor IA.');
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, enfrentei um erro ao buscar a resposta. Pode tentar novamente?'
      };
      setMessages(prev => [...prev, errMsg]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    const init: Message[] = [{
      id: 'welcome',
      role: 'assistant',
      content: 'Chat reiniciado. Como posso te ajudar agora?'
    }];
    setMessages(init);
    setAttachedFile(null);
    localStorage.removeItem('consultor-chat-history');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white overflow-hidden">
      
      {/* Subtitle Portal */}
      {portalTargets.subtitle && createPortal(
        "Tire dúvidas ou anexe documentos externos para validá-los contra os normativos IFRN.",
        portalTargets.subtitle
      )}

      {/* Header Actions Portal */}
      {portalTargets.actions && createPortal(
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearChat} 
          className="h-8 text-[12px] px-3 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Limpar Histórico
        </Button>,
        portalTargets.actions
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="w-full px-4 md:px-10 py-6 md:py-8 space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-4 sm:gap-6", msg.role === 'user' ? "ml-auto flex-row-reverse max-w-[85%]" : "w-full")}>
              
              {/* Avatar */}
              <div className={cn(
                "w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white",
                msg.role === 'user' ? "bg-slate-300" : "bg-primary"
              )}>
                {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
              </div>

              {/* Bubble Content */}
              <div className={cn("flex flex-col gap-2 relative top-1", msg.role === 'user' ? "items-end" : "flex-1 min-w-0")}>
                
                {/* File Attachment Badge */}
                {msg.attachedFile && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold w-fit">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{msg.attachedFile.name}</span>
                  </div>
                )}

                {/* Text Bubble */}
                {msg.content && (
                  <div className={cn(
                    "text-[12px] leading-relaxed",
                    msg.role === 'user' 
                      ? "px-5 py-3.5 bg-slate-100 text-slate-800 rounded-2xl rounded-tr-sm" 
                      : "px-5 py-4 bg-primary/5 border border-primary/10 text-slate-900 rounded-2xl rounded-tl-sm prose prose-sm prose-slate prose-p:text-[12px] prose-li:text-[12px] prose-p:leading-relaxed prose-a:text-primary prose-li:mb-3 prose-ul:my-3 prose-p:mb-2 max-w-none"
                  )}>
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 w-full">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Fontes Consultadas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                       {/* Grouping just like EditorDocumentos */}
                       {Object.entries(
                          msg.sources.reduce((acc: Record<string, any[]>, f: any) => {
                            if (!acc[f.titulo]) acc[f.titulo] = [];
                            if (!acc[f.titulo].find((item) => item.referencia === f.referencia)) {
                              acc[f.titulo].push(f);
                            }
                            return acc;
                          }, {})
                        ).map(([titulo, refs]: [string, any[]], i) => (
                          <div key={i} className="p-2.5 bg-slate-50 border rounded-lg max-w-sm">
                            <p className="text-[11px] font-bold text-slate-700">{titulo}</p>
                            <div className="mt-1 space-y-1">
                               {refs.slice(0, 2).map((r, j) => (
                                 <p key={j} className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-slate-300" /> {r.referencia}
                                 </p>
                               ))}
                               {refs.length > 2 && <p className="text-[10px] text-slate-400 italic">...e mais {refs.length - 2} trechos</p>}
                            </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 sm:gap-6 w-full transition-opacity duration-300">
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div className="relative top-1 px-6 py-4 rounded-2xl rounded-tl-sm bg-primary/5 border border-primary/10 flex items-center gap-3 text-[15px] text-primary font-semibold overflow-hidden min-w-[280px]">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> 
                <span className="animate-pulse" key={loadingTextIndex}>
                  {loadingTexts[loadingTextIndex]}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="w-full px-4 md:px-10 pb-4 md:pb-5 pt-3">
          
          {/* Active File Preview */}
          {attachedFile && (
            <div className="flex items-center justify-between p-3 mb-3 bg-white border border-blue-200 rounded-xl shadow-sm w-fit max-w-full">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="truncate shrink">
                  <p className="text-sm font-bold text-slate-700 truncate">{attachedFile.name}</p>
                  <p className="text-xs text-slate-400 truncate">PDF anexado para análise ({(attachedFile.file.size / 1024).toFixed(1)} KB)</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 ml-4 hover:bg-red-50 hover:text-red-600" onClick={() => setAttachedFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Context Filters Removed (Now running silently in the background via Heuristics during Upload) */}

          <div className="flex items-end gap-3 relative">
            
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
            />
            
            <Button 
              size="icon" 
              variant="outline" 
              className="h-12 w-12 shrink-0 bg-white border-slate-300 text-slate-500 hover:text-primary hover:border-primary disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !!attachedFile}
              title="Anexar arquivo PDF para análise"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <textarea
              className="flex-1 min-h-[48px] max-h-32 px-4 py-3 bg-white border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm text-[15px] placeholder:text-slate-400"
              placeholder={attachedFile ? "Faça uma pergunta ou peça para analisar o PDF anexado..." : "Tire uma dúvida com o Consultor Jurídico..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              style={{
                height: "auto",
              }}
            />

            <Button 
              size="icon" 
              className="h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 text-white shadow-md disabled:bg-primary/50"
              disabled={(!input.trim() && !attachedFile) || isLoading}
              onClick={handleSend}
            >
              <Send className="w-5 h-5 ml-1" />
            </Button>

          </div>
          
        </div>
      </div>
    </div>
  );
}
