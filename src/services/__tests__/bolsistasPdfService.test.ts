import { describe, it, expect } from 'vitest';
import { extractFromText } from '../bolsistasPdfService';

describe('bolsistasPdfService', () => {
  describe('extractFromText in Table Layout (Format B)', () => {
    it('should correctly parse standard student records', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alison Rafael da Silva Pereira   20241034010039   168.469.274-17   001   0075-2   20920-1   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        cpf: '168.469.274-17',
        nome: 'Alison Rafael da Silva Pereira',
        banco: '001',
        agencia: '0075-2',
        conta: '20920-1',
        sourceFile: 'test.pdf',
        valor: 91.00,
      });
    });

    it('should ignore OP column when parsing old table accounts', () => {
      const text = `
        N\u00ba   NOME   MATR\u00cdCULA   CPF   BANCO   AG\u00caNCIA   OP.   CONTA  VALOR  REFER\u00caNCIA
        1   Allyson Fernando Miranda de Castro   20251034010037   129.220.414-17   104   3880   1288   718134525-8   300,00 R$
        2   Cailany Vivian Silva de Macedo   20241031160031   708.245.154-71   260   0001   251198763-8   300,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        banco: '104',
        agencia: '3880',
        conta: '718134525-8',
      });
      expect(results[1]).toMatchObject({
        banco: '260',
        agencia: '0001',
        conta: '251198763-8',
      });
    });

    it('should parse students with very long names (up to 80 characters)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Hevelly Mariana Conceição Fernandes da Silva   20261030480025   711.521.464-67   260   0001   985864867-1   55,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].nome).toBe('Hevelly Mariana Conceição Fernandes da Silva');
      expect(results[0].cpf).toBe('711.521.464-67');
    });

    it('should parse bank codes with 2 digits (e.g. Banco Inter - 77)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Ana Cecilya Alves da Costa   20231031160064   711.783.284-30   77   0001   28299072-0   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].banco).toBe('77');
      expect(results[0].conta).toBe('28299072-0');
    });

    it('should parse accounts containing dots (e.g. 22.606-8)', () => {
      const text = `
        Nº   NOME   MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alicia Beatriz Medeiros de Almeida Silva   20261031160065   700.651.344-86   001   0075-2   22.606-8   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].conta).toBe('22.606-8');
    });

    it('should parse multiple students correctly', () => {
      const text = `
        MATRÍCULA   CPF   BANCO   AGÊNCIA   OP.   CONTA  VALOR  REFERÊNCIA
        1   Alicia Beatriz Medeiros de Almeida Silva   20261031160065   700.651.344-86   001   0075-2   22.606-8   91,00 R$
        2   Alison Rafael da Silva Pereira   20241034010039   168.469.274-17   001   0075-2   20920-1   91,00 R$
        3   Ana Cecilya Alves da Costa   20231031160064   711.783.284-30   77   0001   28299072-0   91,00 R$
      `;
      const results = extractFromText(text, 'test.pdf');
      expect(results).toHaveLength(3);
      expect(results[0].cpf).toBe('700.651.344-86');
      expect(results[1].cpf).toBe('168.469.274-17');
      expect(results[2].cpf).toBe('711.783.284-30');
    });
  });

  describe('extractFromText in PAFE payment sheet layout', () => {
    it('should parse all students from the PAFE table with value before CPF', () => {
      const text = [
        'INSTITUTO FEDERAL DE EDUCACAO, CIENCIA E TECNOLOGIA DO RIO GRANDE DO NORTE',
        'N° NOME MATRÍCULA SETOR TURNO VR R$ CPF DADOS BANCÁRIOS',
        'BANCO AGÊNCIA OP. CONTA',
        '1 Allyson Fernando Miranda de Castro 20251034010037 DIAD MAT. R$ 300,00 129.220.414-17 104 3880 1288 718134525-8',
        '2 Arthur Carvalho Borges \uFFFD 20251031160060 COADES MAT. R$ 287,00 110.124.444-57 104 3880 1288 718140085-2',
        '3 Cailany Vivian Silva de Macedo 20241031160031 Extensao MAT. R$ 300,00 708.245.154-71 260 0001 251198763-8',
        '4 Ediclebson Leomark Medeiros da Silva 20231031160060 NAPNE MAT. R$ 300,00 174.636.934-57 77 0001 28737112-3',
        '5 Edna Vyviane Lopes da Silva 20251034010007 COADES MAT. R$ 300,00 158.830.854-58 001 0075-2 21746-8',
        '6 Edson Matheus da Silva Aquino 20241034010016 COSGEM VESP. R$ 300,00 712.063.524-77 260 0001 88559946-8',
        '7 Elisangela Pereira da Silva Araujo 20231030480005 COAES NOT. R$ 300,00 708.245.034-65 380 0001 84654222-6',
        '8 Emanoel Guilherme Pereira da Silva de Aquino 20241032060004 Lab. Eletronica MAT. R$ 300,00 511.250.338-60 260 0001 69939805-2',
        '9 Emilayne Carla de Oliveira Silva 20231031120014 Musica VESP. R$ 300,00 709.711.584-01 341 500 23713937-8',
        '10 Eric Lucas da Silva Moraes 20251034010015 CTI MAT. R$ 300,00 705.696.784-12 323 0001 5084161055-8',
        '11 \uFFFDvelyn Patricia Bezerra Galvao 20231031160051 Refeitorio MAT. R$ 300,00 708.046.274-60 104 805 1288 708357769-3',
        '12 Fabriny Iasmin Medeiros de Araujo 20241034010029 CTI VESP. R$ 300,00 708.823.034-81 260 0001 72478980-7',
        '13 Geana Mayara dos Santos 20241030480022 COAES MAT. R$ 300,00 706.932.804-41 260 0001 22343978-5',
        '14 Gleidson Miranda Rocha 20251031160045 Portaria VESP. R$ 300,00 864.208.095-76 260 0001 63263266-2',
        '15 Guilherme Wittor Alves da Silva 20241034010020 Lab. Eletronica VESP. R$ 300,00 098.030.394-07 260 0001 718855218-4',
        '16 Henry Clebson de Oliveira da Trindade 20231031120016 Lab. Manutencao VESP. R$ 300,00 127.104.754-30 260 0001 62647084-5',
        '17 Joanderson Pereira da Silva 20231031120027 Extensao VESP. R$ 300,00 712.297.064-70 001 361-1 46856-8',
        '18 Joao Marcos de Medeiros Junior 20231031120017 Ed. Fisica VESP. R$ 300,00 098.083.164-41 260 0001 112145880-7',
        '19 Joao Paulo Barros Silva 20251030480023 COADES VESP. R$ 300,00 090.643.664-89 260 0001 75796677-3',
        '20 Joao Renato Alves Bezerra Junior 20251034010027 CTI MAT. R$ 300,00 706.206.724-55 77 0001 30899397-7',
        '21 Joaquim Vinicios Assuncao de Lima 20251032060003 COADES VESP. R$ 300,00 114.727.794-01 260 0001 854013838-1',
        '22 Jobel Miguel Fernandes Dantas 20241031160042 Lab. Quimica VESP. R$ 300,00 113.457.154-20 001 0075-2 20.877-9',
        '23 Johane Stefany da Silva Oliveira 20241031160008 COAES MAT. R$ 300,00 709.472.644-93 77 0001 37210024-4',
        '24 Jose Anderson Francisco da Silva 20231038060036 Biblioteca NOT. R$ 300,00 711.714.944-24 260 0001 84924076-7',
        '25 Kaue Adriano dos Santos Dantas 20241038060007 DIAD VESP. R$ 300,00 105.942.874-13 001 0075-2 17758-X',
        '26 Leticia Francyanne Araujo Santos\uFFFD 20241031160049 Lab. Alimentos VESP. R$ 109,00 017.688.154-96 104 4963 744010181-3',
        'INSTITUTO FEDERAL DE EDUCACAO, CIENCIA E TECNOLOGIA DO RIO GRANDE DO NORTE CAMPUS CURRAIS NOVOS SERVICO SOCIAL DADOS BANCARIOS',
        '27 Marcos Henrique Costa da Silva \uFFFD 20241038060009 COAES MAT. R$ 328,00 713.153.934-17 380 0001 136326329-3',
        '28 MARIA ALYCE MEDEIROS SILVA 20251031160054 COLAB MAT. R$ 300,00 127.418.644-70 104 3880 1288 718134966-0',
        '29 Maria Clara Alexandre 20231030480018 Biblioteca MAT. R$ 300,00 708.251.214-77 260 0001 70735915-2',
        '30 Maria Clara Almeida Soares 20251031160012 Refeitorio VESP. R$ 300,00 710.013.934-14 001 8285-6 6735-0',
        '31 Maria Clara Campelo da Silva 20251031160018 Comunicacao MAT. R$ 300,00 706.954.374-37 104 805 13 000733219075-4',
        '32 Maria Eduarda dos Santos Simoes 20251030480020 Refeitorio VESP. R$ 300,00 707.686.044-94 260 0001 774400629-4',
        '33 Maria Fernanda Santos de Araujo 20231031160066 Lab. Alimentos MAT. R$ 300,00 710.642.374-28 104 805 568009338-0',
        '34 Natanael Franklin Silva Diogo 20251038060033 Lab. Manutencao MAT. R$ 300,00 709.781.834-44 380 0001 119423848-3',
        '35 Paulo Guilherme Silva de Araujo 20251038060001 COADES MAT. R$ 300,00 700.904.714-66 260 0001 2321448-7',
        '36 Rafaela Aparecida de Almeida Brazao 20241031160023 COSGEM MAT. R$ 300,00 707.916.894-50 104 3880 1288 737995421-1',
        '37 Tamara Pinheiro da Silva 20221034130037 Ed. Fisica MAT. R$ 300,00 017.795.204-09 380 0001 14791783-2',
        '38 Wesley Davi Crispim da Fonseca 20231031120006 CTI VESP. R$ 300,00 707.052.464-18 77 0001-9 29365574-0',
        '39 Yasmin Florentino de Medeiros 20231031160058 Refeitorio VESP. R$ 300,00 708.162.954-76 341 6214 50814-2',
        '40 Yuri Caua Araujo Domingos 20231031120004 Biblioteca VESP. R$ 300,00 711.698.424-02 77 0001 24850471-1',
        'Total R$ 11.824,00',
        'Copia de documento digital impresso por Cristiano Farias (3128880) em 22 de Julho de 2026 as 09:14.',
      ].join(' ');

      const results = extractFromText(text, 'documento (39).pdf');

      expect(results).toHaveLength(40);
      expect(results[0]).toMatchObject({
        cpf: '129.220.414-17',
        nome: 'Allyson Fernando Miranda de Castro',
        banco: '104',
        agencia: '3880',
        conta: '718134525-8',
        valor: 300,
      });
      expect(results.find((row) => row.cpf === '708.245.154-71')).toMatchObject({
        banco: '260',
        agencia: '0001',
        conta: '251198763-8',
      });
      expect(results.find((row) => row.cpf === '105.942.874-13')).toMatchObject({ conta: '17758-X' });
      expect(results.find((row) => row.cpf === '017.688.154-96')).toMatchObject({ valor: 109 });
      expect(results.find((row) => row.cpf === '713.153.934-17')).toMatchObject({ valor: 328 });
      expect(results.find((row) => row.cpf === '707.052.464-18')).toMatchObject({
        banco: '77',
        agencia: '0001-9',
        conta: '29365574-0',
      });
    });
  });

  describe('extractFromText in New Table Layout (VR R$ format)', () => {
    it('should parse students from VR R$ layout without OP column', () => {
      const text = `
        N°   NOME   MATRÍCULA   SETOR   TURNO   VR R$   CPF  BANCO   AGÊNCIA   OP.   CONTA
        3   Cailany Vivian Silva de Macedo   20241031160031   Extensão   MAT.   300,00 R$   708.245.154-71   0260   0001   251198763-8
      `;
      const results = extractFromText(text, 'doc22.pdf');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        cpf: '708.245.154-71',
        nome: 'Cailany Vivian Silva de Macedo',
        banco: '0260',
        agencia: '0001',
        conta: '251198763-8',
        sourceFile: 'doc22.pdf',
        valor: 300.00,
      });
    });

    it('should parse students from VR R$ layout with OP column (Caixa)', () => {
      const text = `
        N°   NOME   MATRÍCULA   SETOR   TURNO   VR R$   CPF  BANCO   AGÊNCIA   OP.   CONTA
        1   Allyson Fernando Miranda de Castro   20251034010037   DIAD   MAT.   300,00 R$   129.220.414-17   104   3880   1288   718134525-8
      `;
      const results = extractFromText(text, 'doc22.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].cpf).toBe('129.220.414-17');
      expect(results[0].banco).toBe('104');
      expect(results[0].agencia).toBe('3880');
      expect(results[0].conta).toBe('718134525-8');
      expect(results[0].valor).toBe(300.00);
    });

    it('should strip superscript footnote markers from names', () => {
      const text = `
        N°   NOME   MATRÍCULA   SETOR   TURNO   VR R$   CPF  BANCO   AGÊNCIA   OP.   CONTA
        2   Arthur Carvalho Borges ¹   20251031160060   COADES   MAT.   245,00 R$   110.124.444-57   104   3880   1288   718140085-2
      `;
      const results = extractFromText(text, 'doc22.pdf');
      expect(results).toHaveLength(1);
      expect(results[0].nome).toBe('Arthur Carvalho Borges');
      expect(results[0].valor).toBe(245.00);
    });

    it('should parse multiple students with mixed OP presence', () => {
      const text = `
        N°   NOME   MATRÍCULA   SETOR   TURNO   VR R$   CPF  BANCO   AGÊNCIA   OP.   CONTA
        1   Allyson Fernando Miranda de Castro   20251034010037   DIAD   MAT.   300,00 R$   129.220.414-17   104   3880   1288   718134525-8
        3   Cailany Vivian Silva de Macedo   20241031160031   Extensão   MAT.   300,00 R$   708.245.154-71   0260   0001   251198763-8
        4   Ediclebson Leomark Medeiros da Silva   20231031160060   NAPNE   MAT.   300,00 R$   174.636.934-57   077   0001   28737112-3
      `;
      const results = extractFromText(text, 'doc22.pdf');
      expect(results).toHaveLength(3);
      expect(results[0].cpf).toBe('129.220.414-17');
      expect(results[1].cpf).toBe('708.245.154-71');
      expect(results[2].cpf).toBe('174.636.934-57');
    });
  });
});
