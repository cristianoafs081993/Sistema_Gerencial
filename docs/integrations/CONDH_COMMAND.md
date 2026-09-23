# Busca de RP/NP pela paleta de comandos

A consulta de RP/NP por favorecido pode ser iniciada tanto na paleta nativa do SIAGES quanto na paleta global da extensão Suape em outros sites compatíveis com a extensão. Digite `condh` seguido do CPF/CNPJ, com ou sem pontuação. Por exemplo: `condh 07.805.649/0001-29`.

## Comportamento

- A consulta começa quando a entrada normalizada contém 11 dígitos (CPF) ou 14 dígitos (CNPJ). Não há validação dos dígitos verificadores.
- Fora do SIAGES, a extensão oferece uma ação para abrir Liquidações e Pagamentos com o documento preenchido. `Enter` abre na aba atual e `Ctrl+Enter` abre em outra aba. No SIAGES, a paleta nativa permanece responsável pela consulta e a extensão não injeta uma segunda paleta.
- A extensão encaminha somente o comando para o SIAGES; a consulta dos dados continua no app, com a sessão autenticada e a permissão existente para `liquidacoes-pagamentos`. O CPF/CNPJ é transportado no fragmento da URL (após `#`), lido pelo navegador e removido da barra de endereço ao iniciar a tela; ele não é enviado ao servidor como parte da requisição da página.
- São listados documentos de origem NP/RP associados ao CPF/CNPJ informado, sem restrição de ano ou situação. NS e OB não são listados como documentos de origem.
- Os resultados aparecem do mais recente para o mais antigo, em páginas de 20 itens. A situação, o número, o favorecido, a data de emissão e o valor são exibidos na paleta.
- Selecionar um resultado abre o diálogo financeiro já usado em Liquidações e Pagamentos, que carrega o detalhamento completo do documento.
- A busca depende de os documentos estarem registrados em `documentos_habeis`. O acesso à consulta segue a permissão de tela `liquidacoes-pagamentos` e as políticas RLS do banco.

## Validação manual

1. Em uma página externa compatível com a extensão, abra a paleta com `Ctrl+K` e digite `condh 07.805.649/0001-29`; confirme que a ação aponta para Liquidações e Pagamentos do SIAGES. Teste `Enter` e `Ctrl+Enter`.
2. Entre no SIAGES e confirme que só a paleta nativa aparece. Digite o mesmo comando e confirme que os resultados incluem RP/NP desse favorecido, exibem situação e não incluem NS/OB.
3. Se houver mais de 20 resultados, use `Próxima` e `Anterior` para percorrer as páginas.
4. Selecione um documento e confirme que o diálogo financeiro carrega os detalhes correspondentes.
5. Com um usuário sem acesso à tela Liquidações e Pagamentos, confirme que os resultados não são consultados, inclusive ao iniciar pelo encaminhamento da extensão.
