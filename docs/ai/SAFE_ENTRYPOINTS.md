# SAFE_ENTRYPOINTS

Este arquivo ajuda a entrar em cada modulo com o menor risco de erro.

## Se for mexer em Dashboard ou KPIs

Leia primeiro:

- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)
- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)
- [dataMetrics.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/dataMetrics.ts)
- [dimensionFilters.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/utils/dimensionFilters.ts)

## Se for mexer em importacao de Financeiro

Leia primeiro:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [financeiroImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/financeiroImportService.ts)
- [financeiroImportService.test.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/__tests__/financeiroImportService.test.ts)
- [FINANCEIRO.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/FINANCEIRO.md)

## Se for mexer em LC e comparacao com PDFs

Leia primeiro:

- [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- [lcImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcImportService.ts)
- [bolsistasPdfService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/bolsistasPdfService.ts)
- [lcComparisonService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcComparisonService.ts)
- [LC.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/LC.md)

## Se for mexer em PFs

Leia primeiro:

- [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)
- [PFImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/PFImportDialog.tsx)
- [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
- [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)
- [PFS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/PFS.md)

## Se for mexer em documentos habeis, liquidacoes, OBs ou retencoes

Leia primeiro:

- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)
- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
- [retencoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoes.ts)
- [DOCUMENTOS_HABEIS_E_LIQUIDACOES.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/DOCUMENTOS_HABEIS_E_LIQUIDACOES.md)

## Se for mexer em retencoes FD-Reinf

Leia primeiro:

- [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
- [retencoesEfdReinfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoesEfdReinfImportService.ts)
- [retencoesEfdReinfImportService.test.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/__tests__/retencoesEfdReinfImportService.test.ts)
- [RETENCOES_EFD_REINF.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/RETENCOES_EFD_REINF.md)

## Se for mexer em contratos e contratos API

Leia primeiro:

- [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)
- [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)

## Se for mexer em SUAP e analise de liquidacao

Leia primeiro:

- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)
- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)
- [analisar-liquidacao-siafi/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/analisar-liquidacao-siafi/index.ts)

## Pontos de cautela

- `vw_rastreabilidade_pf` e outras views precisam ser confirmadas no banco se nao estiverem nas migrations locais.
- `verificar-conformidade` e invocada pelo frontend, mas nao foi localizada em `supabase/functions` neste repo.
- `docs/llm/FULL_CONTEXT.md` nao deve ser tratado como fonte primaria para alteracoes.
