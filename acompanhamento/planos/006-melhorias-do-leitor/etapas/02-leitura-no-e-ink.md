---
tipo: etapa
plano: "006"
etapa: "02"
titulo: "Leitura no e-ink: destaques visíveis, toque nas laterais, sumário e busca"
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-10
concluida_em:
---

# Etapa 02: leitura no e-ink

## Objetivo

Adequar a leitura ao e-ink do Boox: destaques que se enxergam bem na tela, viradas de página pelo toque nas laterais, o sumário do livro e a busca no texto, no EPUB e no PDF.

## Critérios de conclusão

- [ ] Na casca, o realce aparece invertido, com o texto claro sobre fundo escuro, e o sublinhado em linha preta cheia; no computador, os destaques continuam como hoje.
- [ ] Tocar no terço direito da página avança, e no terço esquerdo volta, no EPUB e no PDF, sem animação; o toque no meio da página, num destaque ou num link do livro, e o fim de uma seleção não viram a página.
- [ ] Um botão do leitor abre o sumário, com os capítulos do EPUB ou os marcadores do PDF; tocar num item leva a ele, e um livro sem sumário mostra um aviso.
- [ ] A busca do leitor acha um termo no livro inteiro, sem distinguir maiúsculas nem acentos, lista as ocorrências com o trecho ao redor e a posição, e tocar numa delas leva ao lugar, com o termo marcado.
- [x] Os testes automáticos cobrem os destaques no modo e-ink, o toque nas laterais e as exceções dele, o sumário e a busca, no EPUB e no PDF, e acusam mutações introduzidas.
- [ ] O autor confirma no Boox que enxerga bem os destaques, vira as páginas pelo toque, chega a um capítulo pelo sumário e acha um trecho pela busca.

## Registro

### 2026-11-10

- O autor aprovou estes critérios e mandou seguir, com a etapa 01 mesclada no PR #42 e ainda por testar no Boox, na casca 0.9.0. Sobre o realce, a proposta perguntava se um cinza mais forte bastaria no Boox colorido; ele aprovou os critérios como estavam, com o realce invertido na casca.
- Implementação, a publicar com a casca 0.10.0:
  - Toque nas laterais: um toque no terço direito da página avança, e no esquerdo volta, pelas mesmas viradas dos botões, sem animação; o meio não vira. Não viram a página o toque num destaque, que o abre, o toque num link, o fim de uma seleção e o toque que só desfaz uma seleção. No EPUB, o toque num destaque chega pela anotação logo antes do clique, e o leitor descarta o clique que vem até 400 ms depois dele.
  - Sumário: o botão "Sumário" abre, sobre a página do livro, a lista dos capítulos do EPUB, com os subitens recuados, ou dos marcadores do PDF; tocar num item leva a ele e fecha o painel, e um livro sem sumário mostra "Este livro não tem sumário.".
  - Busca: o botão "Buscar" abre o mesmo painel com um campo; a busca percorre todos os capítulos do EPUB, numa cópia de cada um, ou todas as páginas do PDF, compara sem acentos e sem maiúsculas, trata cada série de espaços como um espaço, põe um espaço entre parágrafos e entre linhas vizinhos e acha o que atravessa um itálico ou uma quebra de linha. A lista mostra cada ocorrência com cerca de 40 caracteres de cada lado, o termo em negrito e o capítulo ou a página, até 200 ocorrências; tocar numa leva ao lugar e marca o termo, no lugar da marca anterior. O painel reabre com a última consulta do livro aberto.
  - Destaques na casca: a camada das marcas do EPUB e os pedaços destacados do PDF invertem o que está embaixo, com o texto claro sobre fundo preto; o sublinhado é uma linha preta cheia, de 2 px; o termo achado pela busca aparece invertido no EPUB e, no PDF, numa moldura preta só em volta dele. No computador, o realce continua cinza.
  - Barra do leitor em duas linhas: fechar e o título na primeira; as viradas com a posição entre elas, "Sumário", "Buscar", "Ao quadro", a troca de lado e a tela inteira na segunda. Com os dois botões novos, uma linha só não cabia nos 600 px do leitor, e o título já aparecia cortado no Boox.
