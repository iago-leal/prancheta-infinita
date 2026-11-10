---
tipo: estado
atualizado_em: 2026-11-10
fase: Progresso de leitura com o KOReader
plano_ativo: acompanhamento/planos/007-progresso-do-koreader/plano.md
etapa_atual: acompanhamento/planos/007-progresso-do-koreader/etapas/03-posicao-entre-os-aparelhos.md
bloqueios: []
---

# Estado atual

## Visão

A Prancheta Infinita nasceu como artefato do claude.ai, um `index.html` de cerca de 292 KB, e já roda independente dele, sem internet, em `web/app/`. O objetivo é uma aplicação que funciona sem internet e se sincroniza com a VPS do autor, cujo uso principal é escrever à mão e reorganizar quadros no Boox Note Air4 C. Mais adiante, ela deve permitir ler PDFs e e-books e ligar marcações a quadros.

## Decisões vigentes

- Aplicação web com uma casca Android no Boox que usa a camada de tinta da Onyx: validada no Air4 C, com escrita tão rápida quanto a do aplicativo de notas, enquanto o navegador atrasa de 200 a 300 ms.
- Uso sem internet: os dados ficam num banco local em IndexedDB, dentro da página, no Boox e no computador, e a VPS serve para sincronizar quando houver rede.
- O banco local guarda versão, horário e aparelho de cada documento, marca as exclusões em vez de apagar e registra cada gravação, para que a sincronização do plano 003 não mude o formato dos dados.
- Independência por uma camada de compatibilidade que responde pela mesma porta `claude.use(...)` do artefato, para não reescrever o código: `web/app/index.html` é o original com as mudanças listadas, cada uma com o motivo, em `web/montagem/mudancas.cjs`.
- Um service worker guarda a página para abri-la sem rede e entrega os arquivos enviados, lidos do banco local; a fonte e as bibliotecas vão junto com a página, sem nenhuma requisição externa.
- Conversa com o Claude e conectores MCP fora da primeira versão, porque exigem chave de API paga e configuração de cada conector.
- Tinta livre com laço, setas que acompanham a seleção e "manter junto" sob demanda, sem agrupamento automático, para que a Prancheta nunca precise adivinhar.
- No Boox, a caneta escreve, um dedo seleciona e arrasta, e dois dedos movem e ampliam o quadro; com a borracha ou as ferramentas de forma e de texto, a caneta age sobre a página. Um toque de dedo até 1 s depois da caneta, ou maior que a ponta de um dedo, é tido como palma, e a caneta que chega cancela o gesto de dedos em andamento, sem deixar efeito; desfazer e refazer pelos dedos pedem dois toques seguidos, e os controles ficam numa faixa só no alto da tela, sem sombras.
- Modo e-ink na casca, sem sombras, animações ou transparências. O contorno durante o arrasto e o mover por toque foram dispensados pelo autor em 2026-11-09, porque o arrasto atual não deixa rastro no Boox.
- Cada traço guarda identificador, posição e horário, para permitir agrupamento e transcrição no futuro.
- Traço sensível à pressão, por decisão do autor, com o traço provisório da Onyx e o definitivo da página na mesma forma, para que nada mude quando a tela do Boox se atualiza. O controle de sensibilidade à pressão, testado nas casca 0.4.0 e 0.4.1, foi retirado pelo autor em 2026-11-09.
- A Prancheta independente começa com o banco limpo: os dados do artefato não serão migrados, por decisão do autor.
- Sempre que a página apagar traços, a casca redesenha a tela inteira, porque os traços provisórios da Onyx só somem assim.
- Atualizações da casca pelo próprio aplicativo: o GitHub compila e publica cada versão, assinada com a chave das versões instaladas, e a casca oferece a atualização ao abrir com internet.
- Publicação na VPS pelo GitHub: o fluxo `.github/workflows/publicar.yml` envia a página e o servidor a cada mudança deles na `main`, por uma conta sem privilégios e sem acesso ao Docker, que só troca a versão em uso e confere na própria VPS que ela entrou no ar; as ações de administrador ficam num roteiro executado pelo autor, e nenhum endereço da Prancheta entra no repositório.
- Segurança, conforme o debate de 2026-11-08: os quadros só respondem com a chave de cada aparelho; arquivos isolados da página, versão nova só quando o autor pede, histórico de 30 dias e cópia puxada pelo computador; rede privada e cifra no aparelho antes dos livros. Desde 2026-11-09, a Prancheta só responde pela rede privada do Tailscale, com o endereço público fechado, e o Boox precisa do Tailscale sempre ligado.
- Cifra ponta a ponta, por decisão do autor: uma chave aleatória de 256 bits, criada no primeiro aparelho, guardada só no Bitwarden e informada nos outros; o servidor não a conhece e, depois da primeira gravação cifrada, recusa o legível e outra chave. Sem o Bitwarden e sem os aparelhos, a cópia da VPS fica ilegível; o banco local continua legível. Única exceção, aceita pelo autor em 2026-11-10: o progresso de leitura do KOReader, que não conhece a chave, fica legível na VPS, só com o resumo do livro, a posição, a porcentagem, o aparelho e o horário, e tem uma credencial própria, que não abre mais nada.
- Livros: funções de outros leitores entram pela especificação do comportamento, nunca por cópia de código, porque o Readest e o KOReader são AGPL. O servidor da Prancheta lê a subpasta de livros do WebDAV, montada só para leitura, com uma permissão extra de leitura para a conta `prancheta`, reaplicada a cada 5 minutos para os livros novos, e a entrega com a chave de cada aparelho; cada livro aberto fica guardado no aparelho, num banco separado dos quadros, e é identificado como no KOReader. Na biblioteca, o título e o autor de um EPUB são lidos de dentro do arquivo pelo servidor, e o grupo de cada livro é o primeiro autor escrito nele; uma pasta só vale como autor quando tem cara de nome, porque na biblioteca do autor as pastas são identificadores. Desde 2026-11-10, por decisão do autor, a página de um e-book fica num quadro que deixa código rodar, para o toque nela valer no iPad e no iPhone; o código do próprio livro é barrado por duas travas independentes, a limpeza de cada capítulo e uma regra do navegador no começo dele, e o capítulo que não começa por essa regra não é mostrado.
- Servidor de sincronização em Node puro, sem dependências e com os dados em arquivos: numera as mudanças, devolve os conflitos para o aparelho combinar e só atende com a chave; a única exceção, aceita pelo autor, é a consulta prévia do navegador vinda da casca, que não recebe dados.
- Sincronização no próprio banco local, em segundo plano: combina item a item, pelo id; no mesmo campo mudado nos dois aparelhos, prevalece a gravação mais recente; a gravação da página também é combinada com o que chegou do servidor desde a anterior; endereço e chave ficam no banco de cada aparelho.

