# Board de Implementacao - Modulo Inteligente de Busca de Atas

## Objetivo

Traduzir o PRD do modulo de busca de atas em um backlog executavel, considerando o estado real deste repositorio:

- frontend React + Vite ja existente;
- Supabase ja configurado e com historico de migrations;
- sistema atual focado em rotinas administrativas;
- novo modulo entrando como expansao do produto, e nao como projeto greenfield.

## Premissas de implementacao

- O modulo sera incorporado ao app atual como novas rotas/paginas.
- O Supabase sera a base principal para persistencia e busca textual inicial.
- O MVP nao depende de embeddings nem de um backend separado para entregar valor.
- Ingestao pode comecar via scripts/jobs internos do repositorio.
- A camada conversacional do MVP sera estruturada e controlada por regras do sistema.

## Colunas sugeridas

- `Backlog`
- `Sprint 1 - Fundacao`
- `Sprint 2 - Dados`
- `Sprint 3 - Busca`
- `Sprint 4 - API`
- `Sprint 5 - Frontend`
- `Sprint 6 - Conversa`
- `Sprint 7 - Hardening`
- `Pronto`

## Legenda

- `Epic`: agrupador funcional
- `Deps`: tickets predecessores
- `DoD`: definicao de pronto

---

## Backlog Mestre

### Sprint 1 - Fundacao

#### ATA-001 - Criar espaco do modulo no app atual
- Epic: Fundacao
- Objetivo: preparar o app para receber o novo dominio sem misturar com os modulos atuais.
- Tarefas:
- criar pasta de paginas do modulo de atas;
- criar pasta de services/repositorios do modulo;
- criar tipos dedicados para ata, item e sessao;
- reservar novas rotas no roteador principal.
- Deps: nenhuma
- DoD: estrutura criada e rotas placeholder acessiveis sem quebrar o app atual

#### ATA-002 - Definir contrato de configuracao do modulo
- Epic: Fundacao
- Objetivo: padronizar envs, chaves e toggles do modulo.
- Tarefas:
- mapear variaveis necessarias para Supabase e ingestao;
- criar convencao para feature flag do modulo;
- documentar variaveis em `.env.example`.
- Deps: nenhuma
- DoD: configuracao minima documentada e carregando sem valores hardcoded novos

#### ATA-003 - Planejar schema inicial do banco
- Epic: Fundacao
- Objetivo: fechar o recorte de tabelas do MVP antes das migrations.
- Tarefas:
- validar entidades `atas`, `itens_ata`, `documentos_ata`, `sessoes_busca`, `resultados_busca`, `eventos_uso`;
- definir enums de `modulo_busca`, `tipo_item`, `status_vigencia`;
- definir indices textuais e relacionamentos.
- Deps: nenhuma
- DoD: modelo relacional revisado e pronto para virar migration

#### ATA-004 - Criar migrations iniciais do modulo de atas
- Epic: Fundacao
- Objetivo: materializar o schema do MVP no Supabase.
- Tarefas:
- criar tabelas e foreign keys;
- criar indices para busca textual e joins;
- registrar campos de vigencia e campos normalizados.
- Deps: ATA-003
- DoD: migration aplica com sucesso em ambiente local

### Sprint 2 - Dados

#### ATA-005 - Criar tabela de controle de ingestao
- Epic: Ingestao
- Objetivo: rastrear execucoes, falhas e ultima sincronizacao.
- Tarefas:
- criar registro de job;
- salvar status, inicio, fim e mensagem de erro;
- prever execucao manual e incremental.
- Deps: ATA-004
- DoD: cada execucao futura de ingestao pode ser auditada

#### ATA-006 - Implementar cliente da fonte de atas
- Epic: Ingestao
- Objetivo: buscar dados brutos da fonte oficial escolhida.
- Tarefas:
- encapsular autenticacao, pagina e retries;
- normalizar retorno bruto minimo;
- tratar rate limit e falhas.
- Deps: ATA-005
- DoD: cliente retorna lotes de atas com tratamento de erro previsivel

#### ATA-007 - Persistir atas com upsert
- Epic: Ingestao
- Objetivo: gravar metadados das atas na base local.
- Tarefas:
- mapear numero, objeto, orgao, datas e payload bruto;
- calcular status inicial de vigencia;
- evitar duplicidade por chave natural.
- Deps: ATA-006
- DoD: lotes de atas entram na base sem duplicacao indevida

#### ATA-008 - Ingerir e vincular itens da ata
- Epic: Ingestao
- Objetivo: garantir granularidade por item para ranking e exibicao.
- Tarefas:
- extrair item, descricao, unidade, quantidade e catalogo;
- vincular com `ata_id`;
- tratar atas sem itens estruturados.
- Deps: ATA-007
- DoD: atas ingeridas possuem itens associados quando a fonte fornecer dados

