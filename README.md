# Estudos

Conteúdos de estudo preparados com o Claude, prontos para serem lidos por um app (APK).

## Como funciona

1. Estudamos o assunto na conversa com o Claude.
2. O Claude salva o conteúdo como um arquivo `.json` em `conteudos/<materia>/`.
3. O app lê esses arquivos e mostra as partes, as questões e lê tudo em voz alta.

## Formato de cada arquivo

| Campo | O que é |
|---|---|
| `id`, `materia`, `assunto`, `versao` | Identificação do conteúdo |
| `objetivos` | O que a prova cobra |
| `partes` | Blocos curtos de estudo: `titulo`, `pontos` (frases curtas) e `dica` |
| `questoes` | Perguntas, uma por vez |

### Questões

- `nivel`: tamanho do enunciado (1 = curto, 2 = médio, 3 = longo). Treina interpretação aos poucos.
- `tipo`: `aberta`, `vf` (verdadeiro ou falso) ou `multipla`.
- `resposta` (aberta e vf) ou `alternativas` + `correta` (índice começando em 0, só na múltipla).
- `explicacao`: mostrada depois de responder.
- `dica_leitura` (opcional): técnica para ler o enunciado.

## Conteúdos

- [HTML: a história do HTML](conteudos/html/historia-do-html.json)


## App

`app/index.html` é o protótipo do app (layout e fluxo da sessão). Ele vai rodar dentro do APK como uma tela web.
