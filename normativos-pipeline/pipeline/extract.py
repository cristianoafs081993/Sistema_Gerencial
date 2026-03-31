"""
extract.py — Extratores de texto por fonte

Fontes suportadas:
  - Planalto (Lei 14.133/2021 + decretos)
  - SEGES/MGI (Instruções Normativas)
  - PDF local (Pareceres PF/IFRN)
"""

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader


@dataclass
class Documento:
    tipo: str          # lei | decreto | in | parecer
    titulo: str
    numero: str
    ano: str
    url_origem: str
    texto: str
    hash_conteudo: str = ""
    data_publicacao: str = ""
    vigente: bool = True
    metadados: dict = field(default_factory=dict)

    def __post_init__(self):
        self.hash_conteudo = hashlib.sha256(self.texto.encode()).hexdigest()


# ── Utilidades ──────────────────────────────────────────────────────────────

def _get_html(url: str, timeout: int = 30) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; NormativosIFRN/1.0)"}
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        r = client.get(url, headers=headers)
        r.raise_for_status()
        return r.text


def _limpar_texto(texto: str) -> str:
    """Remove espaços excessivos e linhas vazias duplicadas."""
    texto = re.sub(r"\r\n", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    texto = re.sub(r"[ \t]{2,}", " ", texto)
    return texto.strip()


# ── Extrator: Planalto ───────────────────────────────────────────────────────

FONTES_PLANALTO = [

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
    {
        "tipo": "lei",
        "titulo": "Lei nº 14.133, de 1º de abril de 2021",
        "numero": "14133",
        "ano": "2021",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
        "data_publicacao": "2021-04-01",
    },
    {
        "tipo": "decreto",
        "titulo": "Decreto nº 11.246, de 27 de outubro de 2022",
        "numero": "11246",
        "ano": "2022",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/D11246.htm",
        "data_publicacao": "2022-10-27",
    },
    {
        "tipo": "decreto",
        "titulo": "Decreto nº 11.531, de 16 de maio de 2023",
        "numero": "11531",
        "ano": "2023",
        "url": "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11531.htm",
        "data_publicacao": "2023-05-16",
    },
]


def extrair_planalto() -> list[Documento]:
    """Extrai leis e decretos do Planalto."""
    docs = []
    for fonte in FONTES_PLANALTO:
        try:
            html = _get_html(fonte["url"])
            soup = BeautifulSoup(html, "html.parser")

            # Remove scripts, estilos e navegação
            for tag in soup(["script", "style", "nav", "header", "footer"]):
                tag.decompose()

            texto = _limpar_texto(soup.get_text(separator="\n"))

            docs.append(Documento(
                tipo=fonte["tipo"],
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

    return docs


# ── Extrator: Instruções Normativas SEGES ────────────────────────────────────

FONTES_IN = [

    {
        "titulo": "Portaria ME nº 7.828, de 30 de agosto de 2022",
        "numero": "7828",
        "ano": "2022",
        "url": "https://www.in.gov.br/en/web/dou/-/portaria-me-n-7.828-de-30-de-agosto-de-2022-426189993",
        "data_publicacao": "2022-08-30",
    },

    {
        "titulo": "IN SEGES nº 58, de 8 de agosto de 2022",
        "numero": "58",
        "ano": "2022",
        "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-seges/me-n-58-de-8-de-agosto-de-2022-421312386",
        "data_publicacao": "2022-08-08",
    },
    {
        "titulo": "IN SEGES/ME nº 67, de 8 de julho de 2021",
        "numero": "67",
        "ano": "2021",
        "url": "https://www.in.gov.br/en/web/dou/-/instrucao-normativa-seges/me-n-67-de-8-de-julho-de-2021-331037740",
        "data_publicacao": "2021-07-08",
    },
    {
        "titulo": "IN SEGES/ME nº 73, de 30 de setembro de 2022",
        "numero": "73",
        "ano": "2022",
        "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-seges-me-n-73-de-30-de-setembro-de-2022-433436035",
        "data_publicacao": "2022-09-30",
    },
    {
        "titulo": "IN SEGES/ME nº 65, de 7 de julho de 2021",
        "numero": "65",
        "ano": "2021",
        "url": "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021",
        "data_publicacao": "2021-07-07",
    },
    {
        "titulo": "IN SEGES/MGI nº 5, de 26 de maio de 2017",
        "numero": "5",
        "ano": "2017",
        "url": "https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/20239255/do1-2017-05-26-instrucao-normativa-n-5-de-26-de-maio-de-2017-20237783",
        "data_publicacao": "2017-05-26",
    },
]


def extrair_instrucoes_normativas() -> list[Documento]:
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

    return docs


# ── Extrator: PDFs locais (PF/IFRN) ─────────────────────────────────────────

def _extrair_texto_pdf(caminho: Path) -> str:
    """Extrai texto de um PDF local."""
    reader = PdfReader(str(caminho))
    paginas = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            paginas.append(t)
    return _limpar_texto("\n\n".join(paginas))


def _inferir_metadados_pdf(nome_arquivo: str) -> dict:
    """
    Tenta inferir tipo, número e ano a partir do nome do arquivo.
    Convenção esperada: TIPO_NUMERO_ANO_descricao.pdf
    Ex: PARECER_001_2023_habilitacao-engenharia.pdf
        NOTA_004_2022_fiscalizacao.pdf
    """
    partes = nome_arquivo.replace(".pdf", "").upper().split("_")
    tipo_map = {"PARECER": "parecer", "NOTA": "parecer", "RESOLUCAO": "resolucao"}

    tipo = tipo_map.get(partes[0], "parecer") if partes else "parecer"
    numero = partes[1] if len(partes) > 1 else "000"
    ano = partes[2] if len(partes) > 2 else "0000"

    return {"tipo": tipo, "numero": numero, "ano": ano}


def extrair_pdfs_locais(pasta: str = "pdfs/pf-ifrn") -> list[Documento]:
    """Extrai texto de todos os PDFs na pasta especificada."""
    caminho_pasta = Path(pasta)
    if not caminho_pasta.exists():
        print(f"  ⚠ Pasta {pasta} não encontrada. Pulando PDFs locais.")
        return []

    pdfs = list(caminho_pasta.glob("*.pdf"))
    if not pdfs:
        print(f"  ⚠ Nenhum PDF encontrado em {pasta}.")
        return []

    docs = []
    for pdf in pdfs:
        try:
            texto = _extrair_texto_pdf(pdf)
            if not texto.strip():
                print(f"  ⚠ PDF sem texto extraível (pode ser escaneado): {pdf.name}")
                continue

            meta = _inferir_metadados_pdf(pdf.name)
            titulo = f"PF/IFRN · {pdf.stem.replace('_', ' ').title()}"

            docs.append(Documento(
                tipo=meta["tipo"],
                titulo=titulo,
                numero=meta["numero"],
                ano=meta["ano"],
                url_origem=f"local://{pdf.name}",
                texto=texto,
                metadados={"arquivo": pdf.name},
            ))
            print(f"  ✓ Extraído: {pdf.name}")

        except Exception as e:
            print(f"  ✗ Erro ao extrair {pdf.name}: {e}")

    return docs
