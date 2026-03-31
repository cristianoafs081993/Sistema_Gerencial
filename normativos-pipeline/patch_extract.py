import re

filepath = r"c:\Users\crist\OneDrive\Desktop\Obsidian\01 - Projetos\Apps\Sistema_Gerencial\normativos-pipeline\pipeline\extract.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Novos Decretos e Leis no FONTES_PLANALTO
novas_fontes_planalto = """
    {
        "tipo": "decreto",
        "titulo": "Decreto nº 10.947, de 25 de janeiro de 2022",
        "numero": "10947",
        "ano": "2022",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d10947.htm",
        "data_publicacao": "2022-01-25",
    },
    {
        "tipo": "decreto",
        "titulo": "Decreto nº 10.193, de 27 de dezembro de 2019",
        "numero": "10193",
        "ano": "2019",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/D10193.htm",
        "data_publicacao": "2019-12-27",
    },
    {
        "tipo": "lei",
        "titulo": "Lei nº 12.305, de 2 de agosto de 2010",
        "numero": "12305",
        "ano": "2010",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/L12305.htm",
        "data_publicacao": "2010-08-02",
    },
    {
        "tipo": "lei",
        "titulo": "Lei nº 9.784, de 29 de janeiro de 1999",
        "numero": "9784",
        "ano": "1999",
        "url": "https://www.planalto.gov.br/ccivil_03/leis/L9784.htm",
        "data_publicacao": "1999-01-29",
    },
"""

# Novas INs em FONTES_IN
novas_fontes_in = """
    {
        "titulo": "IN SEGES nº 58, de 8 de agosto de 2022",
        "numero": "58",
        "ano": "2022",
        "url": "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/me-n-58-de-8-de-agosto-de-2022-421312386",
        "data_publicacao": "2022-08-08",
    },
    {
        "titulo": "IN SEGES/ME nº 67, de 8 de julho de 2021",
        "numero": "67",
        "ano": "2021",
        "url": "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/me-n-67-de-8-de-julho-de-2021-331002578",
        "data_publicacao": "2021-07-08",
    },
    {
        "titulo": "IN SEGES/ME nº 73, de 30 de setembro de 2022",
        "numero": "73",
        "ano": "2022",
        "url": "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/me-n-73-de-30-de-setembro-de-2022-433436035",
        "data_publicacao": "2022-09-30",
    },
"""

# Injetar as novas fontes no arquivo
planalto_match = re.search(r'FONTES_PLANALTO = \[\n', text)
if planalto_match:
    idx = planalto_match.end()
    text = text[:idx] + novas_fontes_planalto + text[idx:]

in_match = re.search(r'FONTES_IN = \[\n', text)
if in_match:
    idx = in_match.end()
    text = text[:idx] + novas_fontes_in + text[idx:]

# Para o extrator de INs, precisamos tratar links do in.gov.br (Diário Oficial)
# Vamos alterar `extrair_instrucoes_normativas` para funcionar com in.gov.br
codigo_in = '''def extrair_instrucoes_normativas() -> list[Documento]:
    """Extrai Instruções Normativas do portal gov.br."""
    docs = []
    for fonte in FONTES_IN:
        try:
            html = _get_html(fonte["url"])
            soup = BeautifulSoup(html, "html.parser")

            conteudo = (
                soup.find("div", {"id": "content-core"})
                or soup.find("div", class_="documentContent")
                or soup.find("div", class_="texto-dou")
                or soup.find("article")
                or soup.find("main")
            )

            texto = "Falha ao extrair"
            if conteudo:
                for tag in conteudo(["script", "style"]):
                    tag.decompose()
                texto = _limpar_texto(conteudo.get_text(separator="\\n"))
            else:
                 texto = _limpar_texto(soup.get_text(separator="\\n"))

            docs.append(Documento(
                tipo="in",
                titulo=fonte["titulo"],
                numero=fonte["numero"],
                ano=fonte["ano"],
                url_origem=fonte["url"],
                texto=texto,
                data_publicacao=fonte["data_publicacao"],
            ))
            print(f"  ✓ Extraído: {fonte['titulo'][:60]}")

        except Exception as e:
            print(f"  ✗ Erro ao extrair {fonte['titulo'][:60]}: {e}")

    return docs'''

# Substitui a função extrair_instrucoes_normativas inteira
text = re.sub(r'def extrair_instrucoes_normativas.*?return docs', codigo_in, text, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)

print("extract.py modificado com sucesso.")
