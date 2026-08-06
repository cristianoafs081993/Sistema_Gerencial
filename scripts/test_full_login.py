import asyncio
from playwright.async_api import async_playwright
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

USERNAME = "3128880"
PASSWORD = "P@lloma2"

async def main():
    async with async_playwright() as p:
        print("Launching browser in visible mode...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        await page.goto("https://suap.ifrn.edu.br/accounts/login/?next=/contratos/contrato/3474/")
        await page.wait_for_timeout(2000)
        
        print("Filling credentials...")
        await page.fill("#id_username", USERNAME)
        await page.fill("#id_password", PASSWORD)
        await page.wait_for_timeout(1000)
        
        print("Submitting login form...")
        await page.click("input[type='submit']")
        await page.wait_for_timeout(4000)
        
        print("URL after 4s:", page.url)
        print("Title:", await page.title())
        
        # Check if error message
        error_elem = await page.query_selector(".errornote, .errorlist, p.error")
        if error_elem:
            print("Error message on page:", await error_elem.inner_text())
            
        os.makedirs("output", exist_ok=True)
        await page.screenshot(path="output/login_result.png")
        html = await page.content()
        with open("output/login_result.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        await page.wait_for_timeout(2000)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
