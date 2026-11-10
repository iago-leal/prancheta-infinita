---
tipo: etapa
plano: "007"
etapa: "01"
titulo: "O servidor recebe e devolve o progresso do KOReader"
status: em_andamento
depende_de: []
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 01: o servidor recebe e devolve o progresso do KOReader

## Objetivo

Fazer o servidor da Prancheta falar o protocolo KOSync, para o KOReader do Boox gravar nele até onde o autor leu cada livro e ler de volta, com uma credencial própria e sem tocar nos quadros.

## Critérios de conclusão

- [x] O servidor atende o protocolo KOSync num endereço dentro de `/sync/`: confere o usuário e a senha, grava o progresso de um livro e devolve o último gravado, com as respostas que o KOReader espera; um livro sem progresso devolve uma resposta vazia.
- [x] Sem a credencial certa, toda rota do KOSync recusa o pedido sem revelar nada; o cadastro de usuário pelo KOReader fica fechado; a credencial do KOSync não dá acesso aos quadros, aos arquivos nem à biblioteca, e a chave de um aparelho não vale como credencial do KOSync.
- [x] A credencial é criada na VPS por um comando do roteiro, que mostra a senha uma única vez; o servidor guarda só o resumo dela, e revogar vale na hora, sem reiniciar.
- [x] O progresso fica guardado à parte dos quadros, legível, só com o identificador do livro, a posição, a porcentagem, o aparelho e o horário; um pedido fora do formato ou grande demais é recusado.
- [x] A exceção à cifra e o uso do KOReader ficam descritos nos guias e nas decisões vigentes.
- [x] Os testes automáticos cobrem as rotas, as recusas e o comando da credencial, e acusam mutações introduzidas.
- [ ] O autor configura o KOReader do Boox com o endereço da Prancheta e a credencial, entra, envia o progresso de um livro e o recebe de volta, sem erro.

## Registro

### 2026-11-10

- O autor escolheu este plano, respondeu às três perguntas que estão nas decisões do plano e aprovou estes critérios.
- Implementação:
  - `servidor/kosync.cjs`: as rotas do KOSync em `/sync/kosync/`, com o usuário em `X-Auth-User` e o MD5 da senha em `X-Auth-Key`, como o KOReader envia. `GET /users/auth` confirma a credencial; `PUT /syncs/progress` grava o progresso e devolve o documento e o horário, em segundos; `GET /syncs/progress/<documento>` devolve o último gravado, ou `{}`; `POST /users/create` responde que o cadastro está fechado, com o código 2005 do protocolo, sem dizer nada sobre os usuários. As rotas valem também sem o `/sync`, que o Tailscale pode tirar do caminho.
  - Credencial: um arquivo com uma linha por usuário, com o nome e o resumo SHA-256 do MD5 da senha, relido quando muda; ausente ou estragado, ninguém entra, e o servidor continua no ar. A conferência compara todos os resumos, sem variar o tempo. O servidor confere o KOSync antes da chave dos aparelhos, e as duas credenciais não se misturam.
  - Progresso: em `kosync/<usuário>.json`, na pasta dos dados, gravado por arquivo provisório e renomeado, legível só pelo servidor, fora do registro, do histórico e da cifra. Entram só os campos do protocolo; o documento precisa ser um resumo de 32 algarismos hexadecimais, a porcentagem vai de 0 a 1, a posição tem até 2.048 caracteres, o pedido tem até 16 KB, e cada usuário guarda até 5.000 livros, saindo os gravados há mais tempo.
  - VPS: o comando `prancheta-kosync`, com `novo`, `listar` e `revogar`, cria uma senha de 20 letras minúsculas e algarismos, mostrada uma única vez; o roteiro o instala, cria o arquivo vazio em `/etc/prancheta/acesso/kosync`, e o contêiner o lê pela pasta de acesso, montada só para leitura.
- Escolha desta etapa: o pedido de cadastro recebe a resposta própria do protocolo, e não a recusa geral, para o KOReader mostrar ao autor que o cadastro é fechado; ela não revela nenhum dado.
- Critérios 1 a 4 e 6 verificados pelos testes: `servidor/testes/kosync.test.cjs`, com 6 testes, cobre a entrada, a gravação e a leitura, a substituição, o recomeço do servidor, as rotas sem o `/sync`, oito formas de credencial errada em cinco rotas, a chave de aparelho recusada no KOSync e a credencial do KOSync recusada em seis rotas da sincronização, o cadastro fechado, 17 pedidos fora do formato, o limite de tamanho, os campos guardados, a permissão do arquivo, o limite de livros, o comando da VPS com a senha fora do arquivo, o usuário novo e o revogado valendo na hora, o arquivo ausente e o estragado, e o servidor ligado pelo ambiente. Um teste novo de implantação confere o roteiro e o contêiner. As 31 mutações introduzidas foram todas acusadas, e a execução de controle passou. Os testes do servidor são 43, todos passando.
- Critério 5 verificado: a exceção à cifra e o passo a passo do KOReader estão em `servidor/LEIA-ME.md` e em `servidor/implantacao/LEIA-ME.md`, e a decisão, em `acompanhamento/estado.md`.
- Falta, para o critério 7: mesclar, o autor rodar de novo o roteiro na VPS, criar o usuário com `prancheta-kosync novo leitor`, configurar o KOReader e conferir o envio e o recebimento.

## Resultado
