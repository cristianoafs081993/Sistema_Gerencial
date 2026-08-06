import asyncio
from playwright.async_api import async_playwright
import json
import os
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

USERNAME = "3128880"
PASSWORD = "P@lloma2"

with open('output/medicoes_table_complete.json', 'r', encoding='utf-8') as f:
    medicoes = json.load(f)

active_medicoes = [m for m in medicoes if m['processo'] != '-' and len(m['processo']) > 5]

print(f"Total de processos para baixar Ordens Bancárias: {len(active_medicoes)}")
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
                el.style.padding = '14px 22px';
                el.style.borderRadius = '8px';
                el.style.fontSize = '18px';
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
        print("Iniciando Chromium em modo visivel (headless=False)...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        print("Acessando página de login do SUAP...")
        await page.goto("https://suap.ifrn.edu.br/accounts/login/?next=/contratos/contrato/3474/")
        await page.wait_for_timeout(2000)
        
        # Fill username and password automatically
        if await page.query_selector("#id_username"):
            print("Preenchendo credenciais automaticamente (3128880)...")
            await page.fill("#id_username", USERNAME)
            await page.fill("#id_password", PASSWORD)
            await page.wait_for_timeout(1000)
            
            print("Submetendo formulário de login...")
            await page.click("input[type='submit']")
            await page.wait_for_timeout(3000)
            
        print("URL atual:", page.url)
        
        # If captcha/2FA is presented, wait for user to complete it in window
        if "login" in page.url.lower():
            print("\n[ATENÇÃO] Se o reCAPTCHA ou 2FA for solicitado, resolva na janela do navegador. O script aguardará até 3 minutos...")
            await update_overlay(page, "Por favor, resolva o Captcha/2FA se solicitado para continuar...")
            
            for _ in range(180):
                if "login" not in page.url.lower():
                    break
                await asyncio.sleep(1)

        if "login" in page.url.lower():
            print("[ERRO] Não foi possível concluir o login. Encerrando.")
            await browser.close()
            return
            
        print("[SUCESSO] Autenticação confirmada! Iniciando downloads...")
        await page.wait_for_timeout(2000)

        results = []

        for idx, m in enumerate(active_medicoes, 1):
            parcela = m['parcela']
            proc_num = m['processo']
            nf = m['nf']
            valor = m['valorExecutado']
            
            status_msg = f"Baixando OB {idx} de {len(active_medicoes)} | Parcela {parcela} ({proc_num})"
            print(f"[{idx}/{len(active_medicoes)}] {status_msg}")
            await update_overlay(page, status_msg)
            
            proc_clean = proc_num.replace('.', '').replace('/', '').replace('-', '')
            dest_filename = f"OB_Parcela_{parcela.replace('#', '')}_Proc_{proc_clean}_NF_{nf.replace('/', '-')}.pdf"
            dest_path = os.path.join("downloads/ordens_bancarias", dest_filename)

            # Search process via consulta_publica
            search_url = f"https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo={proc_num}"
            await page.goto(search_url)
            await page.wait_for_timeout(1500)
            await update_overlay(page, status_msg)
            
            # Find process link
            process_links = await page.query_selector_all("a[href*='/processo_eletronico/processo/'], a[href*='/processo_eletronico/visualizar_processo/']")
            if process_links:
                href = await process_links[0].get_attribute("href")
                target_url = f"https://suap.ifrn.edu.br{href}" if href.startswith("/") else href
                await page.goto(target_url)
                await page.wait_for_timeout(1500)
                await update_overlay(page, status_msg)

            # Download OB
            ob_downloaded = False
            all_elements = await page.query_selector_all("a[href*='download'], a[href*='documento'], a[href*='pdf'], tr, li")
            target_link = None
            
            for elem in all_elements:
                text = await elem.inner_text()
                if any(k in text.lower() for k in ["ordem banc", "ob", "comprovante", "pagamento"]):
                    is_a = await elem.evaluate("el => el.tagName.toLowerCase() === 'a'")
                    a_tag = elem if is_a else await elem.query_selector("a[href]")
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
                    print(f"   ⚠ Falha no download específico: {e}")

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

        await update_overlay(page, "CONCLUÍDO! Todos os downloads foram finalizados com sucesso.")
        print("\n=======================================================")
        print("DOWNLOADS CONCLUÍDOS COM SUCESSO!")
        print("=======================================================")
        await page.wait_for_timeout(4000)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
