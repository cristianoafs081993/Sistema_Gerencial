(function (scope) {
  'use strict';
  // Small local PDF 1.4 writer: each page embeds the original browser JPEG.
  // No canvas recreation of the SIAFI UI, remote library, font or network request.
  const bytes = value => new TextEncoder().encode(value);
  const join = parts => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
  };
  function buildPdf(pages) {
    if (!pages.length) throw new Error('Nenhuma tela foi capturada.');
    const objects = [];
    const add = content => { objects.push(typeof content === 'string' ? bytes(content) : content); return objects.length; };
    const stream = (dictionary, content) => join([bytes(`<< ${dictionary} /Length ${content.length} >>\nstream\n`), content, bytes('\nendstream')]);
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('');
    const kids = [];
    pages.forEach(page => {
      const image = add(stream(`/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.jpeg));
      const width = 841.89, margin = 0;
      const scale = (width - margin * 2) / page.width;
      const height = page.height * scale + margin * 2;
      const iw = page.width * scale, ih = page.height * scale;
      const content = bytes(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${margin} ${margin} cm /Im0 Do Q\n`);
      const commands = add(stream('', content));
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${commands} 0 R >>`));
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
