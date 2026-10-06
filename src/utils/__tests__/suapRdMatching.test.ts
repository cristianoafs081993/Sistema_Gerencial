import { expect, it } from 'vitest';
import { matchEmpenhosToAtividades } from '../atividadeEmpenhoMatching';
import type { Atividade, Empenho } from '@/types';
import type { RdLink } from '@/services/suapRdService';
const a = { id:'a',atividade:'Almoxarifado virtual',campusUasg:'158366',suapUnitCode:'19',suapPlanId:8,suapActivityId:'32635' } as Atividade;
const b = { ...a,id:'b',suapActivityId:'33155' };
const emp = { id:'e',numero:'2026NE000014',descricao:'Almoxarifado virtual',valor:100,status:'pendente' } as Empenho;
const link = { org_id:'org',campus_uasg:'158366',suap_unit_code:'19',suap_plan_id:8,suap_activity_id:'32635',atividade_id:'a',empenho_id:'e',empenho_numero:emp.numero,valor_rd:100,resolved:true,rds:['2026RD003731'],captured_at:'2026-10-05' } as RdLink;
it('nenhuma inferência entra no total quando não há evidência RD', () => {
  expect(matchEmpenhosToAtividades([a],[emp],[]).unmatchedEmpenhos).toEqual([emp]);
});
it('associação oficial ignora texto e origem, mas valida todos os identificadores', () => {
  const result = matchEmpenhosToAtividades([a],[{...emp,descricao:'Outra descrição',origemRecurso:'outro'}],[link]);
  expect(result.empenhosPorAtividadeMap.get('a')?.total).toBe(100);
  for (const bad of [{...link,suap_unit_code:'25'},{...link,suap_plan_id:7},{...link,suap_activity_id:'999'},{...link,resolved:false}]) expect(matchEmpenhosToAtividades([a],[emp],[bad]).unmatchedEmpenhos).toEqual([emp]);
});
it('vínculos manuais são preservados mesmo quando divergem da RD', () => {
  expect(matchEmpenhosToAtividades([a,b],[{...emp,atividadeId:'b'}],[{...link,resolved:false}]).empenhosPorAtividadeMap.get('b')?.total).toBe(100);
});
it('NE compartilhada distribui somente os valores comprovados sem duplicar e exige fechamento', () => {
  const links = [{...link,valor_rd:60},{...link,atividade_id:'b',suap_activity_id:'33155',valor_rd:40}];
  const result = matchEmpenhosToAtividades([a,b],[emp],links);
  expect(result.empenhosPorAtividadeMap.get('a')?.total).toBe(60); expect(result.empenhosPorAtividadeMap.get('b')?.total).toBe(40);
  expect(matchEmpenhosToAtividades([a,b],[{...emp,valor:101}],links).unmatchedEmpenhos).toHaveLength(1);
});
