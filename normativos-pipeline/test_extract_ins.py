from pipeline.extract import extrair_instrucoes_normativas

docs = extrair_instrucoes_normativas()
for d in docs:
    print(d.titulo)
    print("--------------------------------------------------")
    print(d.texto[:300] if d.texto else "VAZIO!")
    print("\n\n")
