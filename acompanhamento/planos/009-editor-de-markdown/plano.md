---
tipo: plano
id: "009"
titulo: Editor de markdown completo nos cartões
status: concluido
criado_em: 2026-11-11
concluido_em: 2026-11-11
---

# Plano 009: editor de markdown completo nos cartões

## Objetivo

Escrever nos cartões com toda a marcação do GitHub, vendo-a formatada enquanto se escreve, com recuo pelo Tab e com imagens dentro do cartão.

## Por que agora

O autor pediu, em 2026-11-11, que a edição de markdown dentro dos cartões fosse completa, igual à do GitHub, mas já pré-visualizando conforme se escreve; que o cartão aceitasse imagens; e que o Tab fizesse recuo, o que não acontecia. Até aqui, só o começo de cada linha virava título, tópico, tarefa ou citação durante a edição, e o resto da marcação só aparecia formatado depois de sair do cartão.

## Decisões, em 2026-11-11

- O autor pediu o Fable 5.2 como conselheiro. Comparadas três saídas, a pré-visualização dentro do editor atual, o CodeMirror 6 empacotado e a conversão da marcação em formatação ao fechar o marcador, o conselheiro e esta sessão recomendaram a primeira: o formato gravado não muda, e os cartões antigos, `marcacoes.js` e um aparelho uma versão atrás continuam funcionando; o CodeMirror somaria uns 450 KB e trocaria o formato dos cartões, e a conversão perderia a marcação que não tem elemento próprio.
- Os marcadores ficam visíveis só na linha do cursor, como no modo de pré-visualização do Obsidian; nas outras linhas, a marcação aparece formatada.
- O recuo é o campo `n` de cada linha, de 1 a 6, e vale para todos os tipos de linha; numa linha de código, o Tab põe dois espaços.
- A imagem no cartão é uma linha `![descrição](/_blob/<id>)`, com o arquivo guardado no aparelho pelo mesmo caminho das imagens soltas no quadro, e por isso sincronizado e cifrado como elas. Endereços de fora ficam como link, sem requisição externa.

## Critério de conclusão do plano

- [x] No Boox e no computador, o autor escreve num cartão com negrito, uma lista com recuo pelo Tab, uma tabela e uma imagem, vê a marcação formatada enquanto escreve e encontra o cartão igual no outro aparelho, depois da sincronização.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-pre-visualizacao.md) | A marcação formatada enquanto se escreve | concluida |
| [02](etapas/02-recuo.md) | Recuo com Tab e listas aninhadas | concluida |
| [03](etapas/03-imagens-no-cartao.md) | Imagens dentro do cartão | concluida |

## Riscos

- Redesenhar linhas de um campo editável atrapalha os teclados que compõem palavras, como o do Android e o do iPad. O editor não redesenha durante a composição e só toca numa linha quando a forma dela muda; o teste com o teclado de verdade fica com o autor.
- O redesenho desfaz a pilha de desfazer do navegador. O editor tem um desfazer próprio, por pausa de digitação, que responde ao Ctrl+Z, ao Ctrl+Shift+Z e aos comandos de desfazer do sistema.
- Um aparelho uma versão atrás mostra a marcação nova como texto e, se editar o cartão, perde o recuo. Basta atualizar a casca e a página antes de usar.
- A tabela, na edição, é desenhada linha a linha, e não como tabela de verdade; as colunas são alinhadas pela largura medida do texto.

## Fora do escopo

- Tabela editável célula a célula, realce de sintaxe no código, alça para redimensionar a imagem e imagens de endereços de fora.
- HTML dentro do cartão, notas de rodapé, links por referência, títulos sublinhados, fórmulas e diagramas.
- Listas e citações dentro de citações, e arrastar linhas para reordená-las.

## Resultado

Concluído em 2026-11-11, com as três etapas concluídas. O critério do plano foi verificado pelo autor, que confirmou ter testado no Boox e no computador, inclusive a sincronização de um cartão com imagem, e que deu tudo certo.
