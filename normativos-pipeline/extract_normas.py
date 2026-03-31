import re
import sys

try:
    with open('parecer_txt.txt', encoding='utf-8') as f:
        texto = f.read()

    normas = re.findall(r'(?:Lei|Decreto|IN|Instrução Normativa|Portaria|IN SEGES|Orientação Normativa)[ \wºn.,-]+?\d{4}', texto, re.I)
    
    unique_normas = sorted(list(set(normas)))
    with open('normas_encontradas.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(unique_normas))
        
    print(f"Encontrou {len(unique_normas)} normas diferentes.")
except Exception as e:
    print(e)
