from pathlib import Path
import re
import pdfplumber

root = Path(r"D:\development\mr david\mothercompany\enriveatradingbot\cctv-cleaned")
for path in sorted(root.glob("*-original.pdf")):
    with pdfplumber.open(path) as pdf:
        text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    cfa = re.findall(r"GAINE\s+TECHNIQUE\s+CFA", text, flags=re.I)
    definir = re.findall(r"A\s+D[ÉE]FINIR", text, flags=re.I)
    serveur = re.findall(r"LOCAL\s+SERVEURS?", text, flags=re.I)
    print(f"{path.name}\n  CFA={len(cfa)}  A_DEFINIR={len(definir)}  LOCAL_SERVEURS={len(serveur)}")
    for line in text.splitlines():
        if re.search(r"GAINE|D[ÉE]FINIR|SERVEUR", line, flags=re.I):
            print("   ", line[:250])
