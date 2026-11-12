# Mapeamento da aba Dedução do SIAFI

## Consulta reutilizável de códigos históricos

Execute `node scripts/siafi-sugestoes-deducoes.cjs 03126525000166` para consultar as cinco situações mapeadas pelo CNPJ. O resultado relaciona códigos e natureza à NP observada, distingue situações sem detalhe e apresenta contratos apenas como candidatos. É possível informar outro inventário JSON como segundo argumento. A consulta não preenche o SIAFI, não determina a tributação vigente e não interpreta ausência de histórico como isenção. Itens históricos de valor zero também aparecem para revisão.

## Primeiro preenchimento assistido — extensão 1.9.91

Na aba Dedução do SIAFI, com um item **DOB035 já aberto**, `Ctrl+K → Preencher dedução DOB035` abre o formulário local. O usuário informa processo completo, UG, datas, valor e fonte; opcionalmente cola o trecho do termo e usa **Ler valor do trecho**. O extrator aceita somente um valor explícito depois de `Valor calculado para recolhimento na conta vinculada nesta medição:`; não confunde o valor global da nota com o da conta vinculada e recusa valores divergentes. Não há cálculo automático por fornecedor ou preenchimento das demais situações.

Antes de escrever, o script confere o processo na observação da dedução, exige exatamente um item editável e valida se ele é DOB035, se a UG corresponde, se as datas são reais e se o valor é positivo. Campos não vazios diferentes impedem o preenchimento. O script escreve vencimento, pagamento e valor, dispara eventos e verifica os valores no DOM; se o SIAFI substituir algum elemento, interrompe. Uma falha após o início pode deixar campos parcialmente preenchidos para conferência. O comando não seleciona situação, não cria relacionamento ou pré-doc e não confirma nem registra o DH. A conferência do estado real do servidor SIAFI e das máscaras continua pendente; os testes locais não a substituem.

Caso piloto: processo SUAP `23035.003206.2026-37`, contrato `00222/2026`, LM Serviços Terceirizados. O Termo 246/2026 informa R$ 10.913,22 para conta vinculada e R$ 69.396,11 como valor da nota. O processo contém duas notas fiscais, 2714 e 2715. Nenhuma data de pagamento/vencimento foi inferida do termo. A NP 313 foi observada em alteração com DOB035 em branco. A fonte do valor, as datas, o relacionamento e o pré-doc precisam ser conferidos pelo usuário; nenhuma dedução foi gravada por esta implementação.

Na extração de `process-pdf`, o prompt passou a pedir evidência explícita antes de definir `optante_simples_nacional`, usar `null` quando desconhecido e distinguir valores monetários de alíquotas, preservando `null` para tributos conflitantes ou ambíguos. O modelo ainda entrega um resumo global sem página, base ou tributos por nota; isso não é suficiente para preencher automaticamente todas as situações. `process-pdf-worker`, `process-pdf` e `analisar-documento-licitacao` foram republicadas por compartilharem o módulo alterado.

Levantamento de 04/11/2026, UG 158366, SIAFI 2026. A fonte visual foi a consulta de documento hábil (CONDH), não a tela de inclusão ou alteração. Exemplos: `2026NP000308` (GRUPO RL, contrato citado 00129/2024) e `2026NP000307` (Instituto de Dignidade e Desenvolvimento Social, contrato citado 00153/2024). São registros concretos, não regras gerais. Uma leitura histórica não comprova a correção fiscal, a vigência ou o enquadramento atual. Não foi realizado preenchimento, registro ou treinamento.

## Campos por situação

