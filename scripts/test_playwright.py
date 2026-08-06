import asyncio
from playwright.async_api import async_playwright
import json
import os

async def main():
    async with async_playwright() as p:
        print("Launching browser...")
        # Try launching msedge or chromium
        try:
            browser = await p.chromium.launch(headless=False, channel="msedge")
        except Exception as e:
            print("Edge launch failed, trying chromium standard:", e)
            browser = await p.chromium.launch(headless=False)
            
        context = await browser.new_context()
        page = await context.new_page()
        
        # Load page
        await page.goto("https://suap.ifrn.edu.br/contratos/contrato/3474/")
        await asyncio.sleep(2)
        print("Current URL:", page.url)
        print("Page Title:", await page.title())
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
