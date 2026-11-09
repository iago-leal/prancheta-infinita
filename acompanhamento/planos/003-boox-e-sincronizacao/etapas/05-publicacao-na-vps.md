---
tipo: etapa
plano: "003"
etapa: "05"
titulo: Publicação na VPS e acesso protegido
status: concluida
depende_de: ["01", "03", "04"]
iniciada_em: 2026-11-08
concluida_em: 2026-11-09
---

# Etapa 05: publicação na VPS e acesso protegido

## Objetivo

Publicar na VPS a Prancheta de `web/app/` e o servidor de sincronização a cada envio à `main`, pelo canal restrito do GitHub criado antes deste plano, servindo os dois por HTTPS no endereço escolhido pelo autor, e ligar a casca e o navegador do computador a esse servidor.

## Critérios de conclusão

- [x] Cada envio à `main` publica na VPS a pasta `web/app/` e o servidor de sincronização, pelo canal restrito do GitHub, sem usar acesso de administrador.
- [x] As ações de administrador na VPS, feitas uma única vez pelo autor, estão num roteiro do repositório, e o servidor da Prancheta roda numa conta sem privilégios, sem mexer nos outros serviços da VPS.
- [x] A Prancheta e o servidor respondem por HTTPS no endereço escolhido pelo autor, e o servidor só atende com a chave de acesso.
- [x] No navegador do computador, a Prancheta aberta no endereço da VPS continua funcionando sem internet depois da primeira visita.
- [x] O autor confirma que um quadro feito no Boox aparece no computador e um quadro feito no computador aparece no Boox.

## Registro

### 2026-11-08

- Levantamento da VPS, feito numa sessão do Mac, só de leitura e em versão reduzida, por decisão do autor, porque o repositório é público: um Traefik 3.6 em Docker emite os certificados por desafio TLS e encaminha por nome; cada app fica num contêiner próprio, numa rede exclusiva com ele; a conta `prancheta`, do canal de publicação, só aceitava a ação `verificar` e não está no grupo `docker`. O inventário dos outros serviços e os dados que identificam a máquina ficam fora do repositório.
- Endereço: escolhido pelo autor, um subdomínio que já resolve para a VPS por um registro curinga, sem criar nada no DNS. Por ser um nome que identifica a máquina, ele fica só em `/etc/prancheta/ambiente` e no segredo opcional `VPS_PRANCHETA_ANFITRIAO`, nunca no repositório.
- Debate de segurança: a pedido do autor, um debate com oito agentes, três defensores, uma equipe vermelha, réplicas e um juiz, comparou a página aberta com os quadros protegidos pela chave, a autenticação na borda para tudo e a rede privada. Conclusão aceita pelo autor: na etapa 05, a página fica aberta, porque é o mesmo código do repositório público, e só os quadros exigem a chave, com um reforço de base; a rede privada, se o Tailscale funcionar no Boox, e a cifra dos dados no aparelho entram antes dos livros e PDFs, num plano próprio. A senha HTTP e o login por cookie foram descartados, porque disputam o cabeçalho Authorization com a chave e quebram a consulta prévia da casca.
- Desenho: um contêiner `node:22-alpine` serve a página, por `servidor/pagina.cjs`, numa porta sem chave, e a sincronização noutra, com chave; o Traefik encaminha `/sync/` para a sincronização e o resto para a página, no mesmo endereço, o que dispensa CORS no computador. O código fica em `/home/prancheta/publicado`, montado só para leitura; os dados, em `/var/lib/prancheta`; o contêiner roda com a conta `prancheta`, sem privilégios, só leitura, sem saída para a internet e com limites de memória e de processos.
- Publicação sem administrador: o fluxo `publicar.yml` testa o servidor, confere a página montada, monta um pacote por `git archive` e o envia com `publicar <commit>`. O comando forçado `prancheta-publicar` confere o pacote, guarda a versão, grava `versao.txt` e troca o atalho `atual`; o servidor percebe a troca em até 5 s e termina, e o Docker o reinicia com a versão nova. A conta `prancheta` nunca usa o Docker. O fluxo confere a versão no ar por `https://<endereço>/versao.txt` quando o segredo do endereço existe. Ficam guardadas as cinco versões mais recentes, e `voltar <commit>` desfaz uma publicação.
- Roteiro do administrador: `servidor/implantacao/preparar-vps.sh`, executado uma vez pelo autor e seguro para repetir. Ele instala os comandos, cria as pastas, o ambiente e a rede, liga o Traefik à rede sem reiniciá-lo e liga o contêiner; não edita o arquivo do Traefik, só mostra o trecho a acrescentar. O guia está em `servidor/implantacao/LEIA-ME.md`.
- Reforço de base e correção dos problemas que o debate verificou no código:
  - Arquivos: o servidor e o service worker devolvem cada arquivo com o tipo normalizado, `nosniff` e, fora do PDF, `Content-Security-Policy: sandbox`; só imagens e PDF abrem no navegador, e o resto é baixado. Antes, um HTML ou SVG enviado abria na origem da página, onde fica a chave.
  - Página: cabeçalhos de segurança e uma política que limita as conexões ao próprio endereço, proíbe objetos, formulários, mudança da base e a exibição em outro site. Os scripts não são restringidos, porque os desenhos por código rodam em iframes isolados que herdam a política e carregam bibliotecas de CDNs.
  - Service worker: fora da casca, usa sempre a versão guardada, e uma versão nova só entra quando o autor toca no aviso "Nova versão: atualizar"; na casca, a página vem do APK e continua sendo trocada sozinha. A `VERSAO` do cache passou a ser carimbada por `montar.cjs` com um resumo dos arquivos guardados, para que nenhuma mudança fique presa no cache. Os pedidos de `/sync/` não passam pelo cache: com a página e a sincronização no mesmo endereço, o service worker guardaria as respostas dos dados.
  - Sincronização: só aceita https, exceto para o próprio computador, nos testes; o horário de uma versão recebida fica limitado ao relógio do aparelho, com 5 minutos de folga, para que um aparelho com o relógio adiantado não vença todas as combinações.
  - Chaves: uma por aparelho, criada por `prancheta-chave`; o servidor guarda só os resumos, num arquivo relido quando muda, e revogar um aparelho vale na hora sem trocar a chave dos outros. Nenhuma chave fica no ambiente do contêiner.
  - Histórico: cada versão aceita fica 30 dias em `historico/`, consultável por `servidor/historico.cjs`; antes, uma exclusão era irreversível. A cópia fora da VPS é puxada pelo computador, com uma chave própria, por `servidor/copia-de-seguranca.cjs`.
  - As ações dos fluxos do GitHub passaram a ser fixadas por hash.
