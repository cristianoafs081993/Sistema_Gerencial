import PyPDF2
file_path = r"C:\Users\crist\Downloads\Decreto 12174.pdf"
try:
    reader = PyPDF2.PdfReader(file_path)
    text = "".join([p.extract_text() or "" for p in reader.pages[:2]])
    print(f"Pages: {len(reader.pages)}")
    print(f"Extracted: {len(text)} chars")
    print(f"Preview: {text[:200]}...")
except Exception as e:
    print(e)
