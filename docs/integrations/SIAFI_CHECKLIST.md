# Conferência da liquidação: processo × SIAFI

Implementação da extensão **1.9.71** e checklist **2.0.0**, catálogo **2026-10-13.1**. A conferência cobre fornecedores PJ e bolsas/auxílios de estudantes. Pode ocorrer antes de registrar o DH e não exige NS. Nenhuma ação registra, confirma, salva ou modifica o SIAFI.

## Operação

1. No DH, Ctrl+K → `print` → Enter. A captura local gera o PDF e JSON originais sem depender da conta SIAGES.
2. Na janela temporária, **Conferir com IA** consulta a conta autenticada no popup da extensão. O servidor identifica o processo pelo número dos Dados Básicos e pelo proprietário autenticado.
3. Notas referenciadas são selecionadas automaticamente; cópias idênticas não formam notas novas. Quando o tipo, as notas ou a lista forem ambíguos, selecionar o escopo. Pagamento parcial exige identificar a parcela/glosa. Competência usa `AAAA-MM`.
4. A análise retorna identificador e roda em segundo plano. Fechar a janela não cancela o job. **Retomar análise** recupera falhas; até três tentativas, com lease exclusivo de oito minutos. Job concluído não é reexecutado nem alterado.
5. Divergências aparecem primeiro, por impacto, seguidas de não verificáveis. **Mostrar todos** inclui conformes e não aplicáveis. Cada item mostra esperado, encontrado, diferença, evidências, memória e ação.
6. **Conferido** e feedback ficam separados do parecer. Falso positivo exige motivo. Após corrigir o SIAFI, gerar nova captura. Identidades estáveis permitem marcar resolvido/persistente/novo; desaparecimento do item fica pendente. DH sem número só é comparado automaticamente se o escopo identificar notas ou competência.

Em `/suap`, os detalhes de qualquer processo exibem histórico das últimas 50 análises, revisão, documentos na página citada e download estruturado. Também aceitam o JSON da captura pelo botão contextual **Conferir JSON do SIAFI**. O link da extensão abre `/suap?processo=<uuid>` com consulta autorizada, mesmo fora da caixa ativa.

## Fontes e limitações

- Processo e documentos são lidos no servidor com JWT do usuário/RLS; resumos enviados pelo cliente não definem o esperado. `val_nf`/`valor_nf` significam bruto; líquido só existe quando identificado separadamente.
- PDFs individuais incluídos/baixados têm preferência; sem inventário, usa-se o PDF original completo. Relatórios de análise e comprovantes SIAFI identificáveis pelo título ficam fora da referência esperada. PDFs usados são preservados em `suap-pdfs/<usuário>/siafi-analises/<run>/<fonte>.pdf`, com SHA-256 e paginação original. Retentativa reutiliza essa cópia.
- Citações são verificadas no campo do JSON, registro da lista, página textual do PDF ou trecho oficial consultado. PDF digitalizado sem texto pesquisável tem citação visual indicada, mas não produz conformidade/divergência definitiva: precisa de revisão/OCR. O parser desativa avaliação de scripts e não renderiza canvas.
- Listas de trabalho `lc_saved_lists` representam contas escolhidas; não provam autorização nem conteúdo efetivo da LC/LX. `lc_credores` é consultado pelo número exato capturado e não contém valor individual. Ausência de valor/lista vira pendência; nunca assumir R$300 ou zero. Cada estudante da lista exige itens individuais B02/B03/B05.
- Catálogo completo de 32 regras: C01–C08 (identidade, notas, bruto/líquido, empenho, datas, duplicidade); P01–P06 (pré-docs, campos, contas, valores e recolhimento); F01–F10 (PJ, ateste e tributos); B01–B08 (programa, estudantes, valores, contas, histórico, elegibilidade e fundamento).
- Tabela DCF/UFMG de janeiro/2024 e orientação COAD fornecidas são **históricas**. Mapeamentos permanecem no catálogo para contextualização, sem ativar alíquotas ou validar natureza atual. Fontes oficiais consultadas: IN RFB 1.234 compilada, FAQ EFD-Reinf e Lei 9.250 art. 26. Trechos consultados, hashes e data ficam no resultado; falta de dispositivo/vigência/enquadramento gera pendência. Não generalizar INSS, dispensa do Simples, isenção de bolsas, município do ISS nem datas de R-2010/R-4020.
- Limites: JSON 6 MB, PDFs selecionados 40 MB, extração textual até 500 páginas por PDF/100 mil caracteres por página. Conteúdo fora do texto verificado não comprova citação. Se a resposta exceder tokens/prazo, restringir documentos/competência e retomar.
- IA omissa/incompleta não aprova regra: backend completa a cobertura. Soma exige parcelas com identidade econômica única; duplicação de dedução no pré-doc fica pendente. Moeda e percentuais são recalculados com inteiros/BigInt, com arredondamento em centavos.
- Resultado preserva também `respostaModelo` para diagnóstico, separada do checklist validado. Citações do cálculo podem herdar as evidências já verificadas do item; valores esperados em igualdade e totais de estudantes exigem origem no PDF. Ausência de dados não dispensa regras obrigatórias.
- Ambiguidades descobertas na leitura dos PDFs são retornadas no checklist; **Completar seleção** permite informar competência/parcela e produzir nova análise preservando a anterior.