| Situação | Nome observado | Campos observados no item | Pré-documento observado |
|---|---|---|---|
| DDF050 | Retenção previdenciária RGPS — DARF contábil | UG pagadora, vencimento, pagamento, código DARF, valor, acréscimos, recolhedores, relacionamento com principal | DARF: receita, recurso, período de apuração, processo, recolhedores e observação. Na NP 308 havia receita 1162. |
| DDF055 | Retenção de impostos e contribuições — EFD-Reinf R-4020 — DARF contábil | Mesmos campos da DDF050, mais natureza de rendimento | DARF: receita, recurso, período de apuração, processo, recolhedores e observação. Na NP 308 havia item positivo 6147/17003 e item de valor zero 6190/17099. |
| DOB001 | Retenção de ISS sobre serviços de terceiros | UG pagadora, vencimento, pagamento, valor, acréscimos e relacionamento com principal | No exemplo, OB Crédito com favorecido municipal, processo, taxa de câmbio, número da lista, CIT, domicílios bancários do favorecido e pagador e observação. |
| DOB035 | Retenção de depósitos sobre fornecedores — OB | UG pagadora, vencimento, pagamento, valor, acréscimos e relacionamento com principal | No exemplo, OB Judicial com favorecido, processo, taxa de câmbio, número da lista, CIT, domicílios bancários do favorecido e pagador e observação. O texto da observação identifica conta vinculada naquele caso. |
| DGR001 | Depósitos retidos sobre fornecedores | UG pagadora, vencimento, pagamento, código de recolhimento da GRU, valor, acréscimos e relacionamento com principal | Na NP 307 o botão de pré-documento estava desabilitado; não se conclui que seja sempre assim. GRU observada: 28802-0. |

Em DDF050 e DDF055, a tabela de recolhedores apresenta sequência, recolhedor, base de cálculo, valor da receita, multa e juros; no pré-DARF também mostra total recolhido. Pode existir mais de um recolhedor: a NP 302 apresenta dois, ambos diferentes da empresa credora. O relacionamento com Principal Com Orçamento informa situação, empenho, subelemento e valor. O SIAFI mostra itens repetidos com valor zero: guardar cada ocorrência, seu estado e seus relacionamentos; não classificá-los automaticamente como retenção aplicada.

Na NP 308, a base de R$ 44.744,24 foi exibida junto a DDF050 de R$ 3.965,88 e DDF055 de R$ 2.617,54. DOB001 de R$ 2.237,21 e DOB035 de R$ 5.890,05 também foram exibidas. A observação de valores não prova a base ou a alíquota jurídica de cada item; em especial, não derivar um percentual de INSS pela divisão direta sem verificar memória de cálculo, abatimentos e documentos. A DDF055 equivale numericamente a 5,85% da base exibida, sujeita a conferência de enquadramento e arredondamento.

## Estrutura HTML observada

Os arquivos `outputs/inventario-siafi-2026-10-29/estrutura-deducoes-308.json`, `estrutura-dgr001-307.json` e `estrutura-predoc-darf-308.json` registram uma projeção dos elementos observados, não o HTML integral nem um formulário editável. Não contêm valores de campos, cookies, ViewState ou URL de sessão. Alguns campos de texto selecionados no primeiro arquivo contêm somente códigos e rótulos de receita/natureza. O seletor do item abaixo usa `{i}` como índice variável:

```html
<div id="form_manterDocumentoHabil:listaDeducao:{i}:panelItemDeducao">
  <div id="form_manterDocumentoHabil:listaDeducao:{i}:panelCollapse">…</div>
  <input type="button" id="form_manterDocumentoHabil:listaDeducao:{i}:btnPredoc">
  <div id="form_manterDocumentoHabil:listaDeducao:{i}:campoInscricaoA_deducao">
    <label id="form_manterDocumentoHabil:listaDeducao:{i}:campoInscricaoA_deducao_rotulo">…</label>
    <span id="form_manterDocumentoHabil:listaDeducao:{i}:campoInscricaoA_deducao_output">…</span>
  </div>
  <div id="form_manterDocumentoHabil:listaDeducao:{i}:campoInscricaoB_deducao">…</div>
  <table id="form_manterDocumentoHabil:listaDeducao:{i}:deducao_tabela_recolhimentos">…</table>
  <table id="form_manterDocumentoHabil:listaDeducao:{i}:tableRelacionamentoPCO">…</table>
</div>
```

