# Alerta de pré-doc no Comprasnet

O alerta é injetado pela extensão Suape na rota:

`https://contratos.comprasnet.gov.br/apropriacao/fatura-form/*`

Na aba `Dados de pagamento`, o Comprasnet mantém o botão de ação `Pré-Doc` tanto antes quanto depois do preenchimento. O sinal confiável de preenchimento é o controle de remoção que aparece na mesma célula depois que o pré-doc é salvo. A extensão observa esse estado em favorecidos e deduções com `MutationObserver`, pois as abas são carregadas dinamicamente.

Enquanto houver uma linha pendente, a extensão bloqueia, com opção de permanecer ou continuar:

- troca para outra aba do formulário;
- `Confirmar Dados de Pagamento`;
- `Apropriar SIAFI`;
- links de navegação;
- saída, recarregamento ou fechamento da página pelo alerta nativo do navegador.

O botão e os controles do próprio fluxo de edição do pré-doc permanecem livres para que o preenchimento seja concluído.
