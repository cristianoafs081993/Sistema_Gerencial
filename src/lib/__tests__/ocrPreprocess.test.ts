import { describe, expect, it } from 'vitest';
import { binarizeAndRemoveGridLines } from '../ocrPreprocess';

function createImage(width: number, height: number, fill = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = fill;
    data[i * 4 + 1] = fill;
    data[i * 4 + 2] = fill;
    data[i * 4 + 3] = 255;
  }
  return data;
}

const setPixel = (data: Uint8ClampedArray, width: number, x: number, y: number, value: number) => {
  const o = (y * width + x) * 4;
  data[o] = value;
  data[o + 1] = value;
  data[o + 2] = value;
};

const getValue = (data: Uint8ClampedArray, width: number, x: number, y: number) => data[(y * width + x) * 4];

describe('binarizeAndRemoveGridLines', () => {
  const width = 200;
  const height = 120;

  it('apaga linhas longas horizontais e verticais, mas preserva o texto', () => {
    const data = createImage(width, height);
    // grade: linha horizontal em y=40 (x 10..189) e vertical em x=100 (y 10..109)
    for (let x = 10; x < 190; x += 1) setPixel(data, width, x, 40, 20);
    for (let y = 10; y < 110; y += 1) setPixel(data, width, 100, y, 20);
    // "texto": tracos curtos (um quadrado 6x8) fora da grade
    for (let y = 60; y < 68; y += 1) for (let x = 30; x < 36; x += 1) setPixel(data, width, x, y, 10);

    binarizeAndRemoveGridLines(data, width, height, { minLineLength: 40 });

    expect(getValue(data, width, 50, 40)).toBe(255); // linha horizontal removida
    expect(getValue(data, width, 100, 80)).toBe(255); // linha vertical removida
    expect(getValue(data, width, 32, 63)).toBe(0); // texto preservado em preto
  });

  it('binariza: cinza claro vira branco e cinza escuro vira preto', () => {
    const data = createImage(width, height);
    setPixel(data, width, 5, 5, 230); // sombra/fundo claro
    setPixel(data, width, 7, 5, 60); // tinta

    binarizeAndRemoveGridLines(data, width, height, { minLineLength: 40 });

    expect(getValue(data, width, 5, 5)).toBe(255);
    expect(getValue(data, width, 7, 5)).toBe(0);
    expect(data[(5 * width + 7) * 4 + 3]).toBe(255);
  });

  it('usa um comprimento minimo proporcional a largura por padrao', () => {
    const wide = 2000;
    const data = createImage(wide, 40);
    // 50 px de tinta: abaixo de 3% de 2000 (=60) -> e texto/traco, nao linha
    for (let x = 100; x < 150; x += 1) setPixel(data, wide, x, 10, 0);
    // 100 px de tinta: acima do limite -> linha
    for (let x = 300; x < 400; x += 1) setPixel(data, wide, x, 20, 0);

    binarizeAndRemoveGridLines(data, wide, 40);

    expect(getValue(data, wide, 120, 10)).toBe(0);
    expect(getValue(data, wide, 350, 20)).toBe(255);
  });

  it('trata pixels transparentes como fundo branco', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4); // tudo 0: preto transparente
    binarizeAndRemoveGridLines(data, 4, 4, { minLineLength: 40 });

    expect(Array.from(data.filter((_, i) => i % 4 !== 3)).every((v) => v === 255)).toBe(true);
  });
});
