# Energia Campus

Este documento registra o contrato de importação do painel de gestão energética.

## Entrada

- Arquivo XLSX: `Levantamento de Consumo - COSERN.xlsx`
- Upload manual pela rota `/energia`, visível apenas para superadministrador.
- A importação inicial não usa Edge Function nem automação recorrente.

## Abas consumidas

- `Consumo`: faturas, subestação, período de leitura, consumo FP/NP/total, parcela, processo, competência e valores.
- `Consumo`, coluna L: quando preenchida no período do ambiente livre, alimenta Mercatto com o kWh da própria linha e o valor financeiro da coluna L.
- `Consumo`, tabelas laterais `Período - AAAA`: a coluna `Geração (kwh)` alimenta a geração solar mensal desde os anos disponíveis na planilha.
- `Previsão - Mercatto`: previsões/valores do Mercado Livre por subestação, competência, leitura, vencimento e orçamento; usada como apoio quando não há kWh real.
- `UFV's`: geração anual por UFV e observações operacionais.
- `Valor Executado`: parcelas do contrato COSERN com valor executado, previsto e percentual.
- Abas anuais como `2021`: geração mensal agregada das UFVs quando disponível.
- `82-2021 - COSERN`: mantida como aba auxiliar; a primeira versão usa as informações consolidadas de `Valor Executado`.

## Enriquecimento por contratos

- O painel também lê `contratos_api`, `contratos_api_faturas` e `contratos_api_empenho_liquidacoes_cache` para enriquecer Mercatto com contrato, faturas e liquidações já sincronizadas no módulo de contratos.
- Na Visão Geral, quando não houver kWh direto de Mercatto no período filtrado, faturas/liquidações do contrato podem gerar kWh estimado pela tarifa média conhecida para que o ambiente livre apareça nos KPIs e gráficos.
- O match usa fornecedor/CNPJ/objeto contendo Mercatto.

## Persistência

- `energia_import_runs`: trilha da carga importada.
- `energia_consumo_faturas`: faturas e previsões de consumo/valor de COSERN e Mercatto.
- `energia_solar_geracao`: geração anual por UFV e geração mensal das tabelas laterais/abas anuais.
- `energia_contratos`: contratos/fonte de energia derivados da base importada.
- `energia_contrato_execucoes`: execução por parcela quando disponível.

## Regras de cálculo

- Consumo faturado conhecido soma fontes com kWh real; na Visão Geral, Mercatto pode entrar como estimativa quando a única fonte disponível no período for fatura/liquidação do contrato.
- Mercatto usa kWh real quando a coluna L da aba `Consumo` estiver preenchida no período do ambiente livre; linhas de previsão sem kWh continuam com consumo `N/D`.
- Faturas e liquidações de Mercatto vindas de contratos API entram como contexto financeiro e, somente na Visão Geral, podem ser convertidas em kWh estimado usando tarifa média conhecida.
- Geração solar é tratada separadamente do consumo faturado e aparece como série própria nos gráficos da Visão Geral.
- Economia solar estimada usa `energia solar gerada x tarifa média das fontes com kWh conhecido`.
- Emissões evitadas usam `kWh solar / 1000 x 0,5989 tCO2e/MWh`.
- Árvores equivalentes usam `tCO2e / 0,147`.
- Carros equivalentes usam `tCO2e / 2,25`.

## Testes

- Parser: `src/services/__tests__/energiaCampusService.test.ts`
- Métricas: `src/utils/__tests__/energyMetrics.test.ts`
- UI: `src/pages/energia/__tests__/EnergiaCampus.test.tsx`
