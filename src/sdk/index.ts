import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { OrcamentoModule } from './orcamento';
import { EmpenhosModule } from './empenhos';
import { DescentralizacoesModule } from './descentralizacoes';
import { ContratosModule } from './contratos';
import { ConciliacaoModule } from './conciliacao';

export * from './types';
export { OrcamentoModule } from './orcamento';
export { EmpenhosModule } from './empenhos';
export { DescentralizacoesModule } from './descentralizacoes';
export { ContratosModule } from './contratos';
export { ConciliacaoModule } from './conciliacao';

/**
 * GovFlow Core SDK
 * Biblioteca analítica e de conciliação orçamentária, financeira e contratual do Sistema Gerencial.
 */
export class GovFlowSdk {
  public orcamento: OrcamentoModule;
  public empenhos: EmpenhosModule;
  public descentralizacoes: DescentralizacoesModule;
  public contratos: ContratosModule;
  public conciliacao: ConciliacaoModule;

  constructor(client: SupabaseClient = supabase) {
    this.orcamento = new OrcamentoModule(client);
    this.empenhos = new EmpenhosModule(client);
    this.descentralizacoes = new DescentralizacoesModule(client);
    this.contratos = new ContratosModule(client);
    this.conciliacao = new ConciliacaoModule(client);
  }
}

/**
 * Instância padrão (singleton) conectada ao cliente Supabase da aplicação
 */
export const govflow = new GovFlowSdk(supabase);
export default govflow;
