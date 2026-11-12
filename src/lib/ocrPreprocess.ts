export interface GridLineRemovalOptions {
  /** Pixels com luminancia abaixo deste valor sao considerados tinta. */
  threshold?: number;
  /** Sequencia minima (em pixels) de tinta contigua para ser tratada como linha de tabela. */
  minLineLength?: number;
}

/**
 * Prepara a imagem de uma pagina para OCR: binariza (preto/branco) e apaga as linhas longas,
 * horizontais e verticais, das grades de tabela. Sem isso o Tesseract perde as celulas
 * (agencia, conta, curso...) que ficam coladas nas bordas da tabela.
 *
 * Altera `rgba` no lugar (formato ImageData: 4 bytes por pixel).
 * O comprimento minimo padrao e proporcional a largura, para funcionar em qualquer resolucao.
 */
export function binarizeAndRemoveGridLines(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: GridLineRemovalOptions = {},
): void {
  const threshold = options.threshold ?? 170;
  const minLineLength = options.minLineLength ?? Math.max(40, Math.round(width * 0.03));
  const total = width * height;

  const ink = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const luminance = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    // Pixel transparente conta como fundo branco.
    ink[i] = rgba[o + 3] > 127 && luminance < threshold ? 1 : 0;
  }

  const line = new Uint8Array(total);

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      if (!ink[y * width + x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < width && ink[y * width + x]) x += 1;
      if (x - start >= minLineLength) {
        for (let k = start; k < x; k += 1) line[y * width + k] = 1;
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;
    while (y < height) {
      if (!ink[y * width + x]) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < height && ink[y * width + x]) y += 1;
      if (y - start >= minLineLength) {
        for (let k = start; k < y; k += 1) line[k * width + x] = 1;
      }
    }
  }

  for (let i = 0; i < total; i += 1) {
    const value = ink[i] && !line[i] ? 0 : 255;
    const o = i * 4;
    rgba[o] = value;
    rgba[o + 1] = value;
    rgba[o + 2] = value;
    rgba[o + 3] = 255;
  }
}
