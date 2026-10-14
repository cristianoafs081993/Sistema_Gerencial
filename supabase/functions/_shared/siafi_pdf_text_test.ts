import {PDFDocument,StandardFonts} from 'npm:pdf-lib@1.17.1';
import {pdfPageTexts} from './siafi_pdf_text.ts';
Deno.test('PDF: verifica citações na página original sem renderizar ou executar scripts',async()=>{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('NF 123 - Valor autorizado 100,00',{font});
  pdf.addPage().drawText('Banco 001 - Agencia 0012 - Conta 00123-X',{font});
  const texts=await pdfPageTexts(await pdf.save(),2);
  if(texts.length!==2 || !texts[0].includes('Valor autorizado 100,00') || !texts[1].includes('00123-X'))throw new Error('Texto ou paginação do PDF não preservados.');
});
