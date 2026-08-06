import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        print("Acessando página do processo no SUAP...")
        # Search via process search input
        await page.goto("https://suap.ifrn.edu.br/processo_eletronico/consulta_publica/?numero_protocolo=23035.000066.2025-64")
        await page.wait_for_timeout(3000)
        
        print("Current URL:", page.url)
        content = await page.content()
        with open("output/debug_process_page.html", "w", encoding="utf-8") as f:
            f.write(content)
        await page.screenshot(path="output/debug_process_page.png")
        print("Saved debug_process_page.html and PNG")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