Este trecho é esquemático, reconstituído a partir dos IDs e tags observados; não garante hierarquia direta de todos os elementos. `campoInscricaoA_deducao` representa DARF nos exemplos DDF e GRU na DGR001 (neste caso, o span observado termina em `_output_gru`); `campoInscricaoB_deducao` representa a natureza na DDF055. O pré-documento aparece em `#modalPredoc`, com retorno por `form_manterDocumentoHabil:btnRetornarPredoc`. Datas na DGR001 aparecem em `dataVencimentoDeducao_outputText` e `dataPagamentoDeducao_outputText`. Na consulta, campos que parecem valores de saída são `span`; nomes, controles editáveis, máscaras, eventos e ordem de preenchimento devem ser identificados na tela de edição antes da implementação. Índices mudam conforme os itens; IDs gerados `j_id…` não são contratos estáveis. A atualização AJAX exige aguardar o estado visível e resolver novamente os seletores.

## Fontes de dados para o inventário por fornecedor

O arquivo `outputs/inventario-siafi-2026-10-29/inventario-fornecedores-deducoes.json` cruza os credores da listagem CONDH capturada em 29/10 com situações da tabela `retencoes_efd_reinf` do órgão IFRN Currais Novos e os 70 detalhes de NPs salvos. Foi consultada ao menos uma NP de cada um dos 69 identificadores de credor do recorte. A tabela importada tem dados acumulados de vários lotes, com repetições, identificadores de credor frequentemente ausentes e valores de retenção nulos ou zerados; seu uso é somente como indício de ocorrência da situação na NP, não como confirmação de alíquota ou deduplicação financeira. O vínculo do documento com o credor usa o número completo da NP e a UG da listagem capturada. Os códigos DARF/natureza e recolhedores vêm exclusivamente dos detalhes efetivamente consultados.

O inventário completo das naturezas ainda não foi concluído: a listagem anterior contém 308 NPs, mas somente 70 detalhes foram salvos, além da NP 1 examinada manualmente. A consulta SIAFI de 04/11 já tinha 32 páginas; a listagem de 29/10 não deve ser tratada como retrato atualizado. Uma primeira coleta leu a aba antes de concluir o AJAX e retornou itens vazios; as 14 NPs afetadas foram relidas e os dados corrigidos prevalecem no inventário consolidado. A ausência de situação ou de aba não prova isenção. Fornecedor, contrato, objeto, parcela, competência, situação, recolhedor, regime tributário e fonte documental devem ser preservados separadamente; um CNPJ ou código de receita isolado não determina uma alíquota universal.

O arquivo `outputs/inventario-siafi-2026-10-29/percentuais-observados.md` apresenta 35 linhas com base e receita de recolhedores observadas. O percentual é apenas a divisão entre esses dois valores, arredondada a quatro casas; não é prova de alíquota legal ou de aplicação ao contrato. Itens sem base explícita permanecem sem percentual.

## Pendências para agente e scripts

1. Conferir a tela de inclusão/edição para cada situação e capturar identificadores editáveis, validações, mensagens, dependências, atualização AJAX, escolha de situações, inclusão de recolhedores e pré-documentos, e restrições por estado; este inventário de consulta não comprova esses detalhes.
2. Conferir as demais NPs e vincular cada observação ao documento, ao item e, quando comprovado, ao contrato, com data e estado. Capturar pré-documentos representativos e casos de múltiplos recolhedores, ausência de dedução e itens zerados.
3. Tratar as alíquotas e suas bases como informações versionadas com origem e período; não aplicar automaticamente o histórico. Usar cálculo em centavos, conferir arredondamento, bases, somas e vínculos. Sem dados suficientes, produzir pendência para revisão.
4. Testar preenchimento inicialmente em ambiente/fixture autorizado e conferir a tela real antes de qualquer registro. Os comportamentos de confirmação e registro não foram mapeados neste levantamento.

O módulo de importação atual e as verificações locais de prazos estão em [RETENCOES_EFD_REINF](../data-import/RETENCOES_EFD_REINF.md); a captura estruturada por NP está em [SIAFI_EVIDENCE](SIAFI_EVIDENCE.md).
