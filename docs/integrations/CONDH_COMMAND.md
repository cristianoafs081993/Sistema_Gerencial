# Busca de RP/NP pela paleta de comandos

O comando `condh` consulta documentos hábeis de origem RP ou NP. Ele está disponível na paleta nativa do SIAGES e na paleta global da extensão Suape em páginas compatíveis fora do SIAGES. No Comprasnet, use a paleta global da extensão; a paleta especializada de ETP continua funcionando separadamente.

## Consultas aceitas

- `condh 07.805.649/0001-29` ou `condh 07805649000129`: busca pelo CPF/CNPJ do favorecido, com ou sem pontuação. São aceitos 11 ou 14 dígitos, sem validação dos dígitos verificadores.
- `condh 2026NP000085` ou `condh 2026RP000085`: busca pelo número da RP/NP. A pesquisa também encontra o identificador completo quando ele contém um prefixo antes do número do documento.
- `condh 82`: busca pelo sufixo numérico; neste exemplo, retorna RP e NP terminadas em `82`, como `2026NP000082` e `2026RP000082`. Entradas numéricas com 11 ou 14 dígitos são interpretadas como CPF/CNPJ, não como sufixo.

## Comportamento

- Os documentos encontrados aparecem resumidos na própria paleta: número RP/NP, situação, favorecido, data de emissão, valor e, quando disponível, número do empenho.
- A seleção de um resultado abre o detalhamento na extensão, com valores, favorecido, dados do empenho/processo, situações financeiras e documentos relacionados. No SIAGES, a paleta nativa usa o diálogo existente da tela Liquidações e Pagamentos.
- A listagem inclui diferentes situações e é ordenada da emissão mais recente para a mais antiga. Resultados são paginados em 20 itens; use `Anterior` e `Próxima` para percorrer todas as páginas.
- A busca por favorecido considera RP/NP associados ao CPF/CNPJ, sem restrição de ano. NS e OB não são exibidos como documentos de origem; podem aparecer no detalhamento como documentos relacionados à RP/NP.
- Fora do SIAGES, a extensão exige uma sessão autenticada e confirma que a conta tem acesso à tela `liquidacoes-pagamentos` antes de consultar os documentos. A consulta usa o token da extensão e continua sujeita às políticas RLS, incluindo o isolamento por órgão. Sem sessão ou permissão, nenhum documento financeiro é consultado.
- A consulta depende de os documentos estarem registrados em `documentos_habeis`.

## Validação manual

1. Em uma página externa compatível com a extensão, abra a paleta com `Ctrl+K`; pesquise `condh 07.805.649/0001-29`, `condh 2026NP000085` e `condh 82`. Confirme que o resumo é mostrado na própria paleta, sem redirecionamento, e que selecionar uma RP/NP abre seu detalhamento.
2. Repita a pesquisa por CNPJ sem pontuação. Verifique a situação, o favorecido, a data e o valor no resumo.
3. Com mais de 20 documentos, navegue por todas as páginas usando `Próxima` e `Anterior`.
4. No SIAGES, confirme que apenas a paleta nativa aparece e que a seleção continua abrindo o diálogo financeiro existente. No Comprasnet, confirme que a paleta global não interfere no fluxo específico de ETP.
5. Com uma conta sem acesso à tela Liquidações e Pagamentos, confirme que a paleta informa a falta de permissão e não envia consulta para `documentos_habeis`.
