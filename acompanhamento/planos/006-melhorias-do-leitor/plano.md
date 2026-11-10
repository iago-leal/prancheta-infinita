---
tipo: plano
id: "006"
titulo: Melhorias do leitor
status: em_andamento
criado_em: 2026-11-10
concluido_em:
---

# Plano 006: melhorias do leitor

## Objetivo

Deixar o leitor de livros confortável para o uso diário no Boox: o livro à esquerda do quadro, para quem escreve com a mão direita; destaques que se apagam, mudam de estilo e recebem nota ao toque; e uma leitura adequada ao e-ink, com destaques visíveis, viradas de página pelo toque, sumário e busca.

## Por que agora

O plano 005 entregou o leitor e as marcações, e o autor os testou no Boox em 2026-11-09. Do teste saíram dois pedidos, o leitor à esquerda e apagar um destaque tocando nele, e a ideia de aproveitar funções do Readest, um leitor de código aberto. O levantamento do Readest, em [readest.md](readest.md), mostrou que ele é AGPL-3.0-or-later: as funções são implementadas aqui a partir do comportamento descrito em palavras, sem copiar código.

## Critério de conclusão do plano

- [ ] No Boox, o autor lê um livro da biblioteca com o leitor à esquerda do quadro, vira as páginas tocando nas laterais, acha um trecho pela busca e chega a um capítulo pelo sumário, anota um destaque e apaga outro tocando neles, e as mudanças aparecem no computador depois da sincronização.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-leitor-a-esquerda-e-destaques.md) | Leitor à esquerda e destaques editáveis ao toque | em_andamento |
| 02 | Leitura no e-ink: destaques visíveis, toque nas laterais, sumário e busca | pendente |

A etapa 02 será detalhada com o autor antes de começar.

## Riscos

- O toque num destaque depende de como o navegador da casca entrega o toque à página do livro, dentro de um iframe no EPUB; só o teste no Boox confirma.
- Com o leitor à esquerda e o painel dos quadros aberto, sobra pouco quadro na largura do Boox; o painel dos quadros pode ser fechado, e o leitor pode voltar para a direita pelo botão.
- Copiar código do Readest tornaria a Prancheta AGPL; a implementação parte só do levantamento escrito, e nenhum arquivo do Readest entra no repositório.

## Fora do escopo

- Receber no servidor da Prancheta o progresso de leitura do KOReader.
- Escrever à mão sobre a página do livro.
- Trocar a epub.js pela foliate-js.