## Contrato e persistência

`analisar-liquidacao-siafi` valida JWT via Auth. Ações: `prepare` (captura/seleção), `start` (captura + processo + escopo), `status`/`retry` (runId), `review` (runId/itemId/conferido/feedback/motivo). `prepare` retorna seleção autorizada; `start` devolve runId ou seleção pendente. Falha após enfileiramento mantém o run para recuperação.

Entrada original `schemaVersion:1.0.0` e `analysis:not_requested` permanecem inalteradas. Saída acrescenta `checklist`, contadores, ambiguidades, versões, fontes e histórico; conserva `statusGeral/resumo/itens` de compatibilidade. Análise legada por até seis imagens continua disponível, agora usando processo autorizado no servidor.

`siafi_liquidacao_analises`: entrada imutável, hash, captureId, processo/tenant, status/progresso/lease/tentativas e resultado imutável após conclusão. Apenas service role escreve jobs/resultados; usuário lê somente seu processo.

`siafi_liquidacao_revisoes`: eventos append-only com item existente, conferido e feedback/motivo; usuário lê/insere apenas em sua análise concluída. Não há update/delete pelo frontend. Timestamp é definido no banco. Feedback não treina modelo nem muda regras automaticamente; fornece casos para revisão/versionamento e regressões anonimizadas.

Worker interno `analisar-liquidacao-siafi-worker`: aceita somente chave service role, claim atômico, preserva PDFs, consulta referências, chama Gemini configurado e valida checklist. Não lê sessão SUAP, não precisa cookie SIAFI nem novas permissões da extensão. Não incluir instruções dos documentos no prompt como comandos.

## Implantação e validação

Aplicar migration `20261013140000_siafi_liquidacao_checklist.sql` e verificar `supabase migration list`. Publicar primeiro `analisar-liquidacao-siafi-worker`, depois `analisar-liquidacao-siafi`. Ambas têm `verify_jwt=false` com autenticação no handler. Mantêm GEMINI_API_KEY/GOOGLE_GENERATIVE_AI_API_KEY/GOOGLE_API_KEY e GEMINI_LIQUIDACAO_MODEL/GEMINI_VISION_MODEL existentes.

Regressões: `siafiChecklist.test.ts`, `SiafiChecklist.test.tsx`, `siafiAnalysisExtension.test.ts`, coletor/paleta/pacote/encoding; Deno `siafi_analysis_backend_test.ts` e `siafi_pdf_text_test.ts`; SQL descartável `node scripts/test-siafi-checklist-db.mjs` (PGlite do runtime indicado por SIAFI_SQL_RUNTIME).

Homologação operacional: conferir casos conhecidos de PJ e estudantes, PDFs legíveis, captura parcial, LC/LX, retenções e múltiplas competências; registrar falsos positivos. A execução de fixtures sintéticas não substitui a homologação dos processos reais ou a validação fiscal do enquadramento.

Teste remoto explícito: `SIAFI_REMOTE_TEST=1` com `scripts/test-siafi-checklist-remote.ts` (Deno). Usa credenciais CLI em memória, cria fixtures descartáveis sem enviar e-mail e remove usuário/processo/análises/revisões/PDFs em finally. Cobre acesso sem JWT, diferença de R$5,50, nova captura corrigida/resolvida, revisão sem alterar parecer, dois estudantes com valores distintos e soma, e valor individual ausente pendente. Relatório local somente com dados fictícios em `tmp/siafi-checklist-remoto.json`.

Publicação em 13/10/2026: migration aplicada/histórico alinhado e os dois handlers publicados no Supabase vinculado. Interface publicada em `https://www.siages.com.br/suap`, deployment Vercel `dpl_9cZCvidJx8EpKg2PBy612Gp5xre2`, a partir de cópia isolada de `ec363e0` com os arquivos deste fluxo; mudanças locais de outros trabalhos não foram incluídas. HTTP 200 e presença de checklist/revisões no bundle público conferidos. ZIP 1.9.71 com 38 arquivos conferidos por SHA-256.

Validação: 99 testes focados aprovados, mais duas regressões finais de flags booleanas/prioridade dos Dados Básicos; seis testes Deno e SQL/RLS descartável aprovados; quatro cenários remotos Gemini aprovados e fixtures removidas. Build local e de produção concluídos. Suíte geral: 1.479 aprovados e duas falhas (`suapProcessDocumentExtension.test.ts`/`ManutencaoAdmin.test.tsx`), reproduzidas também em `ec363e0` sem estas mudanças. Lint dos arquivos novos aprovados; lint global mantém erro anterior `nfeChave.ts:57`. A configuração TypeScript global mantém erros anteriores fora do fluxo; `Suap.tsx` também passou a invocar getAll por callback, evitando passar QueryFunctionContext como SupabaseClient.
