import { describe, expect, it } from 'vitest';

import {
  buildSuapPlanSourceUrl,
  DEFAULT_SUAP_PLAN_UNIT,
  getSuapPlanUnit,
  getSuapPlanUnitForCampus,
  parseSuapPlanUnitFromSourceUrl,
  SUAP_PLAN_UNITS,
} from '@/lib/suapPlanUnits';

describe('catálogo do Plano 8 do SUAP', () => {
  it('mantém todas as opções não vazias observadas no seletor do SUAP', () => {
    expect(SUAP_PLAN_UNITS).toHaveLength(44);
    expect(new Set(SUAP_PLAN_UNITS.map((unit) => unit.value)).size).toBe(44);
    expect(getSuapPlanUnit('19')).toMatchObject({ code: 'DG/CN', parentUasg: '158366', kind: 'campus' });
    expect(getSuapPlanUnit('15')).toMatchObject({ code: 'DG/MC', parentUasg: '158365' });
    expect(getSuapPlanUnit('5')).toMatchObject({ code: 'PROAD/RE', parentUasg: '158155', kind: 'systemic' });
    expect(getSuapPlanUnit('38')).toMatchObject({ code: 'AUDGE', parentUasg: '158155', kind: 'systemic' });
  });

  it('usa Currais Novos como fallback seguro para UASG desconhecida', () => {
    expect(getSuapPlanUnitForCampus('158366').value).toBe(DEFAULT_SUAP_PLAN_UNIT);
    expect(getSuapPlanUnitForCampus('999999').value).toBe(DEFAULT_SUAP_PLAN_UNIT);
  });

  it('constrói a URL legada de Currais sem query e as demais com query controlada', () => {
    expect(buildSuapPlanSourceUrl('19')).toBe('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/');
    expect(buildSuapPlanSourceUrl('15')).toBe('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=15');
    expect(buildSuapPlanSourceUrl('38')).toBe('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=38');
    expect(() => buildSuapPlanSourceUrl('999')).toThrow('Unidade SUAP inválida');
  });

  it('extrai somente a unidade permitida da URL canônica', () => {
    expect(parseSuapPlanUnitFromSourceUrl('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/')).toBe('19');
    expect(parseSuapPlanUnitFromSourceUrl('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=15')).toBe('15');
    expect(parseSuapPlanUnitFromSourceUrl('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=999')).toBeNull();
    expect(parseSuapPlanUnitFromSourceUrl('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/?unidade_gestora=15&next=/')).toBeNull();
    expect(parseSuapPlanUnitFromSourceUrl('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/#x')).toBeNull();
    expect(parseSuapPlanUnitFromSourceUrl('https://malicioso.example/plan_estrategico/plano_concluido/8/?unidade_gestora=15')).toBeNull();
  });

  it('faz round-trip de todas as unidades sem alterar a URL legada de Currais', () => {
    for (const unit of SUAP_PLAN_UNITS) {
      expect(parseSuapPlanUnitFromSourceUrl(buildSuapPlanSourceUrl(unit.value))).toBe(unit.value);
    }

    expect(buildSuapPlanSourceUrl(DEFAULT_SUAP_PLAN_UNIT)).not.toContain('unidade_gestora=');
    expect(parseSuapPlanUnitFromSourceUrl(buildSuapPlanSourceUrl(DEFAULT_SUAP_PLAN_UNIT))).toBe(DEFAULT_SUAP_PLAN_UNIT);
  });

  it('mantém a unidade de Currais como seleção de campus para sua UASG', () => {
    expect(getSuapPlanUnitForCampus('158366')).toMatchObject({
      value: DEFAULT_SUAP_PLAN_UNIT,
      code: 'DG/CN',
      parentUasg: '158366',
      kind: 'campus',
    });
  });
});
