---
tipo: etapa
plano: "005"
etapa: "03"
titulo: Biblioteca do WebDAV entregue pela Prancheta
status: concluida
depende_de: ["01", "02"]
iniciada_em: 2026-11-09
concluida_em: 2026-11-09
---

# Etapa 03: biblioteca do WebDAV entregue pela Prancheta

## Objetivo

Mostrar na Prancheta, no Boox e no computador, os PDFs e EPUBs da subpasta de livros do WebDAV da VPS, entregues pelo servidor da Prancheta com a chave de cada aparelho, e guardar no aparelho cada livro aberto, para que ele continue disponível sem rede. A leitura e as marcações ficam para a etapa 04.

## Critérios de conclusão

- [x] Na VPS, a subpasta de livros do WebDAV fica montada só para leitura no contêiner da Prancheta, por um roteiro executado pelo autor, sem que a Prancheta possa gravar nada nela; o caminho fica só na VPS e nunca entra no repositório.
- [x] O servidor lista os PDFs e EPUBs da subpasta, com nome, pasta, tamanho e um identificador do conteúdo igual ao que o KOReader usa, e entrega cada um só com a chave de um aparelho; nada fora da subpasta, nem por atalhos, é listado ou entregue.
- [x] No painel lateral, a seção "Biblioteca" mostra os livros; tocar num livro o baixa e o guarda no aparelho, que passa a mostrá-lo como guardado; sem rede, a lista e os livros guardados continuam disponíveis.
- [x] Os livros guardados ficam fora da sincronização dos quadros: não sobem ao servidor nem passam pela cifra.
- [x] Os testes automáticos cobrem a lista, a entrega com e sem a chave, os atalhos e os caminhos para fora da subpasta, o identificador, o download e o uso sem rede, e acusam mutações introduzidas.
- [x] O autor confirma, no Boox e no computador, que vê a biblioteca, baixa um livro e o encontra guardado com o aparelho sem rede.

## Registro

### 2026-11-09

- O autor aprovou estes critérios e mandou seguir.
- Decisões do autor para esta etapa: cada livro é baixado na primeira vez que é aberto e fica guardado no aparelho; a lista mostra só PDFs e EPUBs; a biblioteca é uma subpasta de livros do WebDAV, e o resto dele fica de fora; a biblioteca aparece numa seção do painel lateral, abaixo das pastas.
- Decisão anterior, do plano 003: os aparelhos não falam com o WebDAV, que não tem usuário só de leitura; o servidor da Prancheta lê a subpasta por uma montagem só de leitura e a entrega com a chave de cada aparelho, sem a senha do WebDAV nos aparelhos.
- Desenho proposto, a confirmar ao implementar:
  - VPS: o roteiro recebe o caminho da subpasta como argumento e o grava em `/etc/prancheta/ambiente`, legível só pelo administrador; o `compose.yml` monta essa pasta em `/biblioteca`, só para leitura. Sem o caminho, nada é montado, e a biblioteca aparece vazia. Antes, a sessão do Mac confere, sem trazer o caminho para cá, se a conta `prancheta` consegue ler a subpasta e quantos livros e gigabytes ela tem; se as permissões não deixarem, o autor decide como liberar a leitura.
  - Servidor: `GET /sync/biblioteca` lista os livros e `GET /sync/biblioteca/<id>` entrega um deles, ambos com a chave. O servidor percorre a subpasta sem seguir atalhos e só entrega um arquivo que esteja na lista, pelo identificador, nunca por um caminho vindo do pedido.
  - Identificador: o mesmo resumo parcial MD5 que o KOReader calcula sobre trechos do arquivo. Ele não muda quando o livro é renomeado ou trocado de pasta, o que permite à etapa 04 ligar as marcações ao livro e, mais adiante, aproveitar o progresso de leitura do KOReader.
  - Página: a seção "Biblioteca" do painel lateral mostra os livros por pasta, com a marca dos já guardados. Tocar num livro o baixa, com o progresso em texto, sem animação, e o guarda num depósito próprio do banco local, separado dos quadros e dos arquivos enviados, para que ele não suba ao servidor nem passe pela cifra. A última lista recebida fica guardada para o uso sem rede. Antes da etapa 04, tocar num livro guardado só confirma que ele está guardado.
- Riscos próprios da etapa:
  - O espaço do banco local no Boox: livros grandes podem esbarrar no limite do navegador da casca; a etapa mede isso com um PDF grande.
  - Os livros ficam legíveis no aparelho e passam pela rede privada cifrados pelo Tailscale; na VPS, eles já estão legíveis no WebDAV, como antes.
  - O caminho da subpasta e as permissões do WebDAV ficam fora do repositório, como pediu a sessão do Mac no levantamento do plano 003.

