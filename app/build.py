"""Embute os conteúdos (conteudos/**/*.json) e o app.js dentro do app/index.html.

Rode depois de adicionar ou mudar um conteúdo:  python3 app/build.py
"""
import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INDEX = RAIZ / "app" / "index.html"
INICIO, FIM = "<!-- GERADO:INICIO", "<!-- GERADO:FIM -->"

conteudos = {}
for arquivo in sorted((RAIZ / "conteudos").rglob("*.json")):
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    conteudos[dados["id"]] = dados

dados_js = json.dumps(conteudos, ensure_ascii=False).replace("</", "<\\/")
app_js = (RAIZ / "app" / "app.js").read_text(encoding="utf-8")

html = INDEX.read_text(encoding="utf-8")
antes = html[: html.index(INICIO)]
depois = html[html.index(FIM) + len(FIM):]
gerado = (
    INICIO + " (não edite; rode python3 app/build.py) -->\n"
    + '<script type="application/json" id="conteudos">' + dados_js + "</script>\n"
    + "<script>\n" + app_js + "</script>\n"
    + FIM
)
INDEX.write_text(antes + gerado + depois, encoding="utf-8")
print(f"{len(conteudos)} conteúdo(s) embutido(s) em {INDEX.relative_to(RAIZ)}")