- Relato do autor durante a etapa, com foto: ao arrastar a ponta da seleção do Android para além da página, o livro ficava cortado ao meio, e só voltava ao fechar e abrir ou ao passar pela tela inteira. Causa: o navegador rola o livro para mostrar a ponta da seleção, que caiu na página seguinte, e a rolagem parava fora do começo de uma página. Correção: o leitor guarda a posição em que cada virada da epub.js deixa a rolagem e desfaz qualquer outra, antes de ela aparecer na tela. Com isso, uma seleção não passa de uma página para a outra.
- Dois defeitos antigos do leitor de EPUB, achados pelos testes novos e corrigidos:
  - Os links internos do livro, como os de notas e de índices, não levavam a lugar nenhum e geravam um erro. A epub.js os resolve por uma tag base, que a política de segurança da página recusa e que foi retirada na etapa 04 do plano 005; agora o leitor resolve o endereço pelo capítulo aberto. Um endereço de fora do livro não é aberto.
  - Na volta a um capítulo, as marcas dos destaques eram desenhadas antes de o texto tomar o lugar definitivo e ficavam 14 px acima do trecho, o que também fazia o toque nelas errar. Agora cada marca é posta de novo sobre o trecho depois de cada virada.
- Limites conhecidos: no PDF, o realce cobre o pedaço de texto inteiro em que o trecho está, como desde o plano 005, e só a marca do termo achado é exata; a busca não junta palavras separadas por hífen no fim da linha.
- Testes: um arquivo novo, `web/testes/leitura.test.cjs`, com 7 testes. No Node, a busca no texto, com acentos em forma composta e decomposta, maiúsculas, espaços e o limite. No Chromium, com a página e o servidor num só endereço: o toque nas laterais e as exceções, no EPUB e no PDF; a rolagem estranha desfeita, com as viradas e a tela inteira ainda alinhadas; o sumário do EPUB e do PDF, com e sem itens; a busca nos dois formatos, inclusive um termo em duas linhas do PDF; e, numa casca simulada com tela de toque, os destaques medidos na imagem da tela, com o fundo escuro e o texto claro, o sublinhado em linha cheia e o toque do dedo. Os livros de exemplo ganharam um EPUB com links, itálico, subitem no sumário e um capítulo de várias páginas, um EPUB sem sumário e PDFs com marcadores, acentos e duas linhas. A suíte da página passou a ter 99 testes, todos passando; os 36 testes nativos da casca passam, e ela compila.
- Dois achados sobre o simulador, que não são defeitos da Prancheta: o arrasto do mouse do Playwright não termina com o livro aberto, porque espera executar um script no quadro do livro, que não aceita scripts; e o Chromium não estende a seleção quando o arrasto chega com frações de pixel. Os testes enviam o arrasto direto ao navegador, em pixels inteiros.
- Critério 5 verificado: as 39 mutações introduzidas foram todas acusadas, e uma execução de controle, sem mudança, passou. Elas cobrem os terços trocados, o meio que vira, cada exceção do toque no EPUB e no PDF, os links, a rolagem desfeita e as viradas, os subitens, o aviso e a página do sumário, os acentos, as maiúsculas, os espaços, o limite, os capítulos, os parágrafos colados, a marca do termo e a troca dela, as linhas e a marca do PDF, a busca que passa de um livro a outro, as setas no campo da busca, cada regra do modo e-ink, a inversão fora da casca e as marcas fora do lugar.
- O detector da skill `impeccable` não apontou nada.
- A testar no Boox, com a casca 0.10.0: se o realce invertido e o sublinhado se enxergam bem, o toque nas laterais com o dedo, o sumário, a busca, e se arrastar a ponta da seleção para além da página deixou de cortar o livro. A inversão e a rolagem desfeita só foram verificadas no Chromium do computador.
- Mesclada no PR #43, com a casca 0.10.0. Em seguida, o autor pediu dois ajustes, que não mudam os critérios e vão na casca 0.11.0:
  - Barra da seleção flutuante: em vez da barra embaixo do leitor, com o trecho transcrito, os botões de destacar e de levar ao quadro aparecem numa barra pequena logo acima do trecho selecionado, centrada nele; sem espaço acima, ela vai para baixo do trecho, depois das alças de seleção quando a tela é de toque, e nunca sai da área do livro. Tocar fora do trecho desfaz a seleção e tira a barra; virar a página, seguir um link ou ir a um item do sumário ou da busca também. A barra some 0,3 s depois de a seleção ser desfeita, e não na hora, porque o toque num botão dela pode desfazer a seleção antes de chegar ao botão. Antes deste ajuste, no EPUB, a barra continuava na tela depois de a seleção ser desfeita.
  - Ícones no lugar das palavras, em todos os botões do leitor, no Boox e no computador: fechar, virar a página, sumário, buscar, levar ao quadro, trocar de lado, tela inteira, destacar, guardar a nota, trocar o estilo, apagar. Cada botão diz a ação no rótulo, para leitores de tela, e na dica que o computador mostra. Com isso, a barra do alto do leitor voltou a caber numa linha. Na barra do destaque aberto, o trecho transcrito deixou de aparecer, pela mesma razão da barra da seleção, e continua disponível para leitores de tela.
  - Risco a conferir no Boox: se o menu de seleção do próprio Android aparecer acima do trecho, ele pode cobrir a barra; nesse caso, a casca passa a esconder o menu do Android dentro do leitor.
  - Testes: um teste novo confere a posição da barra acima e abaixo do trecho, dentro da área do livro, sem texto, o sumiço ao tocar fora, ao virar a página e depois de destacar, a espera pelo botão ainda apertado, o ícone e o rótulo de cada botão e a barra do alto numa linha, no EPUB e no PDF. A suíte da página tem 100 testes, todos passando. Das 11 mutações deste ajuste, 10 foram acusadas; a que passou só atrasa em menos de um segundo o sumiço da barra depois de destacar. O detector da skill `impeccable` não apontou nada.
  - Um achado sobre o ambiente de testes: com o processo do Gradle parado na memória depois de uma compilação, o teste de sincronização entre dois perfis falhou 2 vezes em 6; sem ele, passou 6 vezes em 6, e 5 em 5 na versão anterior. Convém encerrar o Gradle, com `./gradlew --stop`, antes de rodar os testes da página.
