import asyncio
from playwright.async_api import async_playwright
import json
import os

async def main():
    async with async_playwright() as p:
        print("Launching browser in visible mode (headless=False)...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        url = "https://suap.ifrn.edu.br/contratos/contrato/3474/"
        print(f"Navigating to {url}...")
        await page.goto(url)
        
        # Check if login page or contract page
        title = await page.title()
        print("Page title:", title)
        print("Page URL:", page.url)
        
        # Wait up to 60 seconds if user needs to log in
        if "login" in page.url.lower() or "Login" in title:
            print("Waiting for login... Please log in in the opened browser window if needed.")
            try:
                # Wait until URL changes back to contrato or contains /contratos/contrato/3474/
                await page.wait_for_url("**/contratos/contrato/3474/**", timeout=60000)
                print("Logged in successfully! Current URL:", page.url)
            except Exception as e:
                print("Timeout waiting for login or navigation:", e)
                
        # Take a screenshot to inspect page state
        os.makedirs("output", exist_ok=True)
        await page.screenshot(path="output/suap_contrato_page.png", full_page=True)
        print("Saved screenshot to output/suap_contrato_page.png")
        
        # Save HTML content
        content = await page.content()
        with open("output/suap_contrato_page.html", "w", encoding="utf-8") as f:
            f.write(content)
        print("Saved HTML to output/suap_contrato_page.html")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
