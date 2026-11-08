---
tipo: estado
atualizado_em: 2026-11-08
fase: experimento da casca Android
plano_ativo: acompanhamento/planos/001-casca-android/plano.md
etapa_atual: acompanhamento/planos/001-casca-android/etapas/03-camada-onyx.md
bloqueios: []
---

# Estado atual

## Visão

A Prancheta Infinita hoje é um artefato do claude.ai: um `index.html` de cerca de 292 KB, acompanhado de seis áudios do roteiro guiado. O objetivo é torná-la uma aplicação independente, hospedada na VPS do autor, cujo uso principal é escrever à mão e reorganizar quadros no Boox Note Air4 C. Mais adiante, ela deve permitir ler PDFs e e-books e ligar marcações a quadros.

## Decisões vigentes

- Aplicação web na VPS, com uma casca Android no Boox: no navegador do aparelho, a tinta atrasa de 200 a 300 ms, e só o SDK da Onyx oferece latência baixa.
- Independência por uma camada de compatibilidade que responde pela mesma porta `claude.use(...)` do artefato, para não reescrever o código.
- Conversa com o Claude e conectores MCP fora da primeira versão, porque exigem chave de API paga e configuração de cada conector.
- Tinta livre com laço, setas que acompanham a seleção e "manter junto" sob demanda, sem agrupamento automático, para que a Prancheta nunca precise adivinhar.
- No Boox, a caneta escreve, um dedo seleciona e arrasta, e dois dedos movem e ampliam o quadro.
- Reorganização pensada para e-ink já na primeira versão: contorno durante o arrasto, mover por toque e modo e-ink sem sombras, animações ou transparências.
- Cada traço guarda identificador, posição e horário, para permitir agrupamento e transcrição no futuro.

## Em andamento

Plano 001, experimento da casca Android. As etapas 01 e 02 estão concluídas, e a etapa 03 ainda não foi iniciada.

## Próximo passo

No início da próxima sessão, confirmar que o script de configuração rodou, verificando se `/opt/android-sdk` existe. Em seguida, iniciar a etapa 03, começando por descobrir de onde obter o SDK da Onyx: o `repo.boox.com` está bloqueado e só foi visto por HTTP, e o Boox E-Ink Draw depende de classes extraídas do aplicativo de notas.

## Planos previstos

1. 001: experimento da casca Android, ativo.
2. Código do artefato no repositório, com a camada de compatibilidade.
3. Implantação na VPS, com autenticação.
4. Modo e-ink e ferramentas de reorganização.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e o host `dl.google.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk` e, se a pasta `android/` existir no branch carregado, cria o `local.properties` e compila a casca.

## Dúvidas em aberto

- Como usar o SDK da Onyx sem copiar classes extraídas do aplicativo de notas da Boox?
- A camada da Onyx funciona sobre uma WebView sem bloquear os toques dos dedos?
- O salto entre o traço provisório do sistema e o traço final da Prancheta é tolerável?
- Como o APK chegará ao Boox: release do GitHub, artefato de CI ou outro meio?
