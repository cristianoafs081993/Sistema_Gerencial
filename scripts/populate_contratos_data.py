import pandas as pd
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import numpy as np

# Load environment variables
load_dotenv()

SUBAPASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

if not SUBAPASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in .env")
    exit(1)

supabase: Client = create_client(SUBAPASE_URL, SUPABASE_KEY)

import re
from datetime import datetime

def format_date(val):
    if pd.isna(val) or str(val).lower() == 'nan':
        return None
    
    val_str = str(val).strip()
    
    # Extract dates from text if present (handles "Prorrogado de ... para ...")
    # We look for the LAST date mention as it represents the current expiration
    dates = re.findall(r'(\d{2}/\d{2}/\d{4})', val_str)
    if dates:
        val_str = dates[-1]
    
    try:
        # Try standard formats
        for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
            try:
                dt = datetime.strptime(val_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # Fallback to pandas parsing
        return pd.to_datetime(val_str).strftime('%Y-%m-%d')
    except:
        return None

def populate():
    print("--- Starting population process ---")
    today = datetime.now().date()
    
    # 1. Read Relatorio (4).xlsx for basic contract info
    print("Reading docs/Relatorio (4).xlsx...")
    df_contracts = pd.read_excel("docs/Relatorio (4).xlsx")
    
    # Map columns and filter active
    contracts_data = []
    expired_count = 0
    for _, row in df_contracts.iterrows():
        contract_num = str(row['Número']).strip()
        if contract_num and contract_num != 'nan':
            dt_inicio = format_date(row['Data de Início'])
            dt_termino = format_date(row['Data de Término'])
            
            # Filter out expired contracts
            if dt_termino:
                term_date = datetime.strptime(dt_termino, '%Y-%m-%d').date()
                if term_date < today:
                    print(f"Skipping expired contract: {contract_num} (Termino: {dt_termino})")
                    expired_count += 1
                    continue
                    
            contracts_data.append({
                "numero": contract_num,
                "contratada": str(row['Contratada']).strip(),
                "data_inicio": dt_inicio,
                "data_termino": dt_termino
            })
    
    print(f"Found {len(contracts_data)} active contracts in Relatorio (4). Skipped {expired_count} expired ones.")
    
    # Get all current contracts in DB to identify removals
    existing_db_contracts = supabase.table("contratos").select("numero").execute().data
    existing_nums = [c['numero'] for c in existing_db_contracts]
    new_nums = [c['numero'] for c in contracts_data]
    
    to_delete = [n for n in existing_nums if n not in new_nums]
    if to_delete:
        print(f"Deleting {len(to_delete)} contracts no longer in the active report...")
        for n in to_delete:
            supabase.table("contratos").delete().eq("numero", n).execute()

    # Upsert active ones
    print("Upserting contracts to Supabase...")
    for contract in contracts_data:
        res = supabase.table("contratos").upsert(contract, on_conflict="numero").execute()
    
    # 2. Read Relatorio (3).xlsx for values and empenho links
    print("Reading docs/Relatorio (3).xlsx...")
    df_links = pd.read_excel("docs/Relatorio (3).xlsx")
    
    # Relatorio (3) columns: ['Campus', 'Contrato', 'N·mero do empenho', 'CNPJ', 'RazÒo Social da Empresa', 'Valor (R$)', ...]
    # Note: 'N·mero do empenho' might be utf-8/latin1 encoding issue in terminal but pandas usually handles it.
    
    # Fix column names if needed (handle encoding)
    df_links.columns = [c.replace('·', 'ú').replace('Ò', 'õ') for c in df_links.columns]
    
    # Fetch all contracts to get IDs
    contracts_db = supabase.table("contratos").select("id, numero").execute().data
    contract_map = {c['numero']: c['id'] for c in contracts_db}
    
    # Fetch all empenhos to get IDs
    empenhos_db = supabase.table("empenhos").select("id, numero").execute().data
    empenho_map = {e['numero']: e['id'] for e in empenhos_db}
    
    print("Processing links and values...")
    links_to_upsert = []
    contract_values = {} # numero -> max_valor
    
    for _, row in df_links.iterrows():
        c_num = str(row['Contrato']).strip()
        e_num_full = str(row['Número do empenho']).strip()
        e_num = e_num_full[-12:] if len(e_num_full) >= 12 else e_num_full
        valor = row['Valor (R$)']
        
        # Track contract value (assuming the highest value found for a contract number is its total)
        if c_num not in contract_values or valor > contract_values[c_num]:
             contract_values[c_num] = valor
        
        if c_num in contract_map and e_num in empenho_map:
            links_to_upsert.append({
                "contrato_id": contract_map[c_num],
                "empenho_id": empenho_map[e_num]
            })
    
    # Update contract values
    print("Updating contract values...")
    for c_num, valor in contract_values.items():
        if c_num in contract_map:
            supabase.table("contratos").update({"valor": float(valor)}).eq("numero", c_num).execute()
            
    # Upsert links
    print(f"Upserting {len(links_to_upsert)} links to contratos_empenhos...")
    if links_to_upsert:
        # Batch upsert links
        supabase.table("contratos_empenhos").upsert(links_to_upsert, on_conflict="contrato_id,empenho_id").execute()

    print("--- Population complete ---")

if __name__ == "__main__":
    populate()
