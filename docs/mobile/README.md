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

### Mecanismos de Resiliência e UX:
- **Pull-to-Refresh**: Todas as telas contam com gesto de arrastar para baixo (`RefreshControl`) para forçar a sincronização instantânea.
- **Cache e Fallback Offline**: Em caso de perda de conectividade ou latência extrema, o app recupera o estado em cache ou dados demonstrativos prévios, garantindo que o usuário nunca fique diante de telas vazias ou travadas.

## Telas Implementadas

1. **Dashboard (Visão Geral - 01)**:
   - Identificação do campus: `IFRN / Campus Currais Novos`.
   - Card de Saldo Disponível com gradiente (`#10307e` a `#234fc8`), valor em tempo real e rosca de progresso empenhado/descentralizado.
   - Grid de indicadores de execução: Empenhado, Liquidado, Pago e A pagar.
   - Card de **Execução no Semestre**: Gráfico vetorial SVG dinâmico com barras pareadas escaladas proporcionalmente aos valores reais.
   - Card de alerta contratual dinâmico: indica a quantidade de contratos prestes a vencer e redireciona com 1 toque para a aba de Contratos com filtro ativo.

2. **Empenhos (Execução Orçamentária - 02)**:
   - Faixa de resumo com totais reais do exercício.
   - Busca em tempo real por número de NE, fornecedor ou texto da descrição.
   - Filtro por chips: `Todos`, `A liquidar`, `A pagar`, `Pagos`.
   - Cards com código NE, barra de progresso da liquidação/pagamento, datas e ND.

3. **Contratos (Gestão Contratual - 03)**:
   - Faixa de resumo com valor global vigente.
   - Busca em tempo real por número de contrato ou empresa.
   - Filtro por chips: `Todos`, `Vigentes`, `A vencer`.
   - Cards com ícone categórico, valores, prazo restante e contadores.

4. **Navegação Inferior (Bottom Navigation)**:
   - Abas com ícones vetoriais SVG e tratamento de Safe Area Insets (iOS e Android).

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
