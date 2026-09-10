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
4. **Tabela `licitacoes_pncp`**:
   - Pregões eletrônicos e compras públicas integrados com o PNCP, dados de UASG, modalidade, datas de propostas, homologação e link externo.
5. **View `atas_registro_precos_resumo`** (e tabelas filhas):
   - Atas de Registro de Preços consolidadas com itens, adesões, status de vigência e vínculo da unidade (gerenciadora, participante, carona/aderente).

### Mecanismos de Resiliência e UX:
- **Pull-to-Refresh**: Todas as telas contam com gesto de arrastar para baixo (`RefreshControl`) para forçar a sincronização instantânea.
- **Cache e Fallback Offline**: Em caso de perda de conectividade ou latência extrema, o app recupera o estado em cache ou dados demonstrativos prévios, garantindo que o usuário nunca fique diante de telas vazias ou travadas.

## Telas Implementadas

1. **Dashboard (Visão Geral - 01)**:
   - Identificação do campus: `IFRN / Campus Currais Novos`.
   - Card de Crédito Disponível com gradiente (`#10307e` a `#234fc8`), valor em tempo real e rosca de progresso empenhado/descentralizado.
   - Grid de indicadores de execução: Planejado, Descentralizado, Empenhado, Liquidado e Pago.
   - Restos a Pagar com saldo apurado em conformidade com o SIORG/SIAFI web.
   - Card de **Execução no Semestre**: Gráfico vetorial SVG dinâmico com barras pareadas escaladas proporcionalmente aos valores reais.
   - Card de alerta contratual dinâmico: indica a quantidade de contratos prestes a vencer e redireciona com 1 toque para a aba de Contratos com filtro ativo.

2. **Empenhos (Execução Orçamentária - 02)**:
   - Faixa de resumo com totais reais do exercício.
   - Busca em tempo real por número de NE, fornecedor ou texto da descrição.
   - Filtro por chips: `Todos`, `Exercício`, `Restos a pagar`.
   - Cards com código NE, barra de progresso da liquidação/pagamento, datas, ND e saldos.

3. **Contratos (Gestão Contratual - 03)**:
   - Faixa de resumo com valor global vigente.
   - Busca em tempo real por número de contrato ou empresa.
   - Filtro por chips: `Todos`, `Vigentes`, `A vencer`.
   - Cards com ícone categórico, valores, prazo restante e contadores.

4. **Licitações (Pregões e Atas - 04)**:
   - Seletor segmentado superior: `[ Pregões ]` e `[ Atas ]`.
   - **Pregões**: Resumo de valor homologado/estimado e propostas abertas, busca em tempo real, chips (`Todos`, `Propostas abertas`, `Encerradas`, `Somente SRP`) e cards com selo SRP, modalidade, status da proposta e botão de acesso direto ao PNCP.
   - **Atas**: Resumo de atas cadastradas e vigentes/a vencer, busca por número da ata, compra ou objeto, chips (`Todas`, `Vigentes`, `A vencer`, `Campus Currais Novos`) e cards com selo de vínculo (`Gerenciadora`, `Participante`, `Aderente`), dias restantes de vigência e total de itens/adesões.

5. **Navegação Inferior (Bottom Navigation)**:
   - 4 abas (`Visão Geral`, `Empenhos`, `Contratos`, `Licitações`) com ícones vetoriais SVG e tratamento de Safe Area Insets (iOS e Android).

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
