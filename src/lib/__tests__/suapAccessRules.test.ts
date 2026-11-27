import { describe, expect, it } from 'vitest';

import {
  buildSuapPhotoUrl,
  decideCampusPreference,
  decideGroupSync,
  extractSuapCampus,
  isGrantActive,
  normalizeMatricula,
  resolveCampusUasg,
} from '../../../supabase/functions/_shared/suap_access';

const campusMap = [
  { sigla: 'CN', campus_uasg: '158366' },
  { sigla: 'CNAT', campus_uasg: '158369' },
];
const uasgs = [
  { codigo_uasg: '158366', nome_uasg: 'Currais Novos' },
  { codigo_uasg: '158369', nome_uasg: 'Natal - Central' },
  { codigo_uasg: '158365', nome_uasg: 'Mossoro' },
];

const base = {
  grantActive: false,
  grantGroupIds: [] as string[],
  isTerceirizado: false,
  requireGrant: false,
  isAppLogin: true,
  currentGroupIds: [] as string[],
};

describe('regras de acesso do login SUAP', () => {
  it('normaliza matrícula como o cadastro de terceirizados', () => {
    expect(normalizeMatricula(' 12.345-6 ')).toBe('123456');
    expect(normalizeMatricula(null)).toBe('');
  });

  it('lê o campus do vínculo em formatos diferentes', () => {
    expect(extractSuapCampus({ vinculo: { campus: 'CN' } })).toEqual({ sigla: 'CN', nome: null });
    expect(extractSuapCampus({ vinculo: { campus: 'CN - Currais Novos' } })).toEqual({ sigla: 'CN', nome: 'Currais Novos' });
    expect(extractSuapCampus({ vinculo: { campus: { sigla: 'cnat', nome: 'Natal-Central' } } })).toEqual({ sigla: 'CNAT', nome: 'Natal-Central' });
    expect(extractSuapCampus({ vinculo: { campus: 'Campus Mossoró' } })).toEqual({ sigla: null, nome: 'Campus Mossoró' });
    expect(extractSuapCampus({ vinculo: {} })).toBeNull();
    expect(extractSuapCampus(null)).toBeNull();
  });

  it('resolve a UASG pela sigla e, na falta dela, pelo nome', () => {
    expect(resolveCampusUasg({ sigla: 'CN', nome: null }, campusMap, uasgs)).toBe('158366');
    expect(resolveCampusUasg({ sigla: null, nome: 'Campus Mossoró' }, campusMap, uasgs)).toBe('158365');
    expect(resolveCampusUasg({ sigla: 'XX', nome: 'Natal - Central' }, campusMap, uasgs)).toBe('158369');
    expect(resolveCampusUasg({ sigla: 'XX', nome: null }, campusMap, uasgs)).toBeNull();
    expect(resolveCampusUasg(null, campusMap, uasgs)).toBeNull();
  });

  it('considera ativa só a autorização com status ativo e dentro da validade', () => {
    expect(isGrantActive({ matricula: '1', status: 'ativo', valid_until: null }, '2026-11-27')).toBe(true);
    expect(isGrantActive({ matricula: '1', status: 'ativo', valid_until: '2026-11-27' }, '2026-11-27')).toBe(true);
    expect(isGrantActive({ matricula: '1', status: 'ativo', valid_until: '2026-11-26' }, '2026-11-27')).toBe(false);
    expect(isGrantActive({ matricula: '1', status: 'suspenso', valid_until: null }, '2026-11-27')).toBe(false);
    expect(isGrantActive(null, '2026-11-27')).toBe(false);
  });

  it('mantém a regra antiga quando não há autorização e a exigência está desligada', () => {
    expect(decideGroupSync(base)).toEqual({ mode: 'legacy-default', groupSlug: 'diretores' });
    expect(decideGroupSync({ ...base, currentGroupIds: ['fiscal'] })).toEqual({ mode: 'legacy-default', groupSlug: 'diretores' });
    expect(decideGroupSync({ ...base, isTerceirizado: true })).toEqual({ mode: 'terceirizado' });
  });

  it('aplica exatamente os grupos da autorização ativa', () => {
    expect(decideGroupSync({ ...base, grantActive: true, grantGroupIds: ['a', 'b', 'a'], currentGroupIds: ['c'] }))
      .toEqual({ mode: 'grant', groupIds: ['a', 'b'], removeOtherGroups: true });
    expect(decideGroupSync({ ...base, grantActive: true, grantGroupIds: ['a'], isTerceirizado: true }).mode).toBe('grant');
  });

  it('com exigência ligada, preserva quem já tem grupos e deixa pendente quem não tem', () => {
    const strict = { ...base, requireGrant: true };
    expect(decideGroupSync({ ...strict, currentGroupIds: ['diretores'] })).toEqual({ mode: 'keep' });
    expect(decideGroupSync(strict)).toEqual({ mode: 'pending' });
    expect(decideGroupSync({ ...strict, isAppLogin: false })).toEqual({ mode: 'keep' });
    expect(decideGroupSync({ ...strict, isTerceirizado: true })).toEqual({ mode: 'terceirizado' });
  });

  it('só define campus para usuário novo ou quando a autorização limita os campi', () => {
    expect(decideCampusPreference({ isNewUser: true, suapCampusUasg: '158369', grantCampi: [], currentCampusUasg: null })).toBe('158369');
    // Usuário existente mantém o campus que já usa.
    expect(decideCampusPreference({ isNewUser: false, suapCampusUasg: '158369', grantCampi: [], currentCampusUasg: '158366' })).toBeNull();
    expect(decideCampusPreference({ isNewUser: false, suapCampusUasg: '158369', grantCampi: [], currentCampusUasg: null })).toBeNull();
    expect(decideCampusPreference({ isNewUser: true, suapCampusUasg: '158369', grantCampi: [], currentCampusUasg: '158366' })).toBeNull();
    // Autorização com campi.
    expect(decideCampusPreference({ isNewUser: false, suapCampusUasg: '158369', grantCampi: ['158366', '158369'], currentCampusUasg: '158366' })).toBeNull();
    expect(decideCampusPreference({ isNewUser: false, suapCampusUasg: '158369', grantCampi: ['158366', '158369'], currentCampusUasg: '158365' })).toBe('158369');
    expect(decideCampusPreference({ isNewUser: false, suapCampusUasg: null, grantCampi: ['158366'], currentCampusUasg: '158365' })).toBe('158366');
  });

  it('monta a URL absoluta da foto do SUAP', () => {
    expect(buildSuapPhotoUrl({ url_foto_150x200: '/media/fotos/1.jpg' })).toBe('https://suap.ifrn.edu.br/media/fotos/1.jpg');
    expect(buildSuapPhotoUrl({ url_foto_150x200: 'https://cdn.example/1.jpg' })).toBe('https://cdn.example/1.jpg');
    expect(buildSuapPhotoUrl({ url_foto_75x100: '/media/fotos/2.jpg' })).toBe('https://suap.ifrn.edu.br/media/fotos/2.jpg');
    expect(buildSuapPhotoUrl({})).toBeNull();
  });
});
