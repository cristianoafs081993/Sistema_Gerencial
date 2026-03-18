import sys
import importlib
import os

# Ensure pypdf is installed
try:
    importlib.import_module('pypdf')
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])

from pypdf import PdfReader

def read_osni():
    # file_path = r"c:\Users\3128880\Desktop\Programação\IFRN\love-execu-o-main\love-execu-o-main\docs\Dissertação versão final Osni Cristiano Reisch.pdf"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(os.path.dirname(script_dir), "docs", "Dissertação versão final Osni Cristiano Reisch.pdf")
    output_file = "read_osni_output.txt"
    
    try:
        reader = PdfReader(file_path)
        with open(output_file, "w", encoding="utf-8") as out:
            out.write(f"--- Reading {file_path} ---\n")
            # Read first 20 pages to get TOC and Intro
            for i in range(min(len(reader.pages), 20)):
                text = reader.pages[i].extract_text()
                out.write(f"\n--- Page {i+1} ---\n")
                out.write(text)
        print(f"Successfully wrote to {output_file}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    read_osni()
