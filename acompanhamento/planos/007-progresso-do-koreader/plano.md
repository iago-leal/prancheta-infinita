---
tipo: plano
id: "007"
titulo: Progresso de leitura com o KOReader
status: em_andamento
criado_em: 2026-11-10
concluido_em:
---

# Plano 007: progresso de leitura com o KOReader

## Objetivo

Continuar no leitor da Prancheta o livro que o autor estava lendo no KOReader do Boox, e o contrário, e fazer o Boox e o computador compartilharem a posição de leitura, que hoje fica só em cada aparelho.

## Por que agora

O plano 006 deixou o leitor confortável no Boox e só espera o teste do autor. Este plano não mexe no código do leitor que está em teste: começa pelo servidor. O KOReader já sincroniza o progresso com um servidor próprio, pelo protocolo KOSync, e reconhece cada livro pelo mesmo resumo parcial que a biblioteca da Prancheta usa.

## Decisões do autor, em 2026-11-10

- O KOReader roda no próprio Boox, que já tem o Tailscale sempre ligado; a Prancheta continua respondendo só pela rede privada.
- Exceção à cifra, só para o progresso de leitura: o KOReader não conhece a chave da cifra, e o progresso dele fica legível na VPS, com o identificador do livro, que é um resumo e não o nome, a posição, a porcentagem, o nome do aparelho e o horário. Os quadros e as marcações continuam cifrados.
- A troca vale nos dois sentidos, em etapas.

## Critério de conclusão do plano

- [ ] No Boox, o autor lê um livro no KOReader, abre o mesmo livro na Prancheta e continua de onde parou; lê mais na Prancheta, volta ao KOReader e continua de lá; e o computador abre o livro na posição a que o Boox chegou.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-servidor-recebe-o-progresso.md) | O servidor recebe e devolve o progresso do KOReader | em_andamento |
| [02](etapas/02-prancheta-abre-onde-o-koreader-parou.md) | A Prancheta abre o livro onde o KOReader parou | em_andamento |
| 03 | A Prancheta envia a posição dela, para o KOReader e para o outro aparelho | pendente |

As etapas 01 e 02 estão implementadas e esperam o teste do autor; a etapa 03 será detalhada com ele antes de começar.

## Riscos

- Nos EPUBs, o KOReader descreve a posição por um caminho próprio, diferente do que a Prancheta usa. A conversão, nas etapas 02 e 03, pode errar por alguns parágrafos; a porcentagem serve de reserva. Nos PDFs, a posição é o número da página, sem conversão.
- O KOReader precisa abrir o mesmo arquivo da biblioteca e reconhecer o livro pelo conteúdo, que é o padrão dele; reconhecendo pelo nome do arquivo, os livros não casam.
- A etapa 01 exige rodar de novo o roteiro de administrador na VPS, para instalar o comando da credencial. A senha aparece no terminal do autor e não pode passar por uma sessão do Claude.
- A credencial do KOSync é mais fraca que a chave de um aparelho, porque o protocolo envia um resumo MD5 da senha; por isso ela só abre o progresso de leitura, e só pela rede privada.
- O servidor de referência do KOSync é AGPL: só o protocolo, descrito em palavras, é aproveitado, e nenhum arquivo dele entra no repositório.

## Fora do escopo

- Trazer para a Prancheta os destaques e as notas feitos no KOReader.
- Estatísticas de leitura.
- Um endereço público para leitores sem Tailscale, como Kindle e Kobo.
