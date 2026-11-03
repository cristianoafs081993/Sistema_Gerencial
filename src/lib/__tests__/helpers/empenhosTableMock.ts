export type EmpenhoRowMock = {
  id: string;
  campus_uasg: string;
  numero: string;
  tipo?: string | null;
  status?: string | null;
};

/**
 * Tabela `empenhos` em memória, com o subconjunto de consultas que syncSiafiDataToDb usa:
 * select().eq('campus_uasg').in('numero'), update().eq('id').eq('campus_uasg') e insert().select().single().
 */
export function createEmpenhosTableMock(initial: EmpenhoRowMock[] = []) {
  const rows = [...initial];
  const updates: Array<{ id: string; campus_uasg?: string; payload: Record<string, unknown> }> = [];
  const inserts: Record<string, unknown>[] = [];

  const from = (table: string) => {
    if (table !== 'empenhos') throw new Error(`Tabela inesperada no teste: ${table}`);

    return {
      select: () => {
        const filtros: Record<string, string> = {};
        const consulta = {
          eq: (coluna: string, valor: string) => {
            filtros[coluna] = valor;
            return consulta;
          },
          in: async (coluna: string, valores: string[]) => ({
            data: rows.filter(
              (row) =>
                valores.includes(String((row as Record<string, unknown>)[coluna])) &&
                Object.entries(filtros).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
            ),
            error: null,
          }),
        };
        return consulta;
      },
      update: (payload: Record<string, unknown>) => {
        const filtros: Record<string, string> = {};
        const consulta = {
          eq: (coluna: string, valor: string) => {
            filtros[coluna] = valor;
            return consulta;
          },
          then: (resolve: (value: { error: null }) => unknown) => {
            updates.push({ id: filtros.id, campus_uasg: filtros.campus_uasg, payload });
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return consulta;
      },
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        const novo: EmpenhoRowMock = {
          id: `novo-${inserts.length}`,
          campus_uasg: String(payload.campus_uasg),
          numero: String(payload.numero),
          tipo: String(payload.tipo ?? ''),
          status: String(payload.status ?? ''),
        };
        rows.push(novo);
        return {
          select: () => ({
            single: async () => ({ data: novo, error: null }),
          }),
        };
      },
    };
  };

  return { from, rows, updates, inserts };
}
