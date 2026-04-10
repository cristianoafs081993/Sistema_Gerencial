import { describe, expect, it } from 'vitest';
import {
  normalizeActivityName,
  normalizeFunctionalComponentName,
} from '../functionalComponentLabels';

describe('functionalComponentLabels', () => {
  it('removes numeric prefixes from functional component names', () => {
    expect(normalizeFunctionalComponentName('11 - Contratos')).toBe('Contratos');
    expect(normalizeFunctionalComponentName('25- Cadastro e pagamento de Pessoal')).toBe(
      'Cadastro e pagamento de Pessoal',
    );
    expect(
      normalizeFunctionalComponentName(
        'COMPONENTE FUNCIONAL (PROEN): Gestão Pedagógica e Desen. Curricular - EJA Integrada à EPT',
      ),
    ).toBe('Gestão Pedagógica e Desen. Curricular - EJA Integrada à EPT');
  });

  it('keeps component names without numeric prefixes unchanged', () => {
    expect(normalizeFunctionalComponentName('Programas e Projetos de Ensino')).toBe(
      'Programas e Projetos de Ensino',
    );
  });

  it('removes the PROEN prefix from ensino activities', () => {
    expect(
      normalizeActivityName(
        '44 - COMPONENTE FUNCIONAL (PROEN): Planejamento e realizacao de atividades externas',
        'EN - Ensino',
      ),
    ).toBe('Planejamento e realizacao de atividades externas');

    expect(
      normalizeActivityName(
        '\t63 - COMPONENTE FUNCIONAL (PROEN): Fomento de bolsas de tutoria',
        'EN',
      ),
    ).toBe('Fomento de bolsas de tutoria');
  });

  it('keeps only the activity name when ensino labels include component and activity', () => {
    expect(
      normalizeActivityName(
        '44 - COMPONENTE FUNCIONAL (PROEN): Apoio ao Ensino - Laboratorios Academicos',
        'EN - Ensino',
      ),
    ).toBe('Laboratorios Academicos');

    expect(
      normalizeActivityName(
        'Gestao Pedagogica e Desenvolvimento Curricular - EJA integrada a EPT',
        'EN',
      ),
    ).toBe('EJA integrada a EPT');
  });

  it('does not remove the PROEN prefix outside ensino', () => {
    expect(
      normalizeActivityName(
        '44 - COMPONENTE FUNCIONAL (PROEN): Texto original',
        'AD - Administracao',
      ),
    ).toBe('44 - COMPONENTE FUNCIONAL (PROEN): Texto original');
  });
});
