import type { PDFPageProxy } from 'pdfjs-dist';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { binarizeAndRemoveGridLines } from '@/lib/ocrPreprocess';

/**
 * OCR de paginas de PDF que so tem imagem (sem camada de texto).
 *
 * O tesseract.js e carregado sob demanda (import dinamico) e todos os seus arquivos pesados
 * (worker, nucleo WebAssembly e idioma portugues) sao servidos pelo proprio app em /ocr,
 * copiados de node_modules por `scripts/copy-ocr-assets.mjs`. Nada e baixado de CDN externa.
 */

/** Largura em pixels alvo do maior lado da pagina renderizada (~300 dpi em A4). */
const TARGET_LONG_SIDE_PX = 3500;
const MAX_RENDER_SCALE = 4.2;

export interface PdfOcrSession {
  /** Renderiza a pagina, prepara a imagem e devolve o texto reconhecido. */
  recognizePage: (page: PDFPageProxy) => Promise<string>;
  /** Libera o worker do Tesseract. Seguro chamar mais de uma vez. */
  dispose: () => Promise<void>;
}

function absoluteAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  // O worker do Tesseract roda a partir de um blob:, entao precisa de URLs absolutas.
  return new URL(`${base.replace(/\/$/, '')}/ocr/${path}`, window.location.href).href;
}

type TesseractModule = typeof import('tesseract.js');

async function loadTesseract(): Promise<TesseractModule> {
  const mod = (await import('tesseract.js')) as TesseractModule & { default?: TesseractModule };
  return mod.createWorker ? mod : (mod.default as TesseractModule);
}

async function renderPageToCanvas(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_RENDER_SCALE, TARGET_LONG_SIDE_PX / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D indisponivel para renderizar a pagina do PDF.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  binarizeAndRemoveGridLines(image.data, canvas.width, canvas.height);
  context.putImageData(image, 0, 0);

  return canvas;
}

export function createPdfOcrSession(): PdfOcrSession {
  let workerPromise: Promise<TesseractWorker> | null = null;

  const getWorker = () => {
    if (!workerPromise) {
      workerPromise = (async () => {
        const { createWorker, PSM, OEM } = await loadTesseract();
        const worker = await createWorker('por', OEM.LSTM_ONLY, {
          workerPath: absoluteAssetUrl('worker.min.js'),
          corePath: absoluteAssetUrl('core'),
          langPath: absoluteAssetUrl('lang'),
          gzip: true,
        });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        return worker;
      })();
      // Se a inicializacao falhar, permite nova tentativa na proxima pagina.
      workerPromise.catch(() => {
        workerPromise = null;
      });
    }
    return workerPromise;
  };

  return {
    async recognizePage(page) {
      const canvas = await renderPageToCanvas(page);
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      // Libera a memoria do bitmap grande.
      canvas.width = 0;
      canvas.height = 0;
      return data.text;
    },
    async dispose() {
      const pending = workerPromise;
      workerPromise = null;
      if (!pending) return;
      try {
        await (await pending).terminate();
      } catch {
        // worker que nem chegou a iniciar: nada a liberar
      }
    },
  };
}
