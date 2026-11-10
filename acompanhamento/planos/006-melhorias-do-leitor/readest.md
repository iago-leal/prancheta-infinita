# Levantamento do Readest

Feito em 2026-11-09, a pedido do autor, por um agente que leu o repositório e a wiki do Readest no GitHub, no commit 3ee24eb, e entregou só a descrição do comportamento, sem código. O site do Readest estava fora do alcance da rede da sessão. Este arquivo é a fonte das especificações usadas no plano 006; nada aqui é parecer jurídico.

## Licenças

- Readest: AGPL-3.0-or-later. Copiar código dele, ou traduzi-lo de TypeScript para JavaScript, tornaria a Prancheta uma obra derivada, sob a AGPL. Implementar o mesmo comportamento a partir de uma descrição em palavras próprias não traz essa obrigação.
- foliate-js, a biblioteca de leitura em que o Readest se baseia: MIT. Poderia substituir a epub.js no EPUB, mas o autor a declara instável, não há versões publicadas, e o PDF dela exige um pdf.js mais novo que o 3.11 da Prancheta. Decisão: manter a epub.js por enquanto.
- KOReader e o servidor de sincronização dele: AGPL-3.0.

## Comportamentos aproveitados no plano 006

- Tocar num destaque reabre a barra da seleção no estado do destaque: o botão de destacar vira o de apagar, e o estilo atual aparece para ser trocado; a troca preserva a nota, o texto e a data de criação.
- A nota fica no mesmo registro do destaque.
- A exclusão é marcada com a data, e não removida, para que os aparelhos a combinem.
- Estilos de destaque: realce, sublinhado e ondulado. No e-ink preto e branco, o realce aparece invertido, com opacidade total, e o sublinhado usa a cor da tinta.
- Virada de página pelo toque: a faixa central, de 37,5% a 62,5% da largura, mostra ou esconde os controles; a esquerda volta, e a direita avança. No modo e-ink, sem animação.
- Sumário na lateral e busca no texto, com escopo de livro ou de capítulo.

## Para planos futuros

- Progresso com o KOReader, pelo protocolo KOSync: quatro rotas, `POST /users/create`, `GET /users/auth`, `PUT /syncs/progress` e `GET /syncs/progress/:document`, com os cabeçalhos `X-Auth-User` e `X-Auth-Key`, esta o MD5 da senha. O documento é identificado pelo mesmo resumo parcial MD5 que a Prancheta já usa. Só o progresso é sincronizado: em livros refluíveis, um XPointer do crengine; em PDF, o número da página. Converter o XPointer em CFI exige regras próprias: `DocFragment[N]` é o item N−1 da ordem de leitura, e os deslocamentos contam o texto com os espaços colapsados.
- Escrita à mão sobre a página, lançada pelo Readest em outubro de 2026: pontos com posição relativa à página e pressão, traços presos a um intervalo de texto por CFI nos livros refluíveis, e, no Boox, a caneta da Onyx entregando o traço inteiro quando sobe.
- Exportação de destaques com a frase ao redor, e atualização de blocos exportados só quando o conteúdo ainda é o que o aparelho gravou.
- Formato de sincronização por WebDAV do Readest, com um `config.json` por livro, identificado pelo mesmo resumo: permitiria importar destaques feitos no Readest.
