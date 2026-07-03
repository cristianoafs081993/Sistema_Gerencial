import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const SOURCE_IMAGE = 'C:\\Users\\3128880\\.gemini\\antigravity\\brain\\9669a117-ec9e-4551-b01e-6b94671ae6d5\\media__1782818603192.jpg';
const PUBLIC_DIR = 'c:\\Users\\3128880\\Desktop\\Programação\\Sistema_Gerencial\\public';

// Helper to create an ICO file from a 32x32 PNG buffer
function makeIcoFromPng(pngBuffer) {
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0);     // Reserved
  icoHeader.writeUInt16LE(1, 2);     // Type (1 = ICO)
  icoHeader.writeUInt16LE(1, 4);     // Image count (1)
  icoHeader.writeUInt8(32, 6);       // Width
  icoHeader.writeUInt8(32, 7);       // Height
  icoHeader.writeUInt8(0, 8);        // Color count (0 = no palette)
  icoHeader.writeUInt8(0, 9);        // Reserved
  icoHeader.writeUInt16LE(1, 10);    // Planes (1)
  icoHeader.writeUInt16LE(32, 12);   // Bits per pixel (32)
  icoHeader.writeUInt32LE(pngBuffer.length, 14); // Image size
  icoHeader.writeUInt32LE(22, 18);   // Image offset (22 bytes)
  return Buffer.concat([icoHeader, pngBuffer]);
}

async function run() {
  console.log('Carregando imagem original:', SOURCE_IMAGE);
  const image = await Jimp.read(SOURCE_IMAGE);

  console.log('Detectando limites do logotipo (removendo margens brancas)...');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const threshold = 230;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelColor = image.getPixelColor(x, y);
      const r = (pixelColor >> 24) & 0xFF;
      const g = (pixelColor >> 16) & 0xFF;
      const b = (pixelColor >> 8) & 0xFF;
      const avg = (r + g + b) / 3;

      if (avg < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Recortar a imagem rente ao logotipo com uma margem de segurança de 4 pixels
  const pad = 4;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, (maxX - minX) + 2 * pad);
  const cropH = Math.min(height - cropY, (maxY - minY) + 2 * pad);

  console.log(`Recortando imagem de ${width}x${height} para ${cropW}x${cropH} na posição (${cropX}, ${cropY})`);
  image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });

  console.log('Removendo fundo branco com suavização de bordas na imagem recortada...');
  const croppedWidth = image.bitmap.width;
  const croppedHeight = image.bitmap.height;

  for (let y = 0; y < croppedHeight; y++) {
    for (let x = 0; x < croppedWidth; x++) {
      const pixelColor = image.getPixelColor(x, y);
      const r = (pixelColor >> 24) & 0xFF;
      const g = (pixelColor >> 16) & 0xFF;
      const b = (pixelColor >> 8) & 0xFF;
      let a = pixelColor & 0xFF;
      
      const avg = (r + g + b) / 3;

      if (avg >= threshold) {
        a = Math.round(((255 - avg) / (255 - threshold)) * 255);
        const newColor = (((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF)) >>> 0;
        image.setPixelColor(newColor, x, y);
      }
    }
  }

  // Defined outputs
  const targets = [
    { name: 'logo-transparent.png', size: 512 },
    { name: 'govflow-logo.png', size: 512 },
    { name: 'govflow-icon-512.png', size: 512 },
    { name: 'logo-512.png', size: 512 },
    { name: 'govflow-icon-192.png', size: 192 },
    { name: 'logo-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-64.png', size: 64 },
    { name: 'favicon.png', size: 32 }
  ];

  for (const target of targets) {
    console.log(`Gerando ${target.name} (${target.size}x${target.size})...`);
    const resized = image.clone().resize({ w: target.size, h: target.size });
    const outputPath = path.join(PUBLIC_DIR, target.name);
    await resized.write(outputPath);
  }

  // Generate favicon.ico from favicon.png (32x32)
  console.log('Gerando favicon.ico...');
  const faviconPngPath = path.join(PUBLIC_DIR, 'favicon.png');
  const pngBuffer = fs.readFileSync(faviconPngPath);
  const icoBuffer = makeIcoFromPng(pngBuffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

  console.log('Processamento concluído com sucesso!');
}

run().catch(err => {
  console.error('Erro durante o processamento da imagem:', err);
});