- O autor testou a barra da seleção no Boox e mandou uma foto: o menu de seleção do Android, com "Copy", "Select all" e "Share", aparecia por cima dela, como previsto no risco acima. Correção, na casca 0.13.0:
  - A página avisa a casca, no começo de cada toque, se ele começou na área do livro. A casca passou a ter uma WebView própria, `WebViewDaCasca`, que, nesse caso, deixa o menu de seleção do Android sem itens e fora da tela. A seleção e as alças dela continuam como são; o menu precisa existir, mesmo vazio, porque sem ele a WebView desfaz a seleção. Fora do leitor, por exemplo no texto de um cartão, o menu do Android aparece como sempre.
  - Como o "Copy" do Android deixa de aparecer no leitor, a barra da Prancheta ganhou um terceiro botão, "Copiar", que leva o trecho à área de transferência e desfaz a seleção.
  - Testes: na casca simulada, o toque na página do EPUB e do PDF avisa que começou no leitor, e o toque no quadro e na barra do leitor avisa que não; copiar confere o texto na área de transferência, no EPUB e no PDF. As 7 mutações deste ajuste foram acusadas. A casca compila, e os testes nativos passam.
  - O que só o Boox confirma: que o menu do Android some de fato dentro do leitor e que a seleção continua de pé. O comportamento do menu vazio depende da versão do Android da Onyx e não pôde ser testado aqui.

## Resultado