#### ATA-009 - Criar comando manual de ingestao
- Epic: Ingestao
- Objetivo: permitir execucao controlada no inicio do projeto.
- Tarefas:
- criar script NPM/Bun para rodar ingestao;
- escrever logs de execucao;
- falhar com mensagem clara.
- Deps: ATA-006, ATA-007, ATA-008
- DoD: equipe consegue carregar dados localmente com um comando documentado

### Sprint 3 - Busca

#### ATA-010 - Normalizar texto de atas e itens
- Epic: Busca Base
- Objetivo: melhorar recuperacao textual sem IA pesada.
- Tarefas:
- criar versoes normalizadas de objeto e descricao;
- remover ruido comum;
- padronizar caixa, acentos e espacos.
- Deps: ATA-008
- DoD: registros passam a ter campos consistentes para busca textual

#### ATA-011 - Classificar material versus servico
- Epic: Busca Base
- Objetivo: habilitar comportamento distinto por modulo.
- Tarefas:
- usar dado da fonte quando existir;
- criar heuristica de fallback;
- armazenar classificacao final.
- Deps: ATA-008
- DoD: itens novos possuem `tipo_item` definido ou marcado como ambiguidade

#### ATA-012 - Implementar busca do modulo de adesao
- Epic: Busca Base
- Objetivo: ranquear atas com foco em triagem para possivel adesao.
- Tarefas:
- buscar por objeto da ata e itens aderentes;
- considerar vigencia como criterio relevante;
- agrupar resultado na unidade ata;
- limitar em 5 resultados.
- Deps: ATA-010, ATA-011
- DoD: consulta retorna ranking posicional com foco em ata

#### ATA-013 - Implementar busca do modulo de pesquisa de precos
- Epic: Busca Base
- Objetivo: ranquear itens utilitarios agrupados por ata.
- Tarefas:
- priorizar match em item;
- considerar material/servico;
- usar CATMAT/CATSER quando houver;
- limitar em 5 resultados.
- Deps: ATA-010, ATA-011
- DoD: consulta retorna ranking posicional com foco em item agrupado por ata

#### ATA-014 - Gerar justificativas curtas e nao conclusivas
- Epic: Busca Base
- Objetivo: explicar por que o resultado apareceu, sem recomendar uso.
- Tarefas:
- definir templates curtos;
- mencionar match de objeto, item, vigencia ou catalogo;
- bloquear termos conclusivos.
- Deps: ATA-012, ATA-013
- DoD: toda resposta de busca traz justificativa curta compatível com o PRD

### Sprint 4 - API

#### ATA-015 - Criar camada de repositorio/servico para atas
- Epic: API
- Objetivo: separar acesso a dados da logica de busca.
- Tarefas:
- encapsular queries do Supabase;
- criar servicos de detalhe da ata;
- preparar camada reutilizavel pelos dois modulos.
- Deps: ATA-012, ATA-013
- DoD: regras de acesso a dados do modulo nao ficam espalhadas em paginas React

#### ATA-016 - Expor endpoint/servico de busca para adesao
- Epic: API
- Objetivo: padronizar entrada e saida do modulo.
- Tarefas:
- definir payload de consulta;
- devolver entendimento, resultados, justificativas e proximo passo;
- validar autenticacao se aplicavel.
- Deps: ATA-015
- DoD: contrato estavel para o frontend consumir

#### ATA-017 - Expor endpoint/servico de busca para pesquisa de precos
- Epic: API
- Objetivo: entregar contrato proprio para o segundo modulo.
- Tarefas:
- ajustar resposta orientada a item;
- manter agrupamento por ata;
- expor tipo e catalogo quando disponiveis.
- Deps: ATA-015
- DoD: contrato estavel e aderente ao PRD do modulo de pesquisa

#### ATA-018 - Expor detalhe da ata e de seus itens
- Epic: API
- Objetivo: permitir aprofundamento analitico apos a triagem.
- Tarefas:
- buscar metadados da ata;
- listar itens vinculados;
- destacar itens aderentes a ultima busca, quando houver.
- Deps: ATA-015
- DoD: detalhe completo disponivel para UI

### Sprint 5 - Frontend

#### ATA-019 - Criar navegacao do modulo no layout atual
- Epic: Frontend
- Objetivo: inserir o novo dominio sem quebrar a navegacao existente.
- Tarefas:
- adicionar entradas no menu lateral;
- definir nomes finais das rotas;
- manter consistencia visual do sistema atual.
- Deps: ATA-001
- DoD: usuario consegue acessar os dois modulos pelo menu principal

#### ATA-020 - Construir pagina Buscar atas para adesao
- Epic: Frontend
- Objetivo: entregar experiencia centrada em ata.
- Tarefas:
- criar input conversacional;
- exibir entendimento curto;
- listar 5 resultados;
- destacar vigencia e itens aderentes.
- Deps: ATA-016, ATA-019
- DoD: fluxo de consulta de adesao funcional de ponta a ponta

