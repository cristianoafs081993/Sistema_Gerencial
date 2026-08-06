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
        print("Launching browser in visible mode to debug login...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        await page.goto("https://suap.ifrn.edu.br/accounts/login/?next=/contratos/contrato/3474/")
        await page.wait_for_timeout(2000)
        
        print("Filling username...")
        await page.fill("#id_username", USERNAME)
        print("Filling password...")
        await page.fill("#id_password", PASSWORD)
        await page.wait_for_timeout(1000)
        
        print("Clicking submit button...")
        # Press Enter on password field or click submit
        await page.press("#id_password", "Enter")
        
        # Wait up to 10 seconds for navigation
        try:
            await page.wait_for_url("**/contratos/contrato/3474/**", timeout=10000)
            print("LOGIN SUCCESSFUL! Current URL:", page.url)
        except Exception as e:
            print("URL after login attempt:", page.url)
            print("Title:", await page.title())
            # Save screenshot & content
            os.makedirs("output", exist_ok=True)
            await page.screenshot(path="output/login_debug_result.png")
            content = await page.content()
            with open("output/login_debug_result.html", "w", encoding="utf-8") as f:
                f.write(content)
            print("Saved debug screenshot and HTML.")
            
        await page.wait_for_timeout(3000)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