- Conferência da sessão do Mac, com a aprovação do autor dada nela, só de leitura e sem trazer o caminho para cá: a subpasta de livros foi identificada; ela tem 13 PDFs e EPUBs, 3 PDFs e 10 EPUBs, somando 0,09 GB, com o maior arquivo de 29,6 MB, e outros 26 arquivos que não são livros; não há atalhos, pastas ocultas nem pastas `.sdr`. Todos os arquivos são do usuário do WebDAV, com permissão 600, e as pastas, 700: a conta `prancheta` não consegue lê-los.
- Decisão do autor para a leitura, depois de explicada a ACL: uma permissão extra, só de leitura, para a conta `prancheta`, posta pelo roteiro com o pacote `acl`, sem mudar o dono nem as permissões normais. As outras opções eram uma cópia periódica pelo administrador e mudar as permissões e a configuração do WebDAV.
- Teste da permissão extra numa pasta com arquivos 600 e pastas 700 de outro usuário: a conta de leitura passou a ler os livros sem conseguir gravar nada, e o dono continuou lendo e gravando; os livros novos criados com o modo padrão também ficaram legíveis, mas um arquivo criado pedindo explicitamente o modo 600 não, porque a máscara da ACL segue o modo pedido; desfeita a regra, as permissões voltaram exatamente a 600 e 700. Falta saber como o WebDAV da VPS cria os livros novos; se for como no segundo caso, um livro novo só entra na biblioteca quando o roteiro roda de novo.
- Implementação:
  - `servidor/biblioteca.cjs`, novo: percorre a pasta sem seguir atalhos e sem as pastas ocultas e `.sdr`, lista só PDFs e EPUBs e identifica cada livro pelo resumo parcial MD5 do KOReader. O algoritmo foi conferido no código do KOReader, `util.partialMD5`: trechos de 1 KB em 0, 1 KB, 4 KB, 16 KB e assim por diante até 1 GB; a primeira posição, de `lshift(1024, -2)`, dá zero no LuaJIT. O resumo só é recalculado quando o tamanho ou a data mudam, e a lista é reaproveitada por 30 segundos. Um livro só é entregue pelo identificador, se estiver na lista; ao abrir, o servidor confere que nenhuma pasta do caminho virou atalho e abre o arquivo sem seguir atalho.
  - `servidor/servidor.cjs`: `GET /sync/biblioteca` e `GET /sync/biblioteca/<id>`, com a chave, a origem da casca e os cabeçalhos dos arquivos enviados; a pasta vem de `PRANCHETA_BIBLIOTECA`.
  - `compose.yml`: a subpasta, de `PRANCHETA_BIBLIOTECA_DA_VPS` no ambiente da VPS, montada só para leitura em `/biblioteca`; sem ela, uma pasta vazia.
  - `preparar-vps.sh`: `--biblioteca <subpasta>`, guardada no ambiente e preservada nas execuções seguintes, com a permissão extra de leitura; `--sem-biblioteca`, que a tira; e a conferência, de dentro do contêiner, de quantos livros a Prancheta consegue ler. O roteiro recusa caminhos com caracteres especiais e pastas do sistema ou da Prancheta.
  - `web/app/compat/biblioteca.js`, novo: a seção "Biblioteca" do painel lateral, abaixo das pastas, com os livros por pasta, o tamanho ou "guardado" ao lado de cada um e o progresso do download de 10 em 10%, para não redesenhar o e-ink a cada pedaço. Os livros ficam no banco `prancheta-biblioteca`, separado do banco dos quadros, e a última lista recebida fica guardada para o uso sem rede. `compat/claude.js` liga a biblioteca à sincronização, de onde vêm o endereço e a chave.
  - Casca 0.6.0, `versionCode` 18, porque a página do Boox vem dentro dela; guias do servidor e da VPS com a biblioteca.
