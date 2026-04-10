"""
run.py — Orquestrador da pipeline de ingestão de normativos

Uso:
  python run.py                  # ingere todas as fontes
  python run.py --setup          # imprime o SQL de setup do Supabase
  python run.py --fonte planalto # ingere apenas uma fonte
  python run.py --fonte ins
  python run.py --fonte pdfs

Fontes disponíveis: planalto | ins | pdfs
"""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import track
from rich.table import Table

load_dotenv()

from pipeline.extract import extrair_planalto, extrair_instrucoes_normativas, extrair_pdfs_locais, Documento
from pipeline.process import configurar_google_ai, chunkar_documento, gerar_embeddings
from pipeline.ingest import (
    get_supabase, hash_ja_ingerido, upsert_normativo,
    upsert_chunks, registrar_log, imprimir_setup_sql
)

console = Console()


# ── Processamento de um documento ────────────────────────────────────────────

def processar_documento(sb, doc: Documento) -> dict:
    """Processa um único documento: verifica hash, chunka, embeda e ingere."""

    # 1. Verifica se já foi ingerido (deduplicação por hash)
    normativo_id_existente = hash_ja_ingerido(sb, doc.hash_conteudo)
    if normativo_id_existente:
        registrar_log(sb, normativo_id_existente, doc.titulo, "ignorado",
                      mensagem="Hash já existe — documento não alterado.")
        return {"status": "ignorado", "titulo": doc.titulo}

    # 2. Chunking
    chunks = chunkar_documento(doc)
    if not chunks:
        registrar_log(sb, None, doc.titulo, "erro", mensagem="Nenhum chunk gerado.")
        return {"status": "erro", "titulo": doc.titulo, "msg": "sem chunks"}

    # 3. Embeddings
    chunks_com_embeddings = gerar_embeddings(chunks)

    # 4. Upsert normativo
    normativo_id = upsert_normativo(sb, doc)

    # 5. Upsert chunks
    total_chunks = upsert_chunks(sb, normativo_id, chunks_com_embeddings)

    # 6. Log
    registrar_log(sb, normativo_id, doc.titulo, "sucesso", chunks_gerados=total_chunks)

    return {"status": "sucesso", "titulo": doc.titulo, "chunks": total_chunks}


# ── Runner principal ──────────────────────────────────────────────────────────

def rodar_pipeline(fonte: str = "todas"):
    console.print(Panel.fit(
        "[bold green]ContratoIFRN — Pipeline de Normativos[/]\n"
        f"Fonte: [cyan]{fonte}[/]",
        border_style="green"
    ))

    # Configura Google AI
    try:
        configurar_google_ai()
        console.print("✓ Google AI configurado\n")
    except ValueError as e:
        console.print(f"[red]✗ {e}[/]")
        sys.exit(1)

    # Conecta ao Supabase
    try:
        sb = get_supabase()
        console.print("✓ Supabase conectado\n")
    except ValueError as e:
        console.print(f"[red]✗ {e}[/]")
        sys.exit(1)

    # Extração por fonte
    documentos: list[Documento] = []

    if fonte in ("todas", "planalto"):
        console.print("[bold]📥 Extraindo Planalto (leis e decretos)...[/]")
        documentos += extrair_planalto()

    if fonte in ("todas", "ins"):
        console.print("\n[bold]📥 Extraindo Instruções Normativas SEGES...[/]")
        documentos += extrair_instrucoes_normativas()

    if fonte in ("todas", "pdfs"):
        console.print("\n[bold]📥 Extraindo PDFs locais (PF/IFRN)...[/]")
        documentos += extrair_pdfs_locais("pdfs/pf-ifrn")

    if not documentos:
        console.print("[yellow]Nenhum documento extraído.[/]")
        return

    console.print(f"\n[bold]{len(documentos)} documentos extraídos. Iniciando processamento...[/]\n")

    # Processamento
    resultados = []
    for doc in documentos:
        console.print(f"[dim]Processando:[/] {doc.titulo[:70]}")
        resultado = processar_documento(sb, doc)
        resultados.append(resultado)

        status_icon = {"sucesso": "✅", "ignorado": "⏭", "erro": "❌"}.get(resultado["status"], "?")
        info = f"({resultado.get('chunks', '')} chunks)" if resultado["status"] == "sucesso" else resultado.get("msg", "")
        console.print(f"  {status_icon} {resultado['status'].upper()} {info}\n")

    # Resumo
    table = Table(title="Resumo da ingestão", show_header=True, header_style="bold green")
    table.add_column("Status", style="cyan")
    table.add_column("Quantidade", justify="right")

    sucessos  = sum(1 for r in resultados if r["status"] == "sucesso")
    ignorados = sum(1 for r in resultados if r["status"] == "ignorado")
    erros     = sum(1 for r in resultados if r["status"] == "erro")
    total_chunks = sum(r.get("chunks", 0) for r in resultados)

    table.add_row("✅ Ingeridos", str(sucessos))
    table.add_row("⏭  Ignorados (sem alteração)", str(ignorados))
    table.add_row("❌ Erros", str(erros))
    table.add_row("📦 Total de chunks gerados", str(total_chunks))

    console.print(table)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline de ingestão de normativos")
    parser.add_argument("--setup", action="store_true", help="Imprime o SQL de setup do Supabase")
    parser.add_argument("--fonte", default="todas", choices=["todas", "planalto", "ins", "pdfs"],
                        help="Fonte a ingerir (padrão: todas)")
    args = parser.parse_args()

    if args.setup:
        imprimir_setup_sql()
    else:
        rodar_pipeline(fonte=args.fonte)
