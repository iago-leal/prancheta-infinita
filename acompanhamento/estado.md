---
tipo: estado
atualizado_em: 2026-11-08
fase: Prancheta independente do claude.ai
plano_ativo: acompanhamento/planos/002-prancheta-independente/plano.md
etapa_atual: acompanhamento/planos/002-prancheta-independente/etapas/05-banco-local.md
bloqueios: []
---

# Estado atual

## Visão

A Prancheta Infinita hoje é um artefato do claude.ai: um `index.html` de cerca de 292 KB, acompanhado de seis áudios do roteiro guiado. O objetivo é torná-la uma aplicação independente, que funciona sem internet e se sincroniza com a VPS do autor, cujo uso principal é escrever à mão e reorganizar quadros no Boox Note Air4 C. Mais adiante, ela deve permitir ler PDFs e e-books e ligar marcações a quadros.

## Decisões vigentes

- Aplicação web com uma casca Android no Boox que usa a camada de tinta da Onyx: validada no Air4 C, com escrita tão rápida quanto a do aplicativo de notas, enquanto o navegador atrasa de 200 a 300 ms.
- Uso sem internet: os dados ficam num banco local em IndexedDB, dentro da página, no Boox e no computador, e a VPS serve para sincronizar quando houver rede.
- Independência por uma camada de compatibilidade que responde pela mesma porta `claude.use(...)` do artefato, para não reescrever o código.
- Conversa com o Claude e conectores MCP fora da primeira versão, porque exigem chave de API paga e configuração de cada conector.
- Tinta livre com laço, setas que acompanham a seleção e "manter junto" sob demanda, sem agrupamento automático, para que a Prancheta nunca precise adivinhar.
- No Boox, a caneta escreve, um dedo seleciona e arrasta, e dois dedos movem e ampliam o quadro.
- Reorganização pensada para e-ink já na primeira versão: contorno durante o arrasto, mover por toque e modo e-ink sem sombras, animações ou transparências.
- Cada traço guarda identificador, posição e horário, para permitir agrupamento e transcrição no futuro.
- A Prancheta independente começa com o banco limpo: os dados do artefato não serão migrados, por decisão do autor.
- Sempre que a página apagar traços, a casca redesenha a tela inteira, porque os traços provisórios da Onyx só somem assim.
- Publicação na VPS pelo GitHub: o fluxo `.github/workflows/publicar.yml` chama a VPS a cada envio à `main`, com uma chave guardada nos segredos do repositório e restrita a uma ação fixa. Por enquanto, a ação só confirma o canal; publicar de fato entra no plano 003.

## Em andamento

Plano 002, Prancheta independente do claude.ai: as etapas 01 e 02 estão concluídas, com o código do artefato em `web/` e o inventário. Depois de o autor decidir pelo banco limpo e pelo uso sem internet, as etapas 03 e 04 foram descartadas, e as etapas 05, banco local, e 06, Prancheta sem internet, as substituem. O plano 001, experimento da casca Android, foi concluído: a versão 0.1.1 da casca passou no teste do autor no Boox.

## Próximo passo

Iniciar a etapa 05, o banco local em IndexedDB, com o banco começando vazio. No início da próxima sessão em contêiner novo, confirmar que o script de configuração rodou, verificando se `/opt/android-sdk` existe.

## Planos previstos

1. 001: experimento da casca Android, concluído.
2. 002: Prancheta independente do claude.ai, ativo.
3. Sincronização com a VPS, implantação, autenticação e a Prancheta real empacotada dentro da casca, para abrir sem internet no Boox.
4. Modo e-ink e ferramentas de reorganização.

## Ambiente de nuvem

Ambiente pessoal `prancheta-infinita`: rede limitada, com registros de pacotes, servidores MCP e os hosts `dl.google.com` e `repo.boox.com` liberados; nenhuma variável ou segredo. O script de configuração instala o Android SDK em `/opt/android-sdk` e, se a pasta `android/` existir no branch carregado, cria o `local.properties` e compila a casca.

## Dúvidas em aberto

- Como distribuir as próximas versões do APK: release do GitHub, artefato de CI ou o aplicativo do Claude, como até agora?
- O que fazer quando o plugin Android 10 remover o Jetifier, se o SDK da Onyx ainda depender de bibliotecas anteriores ao AndroidX?
- O APK tem 21 MB por trazer bibliotecas nativas de cinco arquiteturas; vale restringi-lo às arquiteturas ARM?