## Em andamento

Plano 007, progresso de leitura com o KOReader, aberto em 2026-11-10, com as quatro etapas implementadas e publicadas, com a casca 0.14.0: 01, o servidor recebe e devolve o progresso pelo protocolo KOSync, em `/sync/kosync/`; 02, o leitor mostra um aviso com um botão que leva aonde o KOReader parou, sem pular sozinho; 03, concluída em 2026-11-10, com o teste do autor entre o MacBook e o Boox, o leitor grava a posição exata dele, e o outro aparelho da Prancheta continua de lá; 04, a gravação leva também o caminho do parágrafo no formato do KOReader, e o KOReader recebe o progresso mais recente entre o dele e o da Prancheta. O autor ainda não testou nada com o KOReader: as etapas 01, 02 e 04 esperam esse teste. O plano 006, melhorias do leitor, tem as duas etapas implementadas, à espera do teste no Boox; a casca esconde o menu de seleção do Android dentro do leitor, a barra da seleção tem "Copiar", e os e-books mostram a página do livro ou a posição. O plano 008, biblioteca organizada, pedido e aprovado pelo autor em 2026-11-10, tem a etapa 01 concluída em 2026-11-10, com o teste do autor no Boox, e a 02 implementada, à espera do teste: 01, o servidor entrega o título e o autor de cada livro, e a biblioteca abre numa tela própria, em lista por autor, com busca, três ordens, filtros e a porcentagem lida, com o botão e os cinco lidos por último no painel lateral; 02, cada livro tem uma ficha, aberta pela lista e pelo leitor, com os destaques e os quadros que o citam, de onde se volta ao trecho e ao cartão, e a lista diz em quantos quadros cada livro aparece. As funções seguem o comportamento do Readest e o protocolo do KOReader, descritos em palavras e implementados sem copiar código, porque ambos são AGPL. A pedido do autor, na casca 0.18.0, a seleção feita com o laço mostra a mesma barra flutuante da seleção comum, e a seleção de um trecho no e-book segue para a página ao lado, para uma frase que quebra de página virar um destaque só. Na casca 0.19.0, para o iPad e o iPhone: o quadro do e-book deixa código rodar, com as duas travas contra o código do livro, para a seleção e o toque na página chegarem ao leitor no Safari; o leitor também confere a seleção por fora, por garantia; e a barra de destaque fica abaixo do trecho nas telas de toque fora da casca, longe do menu do sistema. Nada disso foi visto num iPad: este ambiente não tem o motor do Safari. Os planos 001 a 005 estão concluídos.

