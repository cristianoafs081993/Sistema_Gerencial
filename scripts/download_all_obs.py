import asyncio
from playwright.async_api import async_playwright
import json
import os

with open('output/medicoes_table_complete.json', 'r', encoding='utf-8') as f:
    medicoes = json.load(f)

active_medicoes = [m for m in medicoes if m['processo'] != '-' and len(m['processo']) > 5]

print(f"Total active process entries to download: {len(active_medicoes)}")
os.makedirs('downloads/ordens_bancarias', exist_ok=True)

STATE_FILE = 'output/suap_auth_state.json'

async def update_overlay(page, text):
    try:
        await page.evaluate(f"""
            let el = document.getElementById('py-overlay-msg');
            if (!el) {{
                el = document.createElement('div');
                el.id = 'py-overlay-msg';
                el.style.position = 'fixed';
                el.style.top = '10px';
                el.style.right = '10px';
                el.style.zIndex = '999999';
                el.style.background = '#0066cc';
                el.style.color = '#fff';
                el.style.padding = '12px 20px';
                el.style.borderRadius = '8px';
                el.style.fontSize = '16px';
                el.style.fontWeight = 'bold';
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                document.body.appendChild(el);
            }}
            el.innerText = `{text}`;
        """)
    except Exception:
        pass

async def main():
    async with async_playwright() as p:
        print("Launching Chromium browser (headless=False)...")
        browser = await p.chromium.launch(headless=False)
        
        context_kwargs = {"accept_downloads": True}
        if os.path.exists(STATE_FILE):
            print("Found saved auth state, reusing session...")
            context_kwargs["storage_state"] = STATE_FILE
            
        context = await browser.new_context(**context_kwargs)
        page = await context.new_page()
        
        # Go to contract page
        await page.goto("https://suap.ifrn.edu.br/contratos/contrato/3474/")
        await page.wait_for_timeout(2000)
        
        # Check if login is required
        if "login" in page.url.lower():
            print("\n=======================================================")
            print("POR FAVOR, FAÇA LOGIN NA JANELA DO NAVEGADOR (AGUARDANDO ATÉ 10 MINUTOS)...")
            print("=======================================================\n")
            
            logged_in = False
            for _ in range(600): # 10 minutes timeout
                if "login" not in page.url.lower():
                    logged_in = True
                    break
                await asyncio.sleep(1)
                
            if not logged_in:
                print("Tempo limite de login excedido. Encerrando.")
                await browser.close()
                return

        print("Login verificado com sucesso!")
        # Save storage state for future runs
        try:
            await context.storage_state(path=STATE_FILE)
            print("Sessão salva em", STATE_FILE)
        except Exception as e:
            print("Aviso: Não foi possível salvar estado da sessão:", e)
            
        await page.wait_for_timeout(2000)

        results = []

        for idx, m in enumerate(active_medicoes, 1):
            parcela = m['parcela']
            proc_num = m['processo']
            nf = m['nf']
            valor = m['valorExecutado']
            
            status_text = f"Baixando OB {idx} de {len(active_medicoes)} | Parcela {parcela} ({proc_num})"
            print(f"[{idx}/{len(active_medicoes)}] {status_text}")
            await update_overlay(page, status_text)
            
            proc_clean = proc_num.replace('.', '').replace('/', '').replace('-', '')
            dest_filename = f"OB_Parcela_{parcela.replace('#', '')}_Proc_{proc_clean}_NF_{nf.replace('/', '-')}.pdf"
            dest_path = os.path.join("downloads/ordens_bancarias", dest_filename)

            # Option A: Search via process search page
            search_url = f"https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo={proc_num}"
            await page.goto(search_url)
            await page.wait_for_timeout(1500)
            await update_overlay(page, status_text)
            
            # Find links to process
            process_links = await page.query_selector_all("a[href*='/processo_eletronico/processo/'], a[href*='/processo_eletronico/visualizar_processo/']")
            if process_links:
                href = await process_links[0].get_attribute("href")
                target_url = f"https://suap.ifrn.edu.br{href}" if href.startswith("/") else href
                await page.goto(target_url)
                await page.wait_for_timeout(1500)
                await update_overlay(page, status_text)

            # Search for download buttons on process page
            ob_downloaded = False

            # Look for link containing 'Ordem Bancaria' or 'OB'
            all_links = await page.query_selector_all("a[href*='download'], a[href*='documento'], a[href*='pdf'], tr, li")
            target_link = None
            
            for elem in all_links:
                text = await elem.inner_text()
                if any(k in text.lower() for k in ["ordem banc", "ob", "comprovante", "pagamento"]):
                    a_tag = elem if elem.tag_name.lower() == 'a' else await elem.query_selector("a[href]")
                    if a_tag:
                        target_link = a_tag
                        break

            if target_link:
                try:
                    async with page.expect_download(timeout=8000) as download_info:
                        await target_link.click()
                    download = await download_info.value
                    await download.save_as(dest_path)
                    print(f"   ✓ Ordem Bancária salva: {dest_path}")
                    ob_downloaded = True
                except Exception as e:
                    print(f"   ⚠ Falha ao baixar link específico: {e}")

            # Fallback: Download any available document PDF on the page
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

        await update_overlay(page, "CONCLUÍDO! Todos os downloads foram processados.")
        print("\n=======================================================")
        print("TODOS OS DOWNLOADS CONCLUÍDOS!")
        print("=======================================================")
        await page.wait_for_timeout(5000)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
