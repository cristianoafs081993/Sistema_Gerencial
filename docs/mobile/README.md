# SIAGES Mobile (React Native + Expo)

Este documento descreve a arquitetura, estrutura, integração com o backend Supabase e instruções de execução do aplicativo mobile do SIAGES (IFRN · Campus Currais Novos).

## Objetivo

Fornecer aos gestores do IFRN acesso móvel ágil e em tempo real à execução orçamentária e à gestão contratual, conectado diretamente ao banco de dados Supabase da instituição.

## Conexão com o Backend (Dados Reais)

O app mobile conecta-se diretamente ao Supabase através da biblioteca `@supabase/supabase-js` em [`mobile/src/lib/supabase.ts`](file:///c:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/mobile/src/lib/supabase.ts).

### Dados Consumidos (Campus Currais Novos - UASG 158366):
1. **Tabela `empenhos`**:
   - Total de 370 registros reais do campus.
   - Agregação de valores: Empenhado (~R$ 4,14M), Liquidado (~R$ 1,29M), Pago (~R$ 1,20M) e A Pagar (~R$ 87K).
   - Evolução semestral para composição do gráfico de barras da execução.
2. **Tabela `contratos_api`**:
   - Contratos oficiais vinculados à UASG 158366.
   - Cálculo dinâmico de dias para o término de vigência e detecção de contratos com vigência a expirar nos próximos 30 dias.
3. **Tabela `descentralizacoes`**:
   - Créditos orçamentários descentralizados para o cálculo do saldo disponível em tempo real.
4. **Tabela `atividades`**:
   - Atividades orçamentárias planejadas do campus, isoladas por unidade gestora SUAP (`suap_unit_code`, ex: `19` para Currais Novos) e sincronizações ativas (`sync_active !== false`), garantindo convergência exata com o sistema web.
5. **Tabela `licitacoes_pncp`**:
   - Pregões eletrônicos e compras públicas integrados com o PNCP, dados de UASG, modalidade, datas de propostas, homologação e link externo.
6. **View `atas_registro_precos_resumo`** (e tabelas filhas):
   - Atas de Registro de Preços consolidadas com itens, adesões, status de vigência e vínculo da unidade (gerenciadora, participante, carona/aderente).
7. **Tabelas de Infraestrutura (`manutencao_ocorrencias`, `energia_consumo_faturas`, `energia_solar_geracao`)**:
   - Ocorrências e chamados de manutenção com ambientes, fotos, problemas e status.
   - Histórico de faturas de consumo elétrico (COSERN e Mercatto) e registros de geração das Usinas Fotovoltaicas (UFV).

### Mecanismos de Resiliência e UX:
- **Pull-to-Refresh**: Todas as telas contam com gesto de arrastar para baixo (`RefreshControl`) para forçar a sincronização instantânea.
- **Cache e Fallback Offline**: Em caso de perda de conectividade ou latência extrema, o app recupera o estado em cache ou dados demonstrativos prévios, garantindo que o usuário nunca fique diante de telas vazias ou travadas.

## Autenticação e acesso

O app exige login com as **mesmas contas do sistema web** (Supabase Auth, e-mail e senha). A sessão fica salva no aparelho (`AsyncStorage`) e é renovada automaticamente; o avatar no topo abre a conta com o botão **Sair**.

Depois do login o app aplica as mesmas regras de permissão do web (`mobile/src/services/access.ts`): grupos do usuário → telas permitidas → interseção com os módulos habilitados para o órgão. Cada aba do app depende de telas do web: Dashboard (`dashboard`), Empenhos (`empenhos`), Contratos (`contratos`), Licitações (`licitacoes-pregoes` ou `atas-registro-precos`) e Infra (`manutencao` ou telas de `energia`). Superadministradores veem todas as abas. Usuários **terceirizados** e usuários sem grupo veem a tela "Sem acesso ao app" (no web terceirizados só enxergam empenhos vinculados a eles, regra ainda não implementada no app).

Arquivos: `src/contexts/AuthContext.tsx` (estado da sessão), `src/screens/LoginScreen.tsx`, `src/screens/AccessStateScreen.tsx` e `src/components/AccountModal.tsx`. Testes: `src/test/mobile-access.test.ts`.

> **Pendência de segurança:** o app já lê como usuário autenticado, mas o banco ainda mantém políticas de leitura pública (`TO anon USING (true)`) em tabelas como `empenhos`, `contratos_api` e `descentralizacoes`. Enquanto elas existirem, quem tiver a chave anônima continua lendo esses dados sem login. Revogar essas políticas exige migration e deploy no banco remoto e deve ser feito depois de validar o login com usuários reais.

## Telas Implementadas

1. **Dashboard (Visão Geral - 01)**:
   - Saudação com o nome do usuário logado e filtro por **PTRES / origem de recurso** (recalcula todo o painel). A lista de PTRES vem dos dados reais (atividades, empenhos, descentralizações e crédito), com os principais primeiro.
   - Card **Planejado** (gradiente azul-céu): valor, atividades, % executado, barra de descentralização e os totais Descentralizado / A descentralizar.
   - **Velocímetros de execução** (essenciais ao painel, portados do web): Empenhado/Descentralizado e Liquidado/Descentralizado, escala vermelho → verde com ponteiro animado.
   - Indicadores (Empenhado, Crédito disponível oficial do SIAFI, Liquidado, Pago) com barra e % de referência, faixa "A pagar", **funil de execução** (Planejado → Pago) e **gráfico mensal** de empenhado e liquidado por mês do empenho (toque no mês para ver os valores exatos).
   - Os indicadores são clicáveis: Empenhado, Liquidado e Pago abrem Orçamento › Empenhos; Crédito disponível abre Orçamento › Crédito; Descentralizado (no card Planejado) abre Orçamento › Descentralizações (somente se o usuário tem permissão da seção).
   - Alerta de contratos que vencem em até 90 dias (mesma regra da aba Contratos); só aparece se houver contratos a vencer.
   - **Mesmos números do web**: o "descentralizado" é o saldo oficial da conta de descentralizações por PTRES (`descentralizacoes_conta_saldos`), a origem 230446 (PNAE) fica fora da soma global, e o empenhado/liquidado/pago seguem as colunas oficiais. Regras puras em `mobile/src/lib/dashboardRules.ts`; consultas em `mobile/src/services/dashboard.ts`.
   - Sem dados de demonstração: falha de rede mostra erro com "Tentar novamente"; recorte vazio mostra "Sem dados neste recorte"; carregamento usa esqueletos.

2. **Empenhos (Execução Orçamentária - 02)**:
   - Resumo separado: **empenhado do exercício** (com pago) e **saldo de restos a pagar**, nunca somados entre si.
   - Busca por número, fornecedor ou descrição; filtros por tipo (Todos, Exercício, Restos a pagar, com contagem) e por situação (A liquidar, A pagar, Pagos). Lista virtualizada (377 empenhos).
   - Cartão com NE, situação, fornecedor, descrição, valores e progresso do pagamento; **toque abre o detalhe** com execução financeira, descrição completa, natureza da despesa, plano interno, origem do recurso e processo.

   - A aba **Orçamento** tem um seletor interno com **Empenhos**, **Descentralizações** e **Crédito**; cada parte aparece conforme a permissão da tela correspondente no web (`empenhos`, `descentralizacoes`, `credito-disponivel`).
   - **Descentralizações**: total como no web (saldo oficial da conta por PTRES quando não há busca; soma dos lançamentos quando há busca ou a conta não foi importada), busca, filtro por PTRES, barras de valor por PTRES (toque para filtrar) e lista de lançamentos com data, dimensão, origem, nota de crédito, natureza da despesa, plano interno, descrição e valor (anulações em vermelho). A origem 230446 (PNAE) entra no total desta tela, mas fica fora da soma global do Dashboard, como no web.
   - **Crédito disponível**: último relatório importado do SIAFI (com data), total, busca, filtros de PTRES e de saldo (com saldo, zerados, todos), barras por PTRES e, ao tocar em uma linha, o detalhe com descentralizado, empenhado no exercício e as listas de empenhos e descentralizações do PTRES. Regras em `mobile/src/lib/orcamentoRules.ts`; consultas em `mobile/src/services/orcamento.ts`.

3. **Contratos (Gestão Contratual - 03)**:
   - Dados reais do Comprasnet (`contratos_api*`), com as mesmas regras do web: contratos no escopo do campus (`contratos_api_campus_scope`), situação e vigência derivadas no servidor, lista padrão com vigentes e expirados há até 120 dias, valor global pela soma dos termos do histórico, empenhos apenas da UG do campus e faturas pendentes (situação diferente de "Pago" e "SIAFI Apropriado"). Regras puras em `mobile/src/lib/contratosRules.ts`; consultas em `mobile/src/services/contratos.ts`.
   - Faixa de resumo (valor global e quantidade de contratos ativos), data da última sincronização, busca por número, empresa ou objeto e filtros: `Todos`, `Vigentes`, `A vencer` (até 90 dias) e `Faturas pendentes`, cada um com contagem. Ordem: a vencer (mais urgente), vigentes e expirados.
   - Cartão com fornecedor como título, objeto resumido, valor global, empenhado no campus, barra e texto de vigência e alerta de faturas pendentes.
   - **Detalhe do contrato** (toque no cartão): resumo financeiro (empenhado, a liquidar, liquidado, pago), vigência, objeto completo e abas de **Empenhos**, **Faturas**, **Itens** e **Termos** (aditivos).
   - Sem dados de demonstração: em caso de falha o app mostra o erro com "Tentar novamente", e sem contratos mostra o estado vazio. (Versões anteriores exibiam contratos fictícios, "empenhado" calculado como 70% do valor e "3 documentos" fixos; isso foi removido.)

4. **Licitações (Pregões e Atas - 04)**:
   - Seletor segmentado superior: `[ Pregões ]` e `[ Atas ]`.
   - **Pregões**: Resumo de valor homologado/estimado e propostas abertas, busca em tempo real, chips (`Todos`, `Propostas abertas`, `Encerradas`, `Somente SRP`) e cards com selo SRP, modalidade, status da proposta e botão de acesso direto ao PNCP.
   - **Atas**: Resumo de atas cadastradas e vigentes/a vencer, busca por número da ata, compra ou objeto, chips (`Todas`, `Vigentes`, `A vencer`, `Campus Currais Novos`) e cards com selo de vínculo (`Gerenciadora`, `Participante`, `Aderente`), dias restantes de vigência e total de itens/adesões.

5. **Infraestrutura (Manutenção, Portaria e Energia - 05)**:
   - Seletor segmentado superior com 3 abas: `[ Manutenção ]`, `[ Portaria ]` e `[ Energia ]`.
   - **Manutenção**: Cards de chamados/ocorrências com identificação de ambiente, bloco, badges de status (`Pendente`, `Em andamento`, `Resolvido`), chips com tags de problemas (vazamentos, elétrica, ar condicionado, limpeza), observações, fotos anexadas e avaliações. Chips de filtro por status e KPIs de pendências.
   - **Portaria**: Painel para o porteiro acompanhar os eventos diários do campus e controle de acesso. Exibe horário de início/término, local/sala, contato do organizador, alerta de instruções da portaria (estacionamento/cancelas) e contador de presença. Ao tocar no evento, abre a lista completa de participantes autorizados com busca instantânea por nome, documento ou placa de veículo, filtros por status e botão de check-in com 1 toque.
   - **Energia**: Painel de faturas e geração solar fotovoltaica. Cards de consumo faturado em kWh e valores em R$ discriminados por fornecedor (`COSERN`, `Mercatto`), e acompanhamento de geração das UFVs. Chips de filtro por fonte e KPIs de consumo e valor total.

6. **Navegação Inferior (Bottom Navigation)**:
   - 5 abas (`Dashboard`, `Orçamento`, `Contratos`, `Licitações`, `Infra`) com ícones vetoriais SVG e tratamento de Safe Area Insets (iOS e Android).

## Como Executar

### No Celular (Expo Go)
```bash
npm run mobile:start
# ou
cd mobile && npx expo start -c
```
Escaneie o QR Code no app **Expo Go** (Android ou iOS).

### No Navegador Web
```bash
npm run mobile:web
```

### Requisitos

- **Node.js >= 20.19.4** (exigido pelo Expo SDK 57). Com Node 20.18 o app ainda sobe, mas o Expo CLI avisa que a versão é não suportada; atualize o Node antes de gerar builds.
- Na primeira vez, rode `npm --prefix mobile install`.

## Design system

**Fonte:** o app usa a Manrope (a mesma do web), carregada em `App.tsx` com `expo-font` (`@expo-google-fonts/manrope`, pesos 400–800). Como o React Native não escolhe a variação pelo `fontWeight` em fontes customizadas, todas as telas usam `Text`/`TextInput` de `mobile/src/components/AppText.tsx`, que converte o peso do estilo na família correspondente; nunca importe `Text`/`TextInput` direto de `react-native`. Se a fonte falhar ao carregar, o app segue com a fonte do sistema.

**Logo:** o app usa a logo oficial do SIAGES (`mobile/assets/logo.png`, o mesmo arquivo do web, `public/logo-transparent.png`) no topo, no login e nas telas de estado, e também como ícone, ícone adaptativo do Android e tela de abertura (fundo branco). Os arquivos de ícone têm 512 px; para publicar nas lojas o ideal é uma versão de 1024 px.

O app usa os tokens do design system Céu do web (azul-céu `#1976D2`/`#1E88E5`, ciano `#00B7DC`, superfícies `#F6F9FD`), definidos em [`mobile/src/constants/theme.ts`](../../mobile/src/constants/theme.ts). Ao mudar o visual do web, atualize o tema do mobile no mesmo trabalho.
