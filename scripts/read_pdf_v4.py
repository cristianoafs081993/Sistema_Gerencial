import sys
import importlib
import glob
import os

# Ensure pypdf is installed
try:
    importlib.import_module('pypdf')
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])

from pypdf import PdfReader

def read_pdfs():
    # docs_dir = r"c:\Users\3128880\Desktop\Programação\IFRN\love-execu-o-main\love-execu-o-main\docs"
    # Update to relative path from project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(os.path.dirname(script_dir), "docs")
    output_file = "read_results_v4.txt"
    
    with open(output_file, "w", encoding="utf-8") as out:
        # 1. Search for "15 factors" in Osni's dissertation
        osni_path = os.path.join(docs_dir, "Dissertação versão final Osni Cristiano Reisch.pdf")
        if os.path.exists(osni_path):
            out.write(f"--- Analyzing {os.path.basename(osni_path)} ---\n")
            try:
                reader = PdfReader(osni_path)
                full_text = ""
                for page in reader.pages:
                    full_text += page.extract_text() + "\n"
                
                # Search for the list of factors
                if "15 fatores" in full_text.lower() or "quadro 2" in full_text.lower():
                     out.write("Found mention of '15 fatores' or 'Quadro 2' (Fatores). Extracting context...\n")
                     # Try to find the specific table or list. Usually "Quadro 2" according to ToC
                     # We'll search for "Quadro 2" and print surrounding lines
                     lines = full_text.split('\n')
                     for i, line in enumerate(lines):
                         if "quadro 2" in line.lower() and "fatores" in line.lower():
                             out.write(f"\nMatch at line {i}: {line.strip()}\n")
                             # Print following lines to capture the table content
                             for j in range(i, min(i+50, len(lines))):
                                 out.write(f"{lines[j]}\n")
                             out.write("-" * 20 + "\n")
            except Exception as e:
                out.write(f"Error reading Osni PDF: {e}\n")

        # 2. Search for "Future Works" in all PDFs
        pdf_files = glob.glob(os.path.join(docs_dir, "*.pdf"))
        for f in pdf_files:
            try:
                reader = PdfReader(f)
                num_pages = len(reader.pages)
                out.write(f"\n--- Checking 'Future Work' in {os.path.basename(f)} ---\n")
                
                # Read last 10 pages usually contain Conclusion/Future Work
                last_pages_text = ""
                start_p = max(0, num_pages - 10)
                for i in range(start_p, num_pages):
                    last_pages_text += reader.pages[i].extract_text() + "\n"
                
                # Look for keywords
                keywords = ["trabalhos futuros", "sugestões", "recomendações", "estudos futuros", "novas pesquisas"]
                lines = last_pages_text.split('\n')
                found = False
                for i, line in enumerate(lines):
                    for kw in keywords:
                        if kw in line.lower() and len(line) < 100: # Heading candidate
                            out.write(f"Potential Header Found: {line.strip()}\n")
                            # Print next 20 lines
                            for j in range(i, min(i+20, len(lines))):
                                out.write(f"> {lines[j]}\n")
                            out.write("-" * 20 + "\n")
                            found = True
                            break
                    if found: break # Only print first match per file to avoid noise
            except Exception as e:
                out.write(f"Error reading {os.path.basename(f)}: {e}\n")

if __name__ == "__main__":
    read_pdfs()
