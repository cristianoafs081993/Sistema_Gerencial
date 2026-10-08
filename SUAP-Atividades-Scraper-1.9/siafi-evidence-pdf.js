(function (scope) {
  'use strict';
  // Small local PDF 1.4 writer: each page embeds the original browser JPEG.
  // No canvas recreation of the SIAFI UI, remote library, font or network request.
  const ascii = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ').replace(/[\\()]/g, '\\$&');
  const bytes = value => new TextEncoder().encode(value);
  const join = parts => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
  };
  function buildPdf(pages, record) {
    if (!pages.length) throw new Error('Nenhuma tela foi capturada.');
    const objects = [];
    const add = content => { objects.push(typeof content === 'string' ? bytes(content) : content); return objects.length; };
    const stream = (dictionary, content) => join([bytes(`<< ${dictionary} /Length ${content.length} >>\nstream\n`), content, bytes('\nendstream')]);
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('');
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const kids = [];
    pages.forEach((page, index) => {
      const image = add(stream(`/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.jpeg));
      const width = 841.89, height = 595.28, margin = 24;
      const scale = Math.min((width - margin * 2) / page.width, (height - 100) / page.height);
      const iw = page.width * scale, ih = page.height * scale;
      const content = bytes(`BT /F1 13 Tf ${margin} 570 Td (SIAFI ${record.status === 'complete' ? '' : '- PARCIAL '} - ${ascii(String(page.title).slice(0, 100))}) Tj ET\n` +
        `BT /F1 8 Tf ${margin} 553 Td (UG ${ascii(record.document.ug)} - ${ascii(record.document.year)} ${ascii(record.document.type)} ${ascii(record.document.number)} - ${ascii(record.startedAt)}) Tj ET\n` +
        `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${margin} ${(height - 65 - ih).toFixed(2)} cm /Im0 Do Q\n` +
        `BT /F1 8 Tf ${margin} 26 Td (Captura de tela para conferencia. Nao atesta registro ou pagamento. ${index + 1}/${pages.length}) Tj ET\n`);
      const commands = add(stream('', content));
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im0 ${image} 0 R >> >> /Contents ${commands} 0 R >>`));
    });
    objects[1] = bytes(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] >>`);
    const parts = [bytes('%PDF-1.4\n%SIAGES\n')], offsets = [0];
    let position = parts[0].length;
    objects.forEach((object, index) => { offsets.push(position); const part = join([bytes(`${index + 1} 0 obj\n`), object, bytes('\nendobj\n')]); parts.push(part); position += part.length; });
    const xref = position;
    parts.push(bytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    return join(parts);
  }
  scope.SiagesSiafiEvidencePdf = { buildPdf };
})(globalThis);
