import pandas as pd
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
supabase: Client = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("VITE_SUPABASE_ANON_KEY"))

def debug_links():
    df_links = pd.read_excel("docs/Relatorio (3).xlsx")
    df_links.columns = [c.replace('·', 'ú').replace('Ò', 'õ') for c in df_links.columns]
    
    sheet_empenhos_full = df_links['Número do empenho'].astype(str).str.strip()
    sheet_empenhos = set(s[-12:] for s in sheet_empenhos_full if len(s) >= 12)
    print(f"Unique empenhos (last 12 chars) in sheet: {len(sheet_empenhos)}")
    
    db_empenhos = supabase.table("empenhos").select("numero").execute().data
    db_empenho_nums = set(e['numero'] for e in db_empenhos)
    print(f"Unique empenhos in DB: {len(db_empenho_nums)}")
    
    intersection = sheet_empenhos.intersection(db_empenho_nums)
    print(f"Matching empenhos: {len(intersection)}")
    if intersection:
        print("Sample match:", list(intersection)[0])
    
    if not intersection:
        print("Sample from sheet:", list(sheet_empenhos)[:5])
        print("Sample from DB:", list(db_empenho_nums)[:5])

if __name__ == "__main__":
    debug_links()
