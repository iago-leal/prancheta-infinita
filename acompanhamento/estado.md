---
tipo: estado
atualizado_em: 2026-11-08
fase: Prancheta independente do claude.ai
plano_ativo: acompanhamento/planos/002-prancheta-independente/plano.md
etapa_atual: acompanhamento/planos/002-prancheta-independente/etapas/03-servidor-de-compatibilidade.md
bloqueios: []
---

# Estado atual

## Visão

A Prancheta Infinita hoje é um artefato do claude.ai: um `index.html` de cerca de 292 KB, acompanhado de seis áudios do roteiro guiado. O objetivo é torná-la uma aplicação independente, hospedada na VPS do autor, cujo uso principal é escrever à mão e reorganizar quadros no Boox Note Air4 C. Mais adiante, ela deve permitir ler PDFs e e-books e ligar marcações a quadros.

## Decisões vigentes

- Aplicação web na VPS, com uma casca Android no Boox que usa a camada de tinta da Onyx: validada no Air4 C, com escrita tão rápida quanto a do aplicativo de notas, enquanto o navegador atrasa de 200 a 300 ms.
- Independência por uma camada de compatibilidade que responde pela mesma porta `claude.use(...)` do artefato, para não reescrever o código.
- Conversa com o Claude e conectores MCP fora da primeira versão, porque exigem chave de API paga e configuração de cada conector.
- Tinta livre com laço, setas que acompanham a seleção e "manter junto" sob demanda, sem agrupamento automático, para que a Prancheta nunca precise adivinhar.
- No Boox, a caneta escreve, um dedo seleciona e arrasta, e dois dedos movem e ampliam o quadro.
- Reorganização pensada para e-ink já na primeira versão: contorno durante o arrasto, mover por toque e modo e-ink sem sombras, animações ou transparências.
- Cada traço guarda identificador, posição e horário, para permitir agrupamento e transcrição no futuro.
- A Prancheta independente começa com o banco limpo: os dados do artefato não serão migrados, por decisão do autor.
- Sempre que a página apagar traços, a casca redesenha a tela inteira, porque os traços provisórios da Onyx só somem assim.

## Em andamento

Plano 002, Prancheta independente do claude.ai: as etapas 01 e 02 estão concluídas: o código do artefato está em `web/`, com o inventário, e os dados foram exportados, mas o autor decidiu começar com o banco limpo, então a importação foi dispensada. O plano 001, experimento da casca Android, foi concluído: a versão 0.1.1 da casca passou no teste do autor no Boox.

## Próximo passo

Iniciar a etapa 03, o servidor de compatibilidade, com o banco começando vazio. No início da próxima sessão em contêiner novo, confirmar que o script de configuração rodou, verificando se `/opt/android-sdk` existe.

## Planos previstos

1. 001: experimento da casca Android, concluído.
2. 002: Prancheta independente do claude.ai, ativo.
3. Implantação na VPS, com autenticação, e a Prancheta real dentro da casca.
4. Modo e-ink e ferramentas de reorganização.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e os hosts `dl.google.com` e `repo.boox.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk` e, se a pasta `android/` existir no branch carregado, cria o `local.properties` e compila a casca.

## Dúvidas em aberto

- Como distribuir as próximas versões do APK: release do GitHub, artefato de CI ou o aplicativo do Claude, como até agora?
- O que fazer quando o plugin Android 10 remover o Jetifier, se o SDK da Onyx ainda depender de bibliotecas anteriores ao AndroidX?
- O APK tem 21 MB por trazer bibliotecas nativas de cinco arquiteturas; vale restringi-lo às arquiteturas ARM?
