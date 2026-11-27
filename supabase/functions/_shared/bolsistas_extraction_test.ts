import { buildBolsistasPrompt, isValidCpf, normalizeBolsistasIaResponse } from "./bolsistas_extraction.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// CPFs ficticios com digito verificador valido.
const CPF_A = "529.982.247-25";
const CPF_B = "111.444.777-35";

Deno.test("CPF: valida digitos verificadores", () => {
  assert(isValidCpf(CPF_A), "CPF valido recusado");
  assert(!isValidCpf("529.982.247-26"), "DV invalido aceito");
  assert(!isValidCpf("111.111.111-11"), "sequencia repetida aceita");
});

Deno.test("Normaliza a resposta da IA: formata CPF, limpa conta e descarta CPF invalido e repetido", () => {
  const result = normalizeBolsistasIaResponse({
    declaredCount: 3,
    bolsistas: [
      { nome: "ALUNA FICTICIA UM (20241031120001)", cpf: "52998224725", banco: "Banco do Brasil S.A.", bancoCodigo: "001", agencia: " 1234-5 ", conta: "12.345-x (Conta corrente)", valor: "400,00" },
      { nome: "Aluno Ficticio Dois", cpf: CPF_B, banco: "Caixa Econômica Federal", bancoCodigo: "", agencia: "0001", conta: "000123456789-0", valor: 400 },
      { nome: "Repetido", cpf: CPF_A, agencia: "1", conta: "2" },
      { nome: "Erro de leitura", cpf: "123.456.789-00", agencia: "1", conta: "2" },
    ],
  });

  assert(result.bolsistas.length === 2, `esperava 2 bolsistas, veio ${result.bolsistas.length}`);
  assert(result.discardedInvalidCpf === 1, "CPF invalido nao contado");
  assert(result.declaredCount === 3, "declaredCount perdido");
  const [first, second] = result.bolsistas;
  assert(first.cpf === CPF_A, "CPF nao formatado");
  assert(first.nome === "ALUNA FICTICIA UM", "matricula nao removida do nome");
  assert(first.banco === "001", "bancoCodigo deveria prevalecer");
  assert(first.agencia === "1234-5", "agencia nao normalizada");
  assert(first.conta === "12.345-X", `conta nao normalizada: ${first.conta}`);
  assert(first.valor === 400, "valor pt-BR nao convertido");
  assert(second.banco === "Caixa Econômica Federal", "nome do banco deveria ser mantido sem codigo");
});

Deno.test("Matricula informada no lugar do CPF vira matricula e o aluno nao e descartado", () => {
  const result = normalizeBolsistasIaResponse({
    bolsistas: [
      { nome: "Aluna Ficticia", cpf: "20251030480001", banco: "CAIXA", agencia: "0805", conta: "00011969-3" },
      { nome: "Aluno Ficticio (20241031120002)", cpf: "", agencia: "1", conta: "2" },
      { nome: "Aluno Com Campo Proprio", cpf: "", matricula: "2023.1.0311.2000-3", agencia: "1", conta: "2" },
      { nome: "Repetido", cpf: "20251030480001", agencia: "1", conta: "2" },
      { nome: "Sem identificacao", cpf: "", agencia: "1", conta: "2" },
    ],
  });

  assert(result.bolsistas.length === 3, `esperava 3 bolsistas, veio ${result.bolsistas.length}`);
  assert(result.discardedInvalidCpf === 0, "matricula contada como CPF invalido");
  const [first, second, third] = result.bolsistas;
  assert(first.cpf === "" && first.matricula === "20251030480001", "matricula no campo cpf nao reconhecida");
  assert(second.matricula === "20241031120002" && second.nome === "Aluno Ficticio", "matricula do nome nao reconhecida");
  assert(third.matricula === "20231031120003", `matricula do campo proprio nao normalizada: ${third.matricula}`);
});

Deno.test("Resposta sem lista vira lista vazia", () => {
  const result = normalizeBolsistasIaResponse({ foo: "bar" });
  assert(result.bolsistas.length === 0 && result.discardedInvalidCpf === 0 && result.declaredCount === undefined, "resposta vazia mal tratada");
});

Deno.test("Prompt informa o total declarado e proibe inventar dados", () => {
  const prompt = buildBolsistasPrompt("Ofício 1/2026", "23035.000001.2026-00", 10);
  assert(prompt.includes("10 bolsa"), "total declarado ausente");
  assert(prompt.includes("não invente"), "regra de nao inventar ausente");
});
