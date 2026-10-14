// Text extraction only: no canvas, rendering, or evaluation of PDF JavaScript.
import pdfjs from 'npm:pdfjs-dist@3.11.174/build/pdf.js';
export async function pdfPageTexts(bytes:Uint8Array,pages:number):Promise<string[]> {
  if(pages>500)return [];
  let task;
  try {
    task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:false});
    const pdf=await task.promise, texts:string[]=[];
    for(let number=1;number<=pdf.numPages;number++) {
      const page=await pdf.getPage(number),content=await page.getTextContent();
      texts.push(content.items.map((item:{str?:string})=>item.str || '').join(' ').replace(/\s+/g,' ').slice(0,100000));
      page.cleanup();
    }
    return texts;
  } catch {return [];} finally {if(task)await task.destroy().catch(()=>undefined);}
}
