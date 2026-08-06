import urllib.request
from bs4 import BeautifulSoup
import json
import os

url = "https://suap.ifrn.edu.br/contratos/contrato_publico/3474/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

os.makedirs('output', exist_ok=True)
with open('output/contrato_publico_3474.html', 'w', encoding='utf-8') as f:
    f.write(html)

soup = BeautifulSoup(html, 'html.parser')

print("Page Title:", soup.title.string if soup.title else "")

# Find all accordions or sections
accordions = soup.find_all('div', class_='accordion')
print(f"Found {len(accordions)} accordions:")
for acc in accordions:
    button = acc.find('button')
    title = button.get_text(strip=True) if button else "No Title"
    print(" - Section:", title)
    # Check tables in this accordion
    tables = acc.find_all('table')
    print(f"   Tables count: {len(tables)}")
    for i, t in enumerate(tables):
        headers = [th.get_text(strip=True) for th in t.find_all('th')]
        rows = []
        for tr in t.find_all('tr'):
            tds = [td.get_text(strip=True) for td in tr.find_all('td')]
            if tds:
                rows.append(tds)
        print(f"   Table {i+1} headers:", headers)
        print(f"   Table {i+1} rows count:", len(rows))