- Testes: 10 novos no servidor, em `servidor/testes/publicacao.test.cjs` e `servidor/testes/implantacao.test.cjs`, 20 ao todo, que cobrem a página, as chaves, os cabeçalhos, o histórico, o reinício por versão nova, a cópia de segurança, o comando de publicação com pacotes maliciosos, a ferramenta de chaves e a configuração do contêiner; e 4 novos na Prancheta, 56 ao todo, 3 deles com a página e a sincronização servidas como na VPS, incluindo o uso sem rede depois da primeira visita, a atualização só quando o autor pede e o isolamento dos arquivos, sem nenhuma violação da política da página. Os testes acusam as 14 mutações introduzidas nos pontos de segurança; na primeira rodada, escapou a falta de normalização do tipo no envio, porque a entrega normalizava de novo, e o teste passou a conferir também a lista enviada aos outros aparelhos.
- O WebDAV da VPS foi levantado como biblioteca dos livros e PDFs do futuro, a pedido do autor; o levantamento foi pedido à sessão do Mac e não muda esta etapa.
- Falta, com o autor: executar o roteiro na VPS pela sessão do Mac, acrescentar a rede ao arquivo do Traefik, criar as chaves dos aparelhos, cadastrar o segredo do endereço, fazer a primeira publicação e confirmar a sincronização entre o Boox e o computador.

### 2026-11-08, implantação

