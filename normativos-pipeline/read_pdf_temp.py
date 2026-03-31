import fitz  # (PyMuPDF) if installed, or PyPDF2
import sys
try:
    import PyPDF2
    reader = PyPDF2.PdfReader(r"c:\Users\crist\OneDrive\Desktop\Obsidian\01 - Projetos\Apps\Sistema_Gerencial\normativos-pipeline\pdfs\pf-ifrn\Parecer _52025_Limpeza.pdf")
    text = ""
    for p in reader.pages:
        text += p.extract_text() or ""
    with open("pdf_extracted.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Extracted {len(text)} bytes via PyPDF2")
except Exception as e:
    print(e)
