import pandas as pd
import sys

def inspect_excel(file_path):
    print(f"--- Inspecting {file_path} ---")
    try:
        df = pd.read_excel(file_path)
        print("Columns:", df.columns.tolist())
        print("\nFirst 5 rows:")
        print(df.head())
        print("\n")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

if __name__ == "__main__":
    inspect_excel("docs/Relatorio (4).xlsx")
    inspect_excel("docs/Relatorio (3).xlsx")
