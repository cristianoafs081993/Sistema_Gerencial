from PyPDF2 import PdfReader
import re

reader = PdfReader('pdfs/pf-ifrn/Parecer _52025_Limpeza.pdf')
text = ""
for p in reader.pages[:15]:
    text += p.extract_text() + "\n"

print("--- RAW TEXT SAMPLE (first 1000 chars) ---")
print(repr(text[:1000]))

print("\n--- ATTEMPTING LIST SPLIT ---")
# Procura itens no formato "1. ", "2. ", "1.1.", "I.", etc.
# Many Pareceres use "1. ", "5. ", etc.
items = re.split(r'\n\s*(\d+(?:\.\d+)*\.|[I|V|X]+\.)\s+', text)
if len(items) > 1:
    for i in range(1, min(len(items), 10), 2):
        print(f"Match item: {items[i]}")
        content = items[i+1][:80].replace("\n", " ")
        print(f" Content: {content}...")
else:
    print("No numbered section split detected.")
