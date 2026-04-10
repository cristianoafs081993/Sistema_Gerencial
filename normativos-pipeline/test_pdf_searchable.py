import PyPDF2
import sys

file_path = r"C:\Users\crist\Downloads\Lei 14.133-2021.pdf"
try:
    reader = PyPDF2.PdfReader(file_path)
    text = ""
    # Check first 5 pages
    for i in range(min(5, len(reader.pages))):
        page_text = reader.pages[i].extract_text() or ""
        text += page_text
    
    print(f"Total Pages: {len(reader.pages)}")
    print(f"Extracted from first 5 pages: {len(text)} characters")
    if len(text.strip()) < 100:
        print("ALERT: PDF seems to be an image/scanned. Text extraction failed.")
    else:
        print("SUCCESS: PDF is searchable.")
        print(f"Preview: {text[:200]}...")
except Exception as e:
    print(f"Error: {e}")