- Testes: 6 da biblioteca no servidor, entre eles o resumo do KOReader com arquivos de vários tamanhos, os atalhos e as pastas ocultas, o livro renomeado, a entrega com e sem a chave e o livro ou a pasta trocados por atalho depois de listados; 1 da montagem e do roteiro; 2 no Chromium, com a página e o servidor no mesmo endereço, cobrindo a lista, o download, o livro fora dos quadros e do servidor, a página reaberta sem rede com a lista e o livro guardado, o livro não guardado sem rede e a chave recusada. Das 10 mutações introduzidas, 8 foram acusadas; as outras duas não mudam o comportamento: tirar o descarte explícito de atalhos, que a leitura do tipo de cada arquivo também descarta, e aceitar um identificador fora da lista, que o formato exigido do identificador impede de chegar a um caminho. Duas mutações escaparam na primeira rodada e levaram a testes novos: a conferência ao abrir, que o teste não exercitava porque refazia a lista a cada pedido, e a guarda contra baixar de novo um livro guardado, que a interface já evitava.
- O detector da skill `impeccable` não apontou nada na seção.

- Mesclado o PR #36; a publicação pôs no ar a versão 58afb38, e a casca 0.6.0 saiu como `casca-18`. O autor instalou a casca no Boox.
- A sessão do Mac, com a aprovação do autor dada nela, copiou a pasta de implantação do commit 58afb38 e rodou o roteiro com `--biblioteca`: ele instalou o pacote `acl`, pôs a permissão extra de leitura e terminou sem erro; de dentro do contêiner, a Prancheta consegue ler os 13 PDFs e EPUBs, sem nenhum item de fora. `/biblioteca` ficou montada só para leitura, o dono dos 39 arquivos não mudou, e o contêiner do servidor foi recriado pelo roteiro.
- Critério 1 verificado: a subpasta está montada só para leitura no contêiner da Prancheta, pelo roteiro executado com a aprovação do autor, e o caminho ficou só na VPS.
- Critério 5 verificado pelos testes e pelas mutações descritos acima.
- Livros novos: a sessão do Mac verificou que o WebDAV é um nginx com o módulo dav, sem `dav_access` na configuração, o que vale o padrão `user:rw`, um modo 600 fixo, que torna o umask irrelevante. Ela deduziu, sem poder testar, que um livro novo não herdaria a permissão extra. O teste aqui confirmou: um arquivo gravado num temporário fora da pasta, com modo 600, e renomeado para dentro dela, como o nginx faz, ficou fora do alcance da conta de leitura. O autor escolheu reaplicar a permissão a cada 5 minutos, em vez de deixá-la para quando o roteiro rodar ou de testar antes.
- Implementado: o comando `prancheta-biblioteca`, que põe e reaplica a permissão extra, só de leitura, lendo a subpasta do ambiente da VPS, e um temporizador do systemd que o chama a cada 5 minutos; o roteiro os instala com a biblioteca e os tira com `--sem-biblioteca`. Testado aqui no mesmo arranjo do nginx: depois da reaplicação, a conta de leitura passou a ler o livro novo e continuou sem conseguir gravar nele; sem subpasta no ambiente, o comando não faz nada.

- Mesclado o PR #37, com o comando e o temporizador; a instalação na VPS foi pedida à sessão do Mac, que roda o roteiro de novo com a aprovação do autor.
- O autor testou no Boox, com a casca 0.6.0, e no computador: a biblioteca aparece nos dois e funciona sem rede.

## Resultado

A Prancheta mostra, no Boox e no computador, os 13 PDFs e EPUBs da subpasta de livros do WebDAV, montada só para leitura na VPS, e guarda cada livro aberto num banco separado dos quadros, disponível sem rede. Cada livro é identificado como no KOReader, o que prepara a ligação das marcações na etapa 04. A Prancheta lê a subpasta por uma permissão extra, só de leitura, reaplicada a cada 5 minutos para os livros novos, sem mudar o dono nem as permissões do WebDAV.

Como cada critério foi verificado:

1. Montagem só de leitura na VPS: verificada pela sessão do Mac, que rodou o roteiro com a aprovação do autor; `/biblioteca` ficou só para leitura, o dono dos arquivos não mudou e o caminho ficou só na VPS.
2. Lista e entrega pelo servidor: verificadas pelos testes do servidor, inclusive a chave, os atalhos, as pastas ocultas, os caminhos para fora e o identificador do KOReader, e na VPS, onde a Prancheta lê os 13 livros que o autor viu nos aparelhos.
3. Seção "Biblioteca", livro guardado e uso sem rede: verificados pelo teste no Chromium e pelo autor, no Boox e no computador.
4. Livros fora da sincronização dos quadros: verificado pelo teste no Chromium, em que nada entra no registro de mudanças nem nos arquivos do servidor; os livros ficam no banco `prancheta-biblioteca`, separado do banco dos quadros.
5. Testes e mutações: 8 de 10 mutações acusadas, e as 2 restantes não mudam o comportamento.
6. Confirmação do autor: a biblioteca aparece nos dois aparelhos e funciona sem rede.
