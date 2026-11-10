---
tipo: estado
atualizado_em: 2026-11-10
fase: Melhorias do leitor
plano_ativo: acompanhamento/planos/006-melhorias-do-leitor/plano.md
etapa_atual: acompanhamento/planos/006-melhorias-do-leitor/etapas/02-leitura-no-e-ink.md
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
- Cifra ponta a ponta, por decisão do autor: uma chave aleatória de 256 bits, criada no primeiro aparelho, guardada só no Bitwarden e informada nos outros; o servidor não a conhece e, depois da primeira gravação cifrada, recusa o legível e outra chave. Sem o Bitwarden e sem os aparelhos, a cópia da VPS fica ilegível; o banco local continua legível.
- Livros: funções de outros leitores entram pela especificação do comportamento, nunca por cópia de código, porque o Readest e o KOReader são AGPL. O servidor da Prancheta lê a subpasta de livros do WebDAV, montada só para leitura, com uma permissão extra de leitura para a conta `prancheta`, reaplicada a cada 5 minutos para os livros novos, e a entrega com a chave de cada aparelho; cada livro aberto fica guardado no aparelho, num banco separado dos quadros, e é identificado como no KOReader.
- Servidor de sincronização em Node puro, sem dependências e com os dados em arquivos: numera as mudanças, devolve os conflitos para o aparelho combinar e só atende com a chave; a única exceção, aceita pelo autor, é a consulta prévia do navegador vinda da casca, que não recebe dados.
- Sincronização no próprio banco local, em segundo plano: combina item a item, pelo id; no mesmo campo mudado nos dois aparelhos, prevalece a gravação mais recente; a gravação da página também é combinada com o que chegou do servidor desde a anterior; endereço e chave ficam no banco de cada aparelho.

## Em andamento

Plano 006, melhorias do leitor, aberto em 2026-11-10 com a aprovação do autor. As duas etapas estão implementadas e esperam o teste dele no Boox: 01, leitor à esquerda e destaques editáveis ao toque, na casca 0.9.0; 02, leitura no e-ink, na casca 0.10.0, com o toque nas laterais para virar a página, o sumário, a busca no livro inteiro, sem distinguir maiúsculas nem acentos, e os destaques invertidos. A etapa 02 também corrigiu a página cortada ao arrastar a ponta de uma seleção, relatada pelo autor, os links internos dos EPUBs e as marcas fora do lugar na volta a um capítulo. As funções seguem o comportamento do Readest, descrito em `acompanhamento/planos/006-melhorias-do-leitor/readest.md` e implementado sem copiar código, porque ele é AGPL. O plano 005 terminou em 2026-11-09, com a casca 0.8.0. Os planos 001 a 004 estão concluídos.

## Próximo passo

Mesclar a etapa 02 do plano 006, com a casca 0.10.0, e o autor testar no Boox: da etapa 01, o leitor à esquerda, a caneta no quadro à direita e o toque num destaque, com o dedo e com a caneta; da etapa 02, se os destaques invertidos se enxergam bem, o toque nas laterais, o sumário, a busca e a seleção arrastada para além da página. Com a confirmação dele, concluir as duas etapas e o plano. Quando o autor enviar um livro novo pelo WebDAV, conferir que ele aparece na biblioteca em até 5 minutos. No início da próxima sessão em contêiner novo, confirmar que o script de configuração rodou, verificando se `/opt/android-sdk` existe.

## Planos previstos

1. 001 a 005, concluídos: experimento da casca Android, Prancheta independente do claude.ai, Prancheta no Boox e sincronização com a VPS, modo e-ink, e livros e PDFs, com rede privada e cifra.
2. 006: melhorias do leitor, ativo. A decidir depois dele: receber no servidor o progresso de leitura do KOReader, e escrever à mão sobre a página do livro.
3. Publicação no catálogo de aplicativos de código aberto da Hostinger, com o botão "Implantar no Hostinger" no LEIA-ME e comissão sobre as hospedagens compradas por ele, pedida pelo autor para depois do 005; exige uma licença de código aberto e uma implantação genérica, sem o Tailscale e sem nada da VPS do autor.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e os hosts `dl.google.com`, `repo.boox.com`, `entire.com` e `install.entire.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk`, cria o `local.properties` e compila a casca, e instala o Entire com os ganchos do Git dele; as gravações das sessões vão para o repositório privado `iago-leal/prancheta-sessoes`.

## Dúvidas em aberto

- O que fazer quando o plugin Android 10 remover o Jetifier, se o SDK da Onyx ainda depender de bibliotecas anteriores ao AndroidX?
- O APK tem 21 MB por trazer bibliotecas nativas de cinco arquiteturas; vale restringi-lo às arquiteturas ARM?
