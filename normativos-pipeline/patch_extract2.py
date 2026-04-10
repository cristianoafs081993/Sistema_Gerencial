import re

filepath = r"c:\Users\crist\OneDrive\Desktop\Obsidian\01 - Projetos\Apps\Sistema_Gerencial\normativos-pipeline\pipeline\extract.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

novas_fontes_planalto = """
    {
        "tipo": "lei",
        "titulo": "Lei nº 10.520, de 17 de julho de 2002",
        "numero": "10520",
        "ano": "2002",
        "url": "https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm",
        "data_publicacao": "2002-07-17",
    },
    {
        "tipo": "lei",
        "titulo": "Lei nº 12.462, de 4 de agosto de 2011",
        "numero": "12462",
        "ano": "2011",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12462.htm",
        "data_publicacao": "2011-08-04",
    },
"""

novas_fontes_in = """
    {
        "titulo": "Portaria ME nº 7.828, de 30 de agosto de 2022",
        "numero": "7828",
        "ano": "2022",
        "url": "https://www.in.gov.br/en/web/dou/-/portaria-sg/me-n-7.828-de-30-de-agosto-de-2022-426117950",
        "data_publicacao": "2022-08-30",
    },
"""

planalto_match = re.search(r'FONTES_PLANALTO = \[\n', text)
if planalto_match:
    idx = planalto_match.end()
    text = text[:idx] + novas_fontes_planalto + text[idx:]

in_match = re.search(r'FONTES_IN = \[\n', text)
if in_match:
    idx = in_match.end()
    text = text[:idx] + novas_fontes_in + text[idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)

print("extract.py modificado com as fontes finais.")
