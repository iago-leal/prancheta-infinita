---
tipo: estado
atualizado_em: 2026-11-09
fase: Livros e PDFs, com rede privada e cifra
plano_ativo: acompanhamento/planos/005-livros-e-pdfs/plano.md
etapa_atual:
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
- Segurança, conforme o debate de 2026-11-08: os quadros só respondem com a chave de cada aparelho; arquivos isolados da página, versão nova só quando o autor pede, histórico de 30 dias e cópia puxada pelo computador; rede privada e cifra no aparelho antes dos livros. Desde 2026-11-09, a Prancheta só responde pela rede privada do Tailscale, com o endereço público fechado, e o Boox precisa do Tailscale sempre ligado; a cifra será ponta a ponta, com a senha só nos aparelhos.
- Servidor de sincronização em Node puro, sem dependências e com os dados em arquivos: numera as mudanças, devolve os conflitos para o aparelho combinar e só atende com a chave; a única exceção, aceita pelo autor, é a consulta prévia do navegador vinda da casca, que não recebe dados.
- Sincronização no próprio banco local, em segundo plano: combina item a item, pelo id; no mesmo campo mudado nos dois aparelhos, prevalece a gravação mais recente; a gravação da página também é combinada com o que chegou do servidor desde a anterior; endereço e chave ficam no banco de cada aparelho.

## Em andamento

Plano 005, livros e PDFs, com rede privada e cifra, aberto em 2026-11-09, com a ordem aprovada pelo autor: 01 rede privada com o Tailscale e endereço público fechado, concluída no mesmo dia; 02 cifra ponta a ponta dos quadros, a detalhar; 03 biblioteca do WebDAV entregue pela Prancheta; 04 leitor de PDF e EPUB com marcações ligadas a quadros. O plano 004 terminou em 2026-11-09, com a faixa única, o modo e-ink, o botão de formas, o laço e os pontos mais espaçados; o autor dispensou as ferramentas de reorganização e, depois de testá-lo, mandou tirar o controle de sensibilidade à pressão, retirado na casca 0.4.2. Os planos 001 a 003 estão concluídos.

## Próximo passo

Detalhar com o autor a etapa 02 do plano 005, cifra ponta a ponta dos quadros: como a senha é criada e guardada em cada aparelho, o que acontece se ela for perdida, como os dados que já estão na VPS passam a ser cifrados e os critérios da etapa. No início da próxima sessão em contêiner novo, confirmar que o script de configuração rodou, verificando se `/opt/android-sdk` existe.

## Planos previstos

1. 001 a 004, concluídos: experimento da casca Android, Prancheta independente do claude.ai, Prancheta no Boox e sincronização com a VPS, e modo e-ink.
2. 005: livros e PDFs, com a biblioteca do WebDAV da VPS montada só para leitura no servidor da Prancheta e, antes, a rede privada e a cifra ponta a ponta, ativo.
3. Publicação no catálogo de aplicativos de código aberto da Hostinger, com o botão "Implantar no Hostinger" no LEIA-ME e comissão sobre as hospedagens compradas por ele, pedida pelo autor para depois do 005; exige uma licença de código aberto e uma implantação genérica, sem o Tailscale e sem nada da VPS do autor.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e os hosts `dl.google.com`, `repo.boox.com`, `entire.com` e `install.entire.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk`, cria o `local.properties` e compila a casca, e instala o Entire com os ganchos do Git dele; as gravações das sessões vão para o repositório privado `iago-leal/prancheta-sessoes`.

## Dúvidas em aberto

- O que fazer quando o plugin Android 10 remover o Jetifier, se o SDK da Onyx ainda depender de bibliotecas anteriores ao AndroidX?
- O APK tem 21 MB por trazer bibliotecas nativas de cinco arquiteturas; vale restringi-lo às arquiteturas ARM?
