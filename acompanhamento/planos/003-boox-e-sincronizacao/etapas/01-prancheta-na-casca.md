---
tipo: etapa
plano: "003"
etapa: "01"
titulo: Prancheta real dentro da casca
status: em_andamento
depende_de: []
iniciada_em: 2026-11-08
concluida_em:
---

# Etapa 01: Prancheta real dentro da casca

## Objetivo

Trocar a página de teste da casca pela Prancheta de `web/app/`, entregue de dentro do APK, e ligar a ponte da casca ao código do artefato, por mudanças listadas em `web/montagem/mudancas.cjs`, para que no Boox a caneta escreva com a tinta da Onyx, um dedo selecione e arraste, dois dedos movam e ampliem o quadro, e tudo funcione sem internet.

## Critérios de conclusão

- [ ] A compilação do APK copia a pasta `web/app/` do repositório para dentro dele, sem uma segunda cópia no Git, e a casca abre a Prancheta a partir dessa cópia, sem internet.
- [ ] Os traços feitos pela camada da Onyx viram traços da Prancheta, no lugar e na escala certos para qualquer zoom, guardados no banco local com identificador, pontos, pressão e horário.
- [ ] Um dedo seleciona e arrasta, dois dedos movem e ampliam o quadro, e a camada da Onyx acompanha a vista e não escreve sobre as barras da Prancheta.
- [ ] Imagens e arquivos enviados ficam no banco local e voltam a aparecer depois de fechar e reabrir o aplicativo.
- [x] Testes no Chromium cobrem a ponte com uma casca simulada, e testes JUnit cobrem a parte nativa nova.
- [ ] O autor confirma no Boox, sem internet, que escreve, reorganiza e reencontra o quadro depois de fechar e reabrir o aplicativo.

## Registro

### 2026-11-08

- A compilação da casca copia `web/app/` para os assets do APK, na pasta `app/`, por uma tarefa do Gradle, `copiarPrancheta`, registrada como fonte gerada de assets; o repositório guarda uma só versão da Prancheta. A página de teste do plano 001, sua cópia da `perfect-freehand` e os testes dela, em `android/testes/`, foram removidos; a casca abre `https://appassets.androidplatform.net/assets/app/index.html`. O teste da linha de base passou a usar a `perfect-freehand` de `web/app/vendor/`.
- O adaptador `web/app/compat/casca.js`, carregado pela segunda mudança da lista, liga a ponte ao código do artefato sem mudá-lo: recebe os traços da casca, converte os pontos da tela para o quadro com a vista atual, aplica à pressão a mesma curva que o artefato usa para a caneta no navegador e grava o traço pelo mesmo caminho dos traços feitos na página; avisa a casca da vista, das áreas reservadas, que são os elementos da interface que recebem toques, e da ferramenta ativa; e pede o redesenho da tela quando a vista muda ou traços são movidos ou apagados depois de a casca ter desenhado, para que o traço provisório da Onyx não fique fora do lugar. Fora da casca, o adaptador não faz nada.
- Comportamento escolhido para a caneta: com a ferramenta de seleção, que é a inicial, a caneta escreve pela camada da Onyx e um dedo seleciona e arrasta, como prevê a decisão sobre o Boox; com a caneta ou o marca-texto, a caneta escreve com a configuração deles e um dedo move o quadro; com a borracha, as formas, o texto e as demais ferramentas, a camada desliga, e a caneta age sobre a página, como um ponteiro. A ponte ganhou o aviso `Casca.canetaEscreve(booleano)`.
- Cada traço passa a guardar o horário de início, `em`, e a duração, `dur`, em milissegundos, pelas duas mudanças novas da lista, tanto os da casca quanto os feitos na página.
- O roteador de toques ganhou rejeição da palma: um toque de dedo que começa com a caneta encostada, ou até 400 ms depois do último sinal dela, tocando ou pairando, é descartado por inteiro. Sem isso, com a ferramenta de seleção, a mão apoiada ao escrever moveria o quadro ou arrastaria cartões. A casca registra a caneta pairando pelos eventos genéricos.
- A casca ganhou o seletor de arquivos do sistema, para inserir imagens e arquivos; a abertura de links externos no navegador do aparelho, para não trocar a Prancheta por outra página; e o encaminhamento dos pedidos do service worker aos assets, para que ele entregue `/_blob/<id>`. Se a WebView do Boox não oferecer service worker, a Prancheta embute as imagens no quadro, como já faz no navegador sem ele.
- Na casca, baixar arquivos, como a exportação em PNG, ainda não funciona, porque a WebView não entrega downloads sem tratamento próprio; fica registrado para depois.
- Versão 0.2.0 da casca, código 3. APK de 22 MB, SHA-256 `ac4f596a7e98c937bdca6b01c2012553bbaf4634cd49f0318b28b262bf053293`; a pasta `assets/app/` dele é idêntica a `web/app/`, conferida com `diff -r`.
- Testes: `web/testes/casca.test.cjs`, com 6 testes e uma casca simulada, e 4 testes JUnit novos do roteador, num total de 10. Verificação por mutação: os testes do adaptador acusam as 12 mutações introduzidas; os do roteador acusam as 5, depois de um ajuste no teste da caneta encostada, que antes só era coberto pela janela de tempo.
- Falta o teste do autor no Boox, que decide os critérios 1, 2, 3, 4 e 6.

## Resultado
