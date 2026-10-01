# Estudos

Conteúdos de estudo preparados com o Claude, prontos para serem lidos por um app (APK).

## Como funciona

1. Estudamos o assunto na conversa com o Claude.
2. O Claude salva o conteúdo como um arquivo `.json` em `conteudos/<materia>/`.
3. O app lê esses arquivos e mostra as partes, as questões e lê tudo em voz alta.

## Formato de cada arquivo

| Campo | O que é |
|---|---|
| `id`, `materia`, `aula`, `assunto`, `versao` | Identificação do conteúdo (`aula` é o número da aula na matéria) |
| `objetivos` | O que a prova cobra |
| `partes` | Blocos curtos de estudo: `titulo`, `pontos` (frases curtas) e `dica` |
| `questoes` | Perguntas, uma por vez |

### Questões

- `nivel`: tamanho do enunciado (1 = curto, 2 = médio, 3 = longo). Treina interpretação aos poucos.
- `parte` (opcional): índice da parte. A questão aparece logo depois dela, como pergunta rápida. Sem `parte`, vai para o treino de interpretação.
- `tipo`: `aberta`, `vf` (verdadeiro ou falso) ou `multipla`.
- `resposta` (aberta e vf) ou `alternativas` + `correta` (índice começando em 0, só na múltipla).
- `explicacao`: mostrada depois de responder.
- `dica_leitura` (opcional): técnica para ler o enunciado.

## Conteúdos

- [Programação Visual para Web, Aula 1: a história do HTML](conteudos/programacao-visual-web/historia-do-html.json)
- [Programação Visual para Web, Aula 2: evolução do HTML e por que ele existe](conteudos/programacao-visual-web/evolucao-do-html.json)


## App

- `app/index.html`: o app (protótipo). Vai rodar dentro do APK como uma tela web.
- `app/app.js`: a lógica do app.
- `app/build.py`: embute os conteúdos e o `app.js` no `index.html`. Rode depois de qualquer mudança:

```
python3 app/build.py
```

### Sondagem

Ao cadastrar uma matéria, o app pergunta: nome, número de aulas, próxima avaliação e data, última nota e tempo por dia.
Cada aula da matéria precisa ter um conteúdo no app. Aula sem conteúdo conta como **não estudada**.
Uma aula fica **dominada** quando o último resultado é 80% ou mais.

### Modo ouvir

Lê a aula inteira em voz alta: partes, dicas e perguntas. Depois de cada pergunta, espera 6 segundos e fala a resposta.
No APK, a voz vai precisar de um plugin de leitura em voz alta do Android, porque a tela web do Android não tem voz própria.
