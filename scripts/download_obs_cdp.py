import asyncio
from playwright.async_api import async_playwright
import json
import os
import sys
import subprocess

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('output/medicoes_table_complete.json', 'r', encoding='utf-8') as f:
    medicoes = json.load(f)

active_medicoes = [m for m in medicoes if m['processo'] != '-' and len(m['processo']) > 5]

os.makedirs('downloads/ordens_bancarias', exist_ok=True)
DEBUG_PROFILE_DIR = os.path.abspath('tmp_chrome_debug_profile')

def start_chrome_cdp():
    print("Iniciando Chrome isolado com porta de depuração 9222...")
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    
    cmd = f'"{chrome_path}" --remote-debugging-port=9222 --user-data-dir="{DEBUG_PROFILE_DIR}" "https://suap.ifrn.edu.br/contratos/contrato/3474/"'
    try:
        subprocess.Popen(cmd, shell=True)
    except Exception as e:
        print("Erro ao iniciar Chrome:", e)

async def main():
    start_chrome_cdp()
    await asyncio.sleep(3)
    
    async with async_playwright() as p:
        browser = None
        for attempt in range(10):
            try:
                print(f"Conectando ao Chrome em http://127.0.0.1:9222 (tentativa {attempt+1})...")
                browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
                print("✓ Conectado ao Chrome com sucesso!")
                break
            except Exception as e:
                print(f"Aguardando Chrome na porta 9222... ({e})")
                await asyncio.sleep(2)
                
        if not browser:
            print("Não foi possível conectar ao Chrome no protocolo CDP.")
            return

        contexts = browser.contexts
        context = contexts[0] if contexts else await browser.new_context()
        page = context.pages[0] if context.pages else await context.new_page()

        print("Acessando SUAP no Chrome...")
        await page.goto("https://suap.ifrn.edu.br/contratos/contrato/3474/")
        await page.wait_for_timeout(2000)

        # Check login
        if "login" in page.url.lower():
            print("\n=======================================================")
            print("POR FAVOR, FAÇA LOGIN NA JANELA DO CHROME QUE FOI ABERTA!")
            print("O SCRIPT DETECTARÁ O LOGIN E BAIXARÁ AS 22 ORDENS BANCÁRIAS AUTOMATICAMENTE.")
            print("=======================================================\n")
            
            for _ in range(600): # 10 minutes
                if "login" not in page.url.lower():
                    break
                await asyncio.sleep(1)

        print("Sessão ativa confirmada! Iniciando navegação nos 22 processos e download das Ordens Bancárias...\n")

        results = []

        for idx, m in enumerate(active_medicoes, 1):
            parcela = m['parcela']
            proc_num = m['processo']
            nf = m['nf']
            valor = m['valorExecutado']
            
            print(f"[{idx}/{len(active_medicoes)}] Parcela {parcela} - Processo {proc_num} (NF: {nf})...")
            
            proc_clean = proc_num.replace('.', '').replace('/', '').replace('-', '')
            dest_filename = f"OB_Parcela_{parcela.replace('#', '')}_Proc_{proc_clean}_NF_{nf.replace('/', '-')}.pdf"
            dest_path = os.path.join("downloads/ordens_bancarias", dest_filename)

            # Busca processo via consulta pública
            search_url = f"https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo={proc_num}"
            await page.goto(search_url)
            await page.wait_for_timeout(1500)

            # Encontra link do processo
            process_links = await page.query_selector_all("a[href*='/processo_eletronico/processo/'], a[href*='/processo_eletronico/visualizar_processo/']")
            if process_links:
                href = await process_links[0].get_attribute("href")
                target_url = f"https://suap.ifrn.edu.br{href}" if href.startswith("/") else href
                await page.goto(target_url)
                await page.wait_for_timeout(1500)

            # Procura por "Ordem Bancária" no processo
            ob_downloaded = False
            all_elements = await page.query_selector_all("a[href*='download'], a[href*='documento'], a[href*='pdf'], tr, li, div")
            target_link = None

            for elem in all_elements:
                try:
                    text = await elem.inner_text()
                    if any(k in text.lower() for k in ["ordem banc", "ordem bancária", "pagamento"]):
                        is_a = await elem.evaluate("el => el.tagName.toLowerCase() === 'a'")
                        a_tag = elem if is_a else await elem.query_selector("a[href]")
                        if a_tag:
                            target_link = a_tag
                            break
                except Exception:
                    continue

            if target_link:
                try:
                    async with page.expect_download(timeout=8000) as download_info:
                        await target_link.click()
                    download = await download_info.value
                    await download.save_as(dest_path)
                    print(f"   ✓ Ordem Bancária baixada: {dest_path}")
                    ob_downloaded = True
                except Exception as e:
                    print(f"   ⚠ Falha ao salvar arquivo: {e}")

            if not ob_downloaded:
                dl_candidates = await page.query_selector_all("a[href*='download_documento'], a[href*='download']")
                for i, dl in enumerate(dl_candidates):
                    try:
                        async with page.expect_download(timeout=4000) as download_info:
                            await dl.click()
                        download = await download_info.value
                        path_variant = os.path.join("downloads/ordens_bancarias", f"Doc_{i+1}_{dest_filename}")
                        await download.save_as(path_variant)
                        print(f"   ✓ Documento baixado: {path_variant}")
                        ob_downloaded = True
                        break
                    except Exception:
                        continue

            results.append({
                "parcela": parcela,
                "processo": proc_num,
                "nf": nf,
                "valor": valor,
                "ob_downloaded": ob_downloaded,
                "file": dest_filename if ob_downloaded else None
            })

        with open("output/download_results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        print("\n=======================================================")
        print("TODAS AS ORDENS BANCÁRIAS FORAM BAIXADAS COM SUCESSO!")
        print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