- Mesclado o PR #19. A primeira publicação, disparada pelo envio à `main`, falhou como previsto: a conexão chegou à VPS, e o comando antigo da conta `prancheta` respondeu "acao nao permitida", porque o roteiro ainda não tinha rodado.
- A sessão do Mac, com a aprovação do autor dada nela, executou as ações de administrador: corrigiu para o administrador a posse de dois arquivos dele cujo dono numérico coincidia com a conta `prancheta`, para que o servidor da Prancheta, rodando com esse número, nunca os alcance; rodou o roteiro até o fim, sem erro; acrescentou a rede `prancheta_borda` ao arquivo do Traefik, com cópia de segurança, sem recriá-lo, e os outros sites continuaram respondendo; e cadastrou o segredo do endereço no GitHub. O contêiner ficou de pé com a conta `prancheta`, só leitura e só na rede da Prancheta.
- Chaves: o autor criou as três, `boox`, `computador` e `copia`, no próprio terminal, cada uma passada direto ao Bitwarden, sem passar pelo histórico de nenhuma sessão, inclusive porque esta sessão consegue ler o da sessão do Mac. O servidor lista as três.
- Publicação: disparada de novo pelo GitHub na `main`, ela passou em todos os passos. O comando restrito respondeu "publicado c8967a3…", e a conferência por https encontrou essa versão em `/versao.txt` no endereço da Prancheta seis segundos depois, o que confirma o certificado, o encaminhamento do Traefik e o reinício do servidor com a versão nova.
- A conferência de cada publicação passou a verificar também que `/sync/estado` responde 401 sem a chave e com uma chave errada, no endereço real.
- A correção de posse, feita à mão pela sessão do Mac, entrou no roteiro: ele se recusa a seguir se algum arquivo do administrador, em `/root` e `/etc`, tiver o mesmo dono numérico da conta `prancheta`. Com isso, todas as ações de administrador estão no roteiro, inclusive a edição do arquivo do Traefik, que ele descreve e que foi feita como descrita.
- Critério 2 verificado: o roteiro está em `servidor/implantacao/preparar-vps.sh` e foi executado uma vez, com a aprovação do autor; o contêiner roda com a conta `prancheta`, sem privilégios, só leitura e sem saída para a internet; nos outros serviços, o único toque foi ligar o Traefik à rede nova sem reiniciá-lo e anotá-la no arquivo dele, e os outros sites continuaram respondendo. Os critérios 1 e 3 ficam para a próxima publicação disparada por um envio à `main`, que vai conferir também a recusa sem a chave.
- WebDAV: o levantamento da sessão do Mac mostrou que ele não tem usuário só de leitura e que o navegador não consegue listar a biblioteca dele a partir de outra página. Para os livros, a proposta passa a ser montar a pasta da biblioteca só para leitura no contêiner da Prancheta e entregá-la com a chave de cada aparelho, sem a senha do WebDAV nos aparelhos. O progresso de leitura do KOReader identifica cada livro pelo conteúdo, o que permite ligar marcações a livros. Por reserva pedida pela sessão do Mac, os caminhos do servidor e um achado de segurança do WebDAV ficam fora do repositório.
- Mesclado o PR #20. A publicação disparada pelo envio à `main`, ce7fda3, passou em todos os passos: o comando restrito publicou a versão, a conferência por https encontrou ce7fda3 em `/versao.txt` no endereço da Prancheta, e `/sync/estado` respondeu 401 sem a chave e com uma chave errada.
- Critério 1 verificado por essa execução, disparada pelo próprio envio à `main`, pela conta `prancheta`, sem acesso de administrador nem ao Docker. Critério 3 verificado pela mesma execução: a página e o servidor respondem por https no endereço escolhido, com o certificado do Traefik, e a sincronização recusa quem não tem uma chave válida. As duas verificações se repetem a cada publicação.

### 2026-11-09

- O autor configurou a sincronização no computador, pelo navegador no endereço da VPS, e no Boox, pela casca 0.3.4, cada um com a sua chave, copiada do Bitwarden; os dois mostraram "Sincronizado".
- O autor confirmou que um quadro feito no Boox apareceu no computador e que um cartão criado no computador apareceu no Boox.
- O autor confirmou que, com a Prancheta já aberta uma vez no computador, ela abriu sem internet ao recarregar e voltou a sincronizar quando a rede voltou.

## Resultado

Etapa concluída em 2026-11-09.

1. Publicação a cada envio à `main`: verificada pela execução de "Publicar na VPS" disparada pela mesclagem do PR #20, ce7fda3, pela conta `prancheta`, sem acesso de administrador nem ao Docker; a conferência encontrou a versão no ar.
2. Ações de administrador num roteiro e servidor sem privilégios: o roteiro `servidor/implantacao/preparar-vps.sh` foi executado uma vez, com a aprovação do autor, e passou a incluir a correção de posse feita à mão; o contêiner roda com a conta `prancheta`, só leitura e sem saída para a internet, e nos outros serviços o único toque foi ligar o Traefik à rede nova sem reiniciá-lo e anotá-la no arquivo dele.
3. HTTPS e chave: a mesma execução encontrou a versão por https no endereço escolhido e confirmou que `/sync/estado` responde 401 sem a chave e com uma chave errada; a verificação se repete a cada publicação.
4. Sem internet no computador: confirmado pelo autor, no navegador do computador, depois da primeira visita; os testes de `web/testes/publicacao.test.cjs` cobrem o mesmo caso com a página e a sincronização servidas como na VPS.
5. Quadros nos dois sentidos: confirmado pelo autor, entre o Boox e o computador, depois de configurar a sincronização em cada um.
