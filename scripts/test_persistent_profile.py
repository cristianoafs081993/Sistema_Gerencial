import asyncio
from playwright.async_api import async_playwright
import os
import shutil
import subprocess

user_profile = os.environ['USERPROFILE']
chrome_user_data = os.path.join(user_profile, r'AppData\Local\Google\Chrome\User Data')
temp_profile = os.path.abspath('tmp_playwright_chrome_profile')

print("Copying Chrome profile for persistent context...")
if os.path.exists(temp_profile):
    try:
        shutil.rmtree(temp_profile, ignore_errors=True)
    except Exception:
        pass

# Use robocopy to copy profile ignoring locked files
cmd = f'robocopy "{chrome_user_data}" "{temp_profile}" /E /XF lockfile *.ldb /NDL /NFL /NJH /NJS'
subprocess.run(cmd, shell=True)

async def main():
    async with async_playwright() as p:
        print("Launching persistent context from copied Chrome profile...")
        try:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=temp_profile,
                headless=False,
                channel="chrome",
                accept_downloads=True
            )
            page = await context.new_page()
            
            print("Navigating to https://suap.ifrn.edu.br/contratos/contrato/3474/...")
            await page.goto("https://suap.ifrn.edu.br/contratos/contrato/3474/")
            await asyncio.sleep(3)
            
            print("Current URL:", page.url)
            print("Title:", await page.title())
            
            await context.close()
        except Exception as e:
            print("Error launching persistent context:", e)

if __name__ == "__main__":
    asyncio.run(main())