## Próximo passo

O autor: confere no iPad, num e-book, a barra abaixo do trecho selecionado, o toque nos terços da página, um link do livro e o toque num destaque; registra o iPad e o iPhone com a sessão do Mac; atualiza a casca para a 0.19.0, confere a barra flutuante na seleção do laço, arrasta a alça de uma seleção até o fim da página de um e-book, para ver se ela segue para a página seguinte, e testa a ficha de um livro, chegando por ela a um destaque e a um quadro que o cita; roda de novo o roteiro na VPS, cria o usuário com `prancheta-kosync novo leitor`, sem que a senha passe por uma sessão do Claude, configura o KOReader, como em `servidor/implantacao/LEIA-ME.md`, e testa as etapas 01, 02 e 04 do plano 007, num EPUB e num PDF; e testa no Boox o plano 006, inclusive se o menu de seleção do Android sumiu dentro do leitor. Com as confirmações, concluir as etapas e os planos 006, 007 e 008 e decidir o seguinte. Antes de rodar os testes da página depois de compilar a casca, encerrar o Gradle com `./gradlew --stop`. No início da próxima sessão em contêiner novo, verificar se `/opt/android-sdk` existe.

## Planos previstos

1. 001 a 005, concluídos: experimento da casca Android, Prancheta independente do claude.ai, Prancheta no Boox e sincronização com a VPS, modo e-ink, e livros e PDFs, com rede privada e cifra.
2. 006, melhorias do leitor, 007, progresso de leitura com o KOReader, e 008, biblioteca organizada, ativos. Escrever à mão sobre a página do livro ficou para depois: o autor disse, em 2026-11-10, que não é uma necessidade tão grande.
3. Publicação no catálogo de aplicativos de código aberto da Hostinger, com o botão "Implantar no Hostinger" no LEIA-ME e comissão sobre as hospedagens compradas por ele, pedida pelo autor para depois do 005; exige uma licença de código aberto e uma implantação genérica, sem o Tailscale e sem nada da VPS do autor.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e os hosts `dl.google.com`, `repo.boox.com`, `entire.com` e `install.entire.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk`, cria o `local.properties` e compila a casca, e instala o Entire com os ganchos do Git dele; as gravações das sessões vão para o repositório privado `iago-leal/prancheta-sessoes`.

## Dúvidas em aberto

- O que fazer quando o plugin Android 10 remover o Jetifier, se o SDK da Onyx ainda depender de bibliotecas anteriores ao AndroidX?
- O APK tem 21 MB por trazer bibliotecas nativas de cinco arquiteturas; vale restringi-lo às arquiteturas ARM?
