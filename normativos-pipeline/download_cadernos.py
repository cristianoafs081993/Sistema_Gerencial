"""
Download dos Cadernos de Logística do Portal de Compras Governamentais
e testa se o texto é extraível (PDF searchable vs imagem escaneada).
"""

import httpx
import PyPDF2
from pathlib import Path
import sys

DESTINO = Path(r"c:\Users\crist\OneDrive\Desktop\Obsidian\01 - Projetos\Apps\Sistema_Gerencial\normativos-pipeline\pdfs\pf-ifrn")

CADERNOS = [
    {
        "nome": "CADERNO_Transportes_SEGES.pdf",
        "url": "https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_transportes.pdf",
        "titulo": "Caderno de Logística — Serviços de Transporte",
    },
    {
        "nome": "CADERNO_Vigilancia_SEGES.pdf",
        "url": "https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_vigilancia.pdf",
        "titulo": "Caderno de Logística — Serviços de Vigilância",
    },
    {
        "nome": "CADERNO_Limpeza_SEGES.pdf",
        "url": "https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica/midia/servicos_limpeza.pdf",
        "titulo": "Caderno de Logística — Serviços de Limpeza e Conservação",
    },
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/pdf,*/*",
    "Referer": "https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica",
}


def testar_pdf(caminho: Path) -> tuple[bool, int, str]:
    """Retorna (legivel, paginas, preview)"""
    try:
        reader = PyPDF2.PdfReader(str(caminho))
        paginas = len(reader.pages)
        texto = ""
        for p in reader.pages[:3]:
            texto += p.extract_text() or ""
        legivel = len(texto.strip()) > 100
        preview = texto[:200].replace("\n", " ") if legivel else "(imagem escaneada)"
        return legivel, paginas, preview
    except Exception as e:
        return False, 0, str(e)


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    print(f"\n{'='*60}")
    print("Download dos Cadernos de Logística — gov.br/compras")
    print(f"{'='*60}\n")

    sucesso = []
    falha = []

    with httpx.Client(timeout=60, follow_redirects=True, headers=HEADERS) as client:
        for caderno in CADERNOS:
            caminho = DESTINO / caderno["nome"]
            print(f"⬇  Baixando: {caderno['titulo'][:50]}...")
            try:
                r = client.get(caderno["url"])
                r.raise_for_status()

                # Verifica se é um PDF de verdade
                if b"%PDF" not in r.content[:10]:
                    print(f"   ❌ Resposta não é um PDF válido (HTTP {r.status_code})")
                    falha.append(caderno["nome"])
                    continue

                caminho.write_bytes(r.content)
                tamanho_kb = len(r.content) / 1024
                legivel, paginas, preview = testar_pdf(caminho)

                status = "✅ Texto OK" if legivel else "⚠️  Imagem/escaneado"
                print(f"   {status} | {paginas} páginas | {tamanho_kb:.0f} KB")
                print(f"   Preview: {preview[:120]}")
                sucesso.append(caderno["nome"])

            except httpx.HTTPStatusError as e:
                print(f"   ❌ HTTP {e.response.status_code}")
                falha.append(caderno["nome"])
            except Exception as e:
                print(f"   ❌ Erro: {e}")
                falha.append(caderno["nome"])

    print(f"\n{'='*60}")
    print(f"✅ Baixados com sucesso: {len(sucesso)}")
    print(f"❌ Falhas: {len(falha)}")
    if sucesso:
        print("\nPDFs prontos na pasta:")
        for f in sucesso:
            print(f"  • {f}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