#### ATA-021 - Construir pagina Buscar atas para pesquisa de precos
- Epic: Frontend
- Objetivo: entregar experiencia centrada em item da ata.
- Tarefas:
- criar input conversacional;
- listar 5 resultados agrupados por ata;
- destacar material/servico e CATMAT/CATSER;
- exibir justificativas curtas.
- Deps: ATA-017, ATA-019
- DoD: fluxo de consulta de pesquisa de precos funcional de ponta a ponta

#### ATA-022 - Construir painel de detalhe da ata
- Epic: Frontend
- Objetivo: permitir analise aprofundada sem sair do fluxo.
- Tarefas:
- abrir drawer ou dialog;
- mostrar orgao, objeto, vigencia e itens;
- permitir voltar ao ranking facilmente.
- Deps: ATA-018, ATA-020, ATA-021
- DoD: detalhe acessivel a partir dos dois modulos

### Sprint 6 - Conversa

#### ATA-023 - Interpretar demanda em linguagem natural
- Epic: Conversa
- Objetivo: transformar texto livre em consulta interna estruturada.
- Tarefas:
- extrair termos principais;
- inferir material/servico quando possivel;
- preservar pergunta original para historico.
- Deps: ATA-012, ATA-013
- DoD: entrada livre e convertida em parametros de busca rastreaveis

#### ATA-024 - Formatar resposta conversacional estruturada
- Epic: Conversa
- Objetivo: manter previsibilidade do output sem virar chatbot aberto.
- Tarefas:
- montar bloco de entendimento;
- montar resultados no formato do modulo;
- sugerir proximo passo objetivo.
- Deps: ATA-014, ATA-023
- DoD: resposta final segue o padrao do PRD em ambos os modulos

#### ATA-025 - Salvar sessao e refinamentos de busca
- Epic: Conversa
- Objetivo: permitir refinamento sem reiniciar o processo.
- Tarefas:
- persistir consulta original;
- registrar consultas derivadas;
- manter modulo e timestamp.
- Deps: ATA-016, ATA-017, ATA-023
- DoD: usuario pode refinar mantendo contexto minimo

### Sprint 7 - Hardening

#### ATA-026 - Registrar eventos de uso
- Epic: Observabilidade
- Objetivo: preparar melhoria continua e metricas de adesao do produto.
- Tarefas:
- registrar busca;
- registrar abertura de detalhe;
- registrar refinamento;
- registrar modulo acessado.
- Deps: ATA-020, ATA-021, ATA-022
- DoD: eventos principais do MVP ficam auditaveis

#### ATA-027 - Revisar copy para linguagem nao conclusiva
- Epic: Hardening
- Objetivo: alinhar interface e resultados as regras interpretativas do PRD.
- Tarefas:
- revisar cards, vazios, erros e detalhes;
- remover termos como "apta", "recomendada" ou equivalentes;
- padronizar mensagens dos dois modulos.
- Deps: ATA-020, ATA-021, ATA-022, ATA-024
- DoD: linguagem de apoio, curta e nao decisoria em toda a experiencia

#### ATA-028 - Cobrir fluxo essencial com testes
- Epic: Qualidade
- Objetivo: reduzir regressao no modulo novo.
- Tarefas:
- testar ranking basico;
- testar contrato de resposta;
- testar renderizacao das paginas principais;
- testar abertura do detalhe.
- Deps: ATA-020, ATA-021, ATA-022, ATA-024
- DoD: suite minima cobre caminho feliz e casos vazios

#### ATA-029 - Validar com cenarios reais do IFRN
- Epic: Validacao
- Objetivo: checar utilidade pratica antes de ampliar escopo.
- Tarefas:
- testar material permanente;
- testar servicos especializados;
- testar atas com dados incompletos;
- revisar qualidade das justificativas.
- Deps: ATA-027, ATA-028
- DoD: feedback inicial coletado e principais ajustes registrados

---

## Dependencias criticas

- ATA-003 antes de ATA-004
- ATA-004 antes do bloco de ingestao
- ATA-008 antes da busca real
- ATA-012 e ATA-013 antes da API publica
- ATA-016 e ATA-017 antes das paginas finais
- ATA-024 antes da revisao final de linguagem

## Corte recomendado para MVP 1

Se precisar entregar um recorte menor e utilizavel, priorizar:

- ATA-001 a ATA-018
- ATA-019 a ATA-022
- ATA-027

Pode ficar para a iteracao seguinte:

- ATA-025
- ATA-026
- ATA-028
- ATA-029

## Ordem pratica de execucao

1. Fundacao do modulo e schema
2. Ingestao manual de atas e itens
3. Busca base dos dois modulos
4. Contratos/API
5. Telas e detalhe da ata
6. Conversa estruturada
7. Observabilidade, testes e validacao

## Proximo passo recomendado

Transformar os tickets acima em cards reais com estimativa e responsavel. Se for usar Notion, Jira ou Trello, a recomendacao e manter:

- titulo no formato `ATA-XXX - Nome do ticket`
- campo `Epic`
- campo `Sprint`
- campo `Deps`
- checklist das tarefas internas
- campo `DoD`

Assim o board fica fiel ao PRD e ao estado atual deste repositorio.
