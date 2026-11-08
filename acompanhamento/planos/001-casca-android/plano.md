---
tipo: plano
id: "001"
titulo: Experimento da casca Android
status: em_andamento
criado_em: 2026-11-07
concluido_em:
---

# Plano 001: experimento da casca Android

## Objetivo

Verificar, no Boox Note Air4 C do autor, se uma casca Android que exibe a Prancheta numa WebView e usa o SDK da Onyx para a tinta oferece escrita à mão confortável.

## Por que agora

É a suposição mais arriscada do projeto. Se ela falhar, a forma do produto muda, e é melhor descobrir isso antes de investir na migração do artefato.

## Critério de conclusão do plano

- [ ] A decisão de arquitetura está registrada neste plano e em `acompanhamento/estado.md`, com base no teste feito no aparelho.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-ambiente-compilando-apk.md) | Ambiente de nuvem compilando um APK mínimo | concluida |
| [02](etapas/02-webview-e-pagina-de-teste.md) | WebView com página de teste e ponte JavaScript | concluida |
| [03](etapas/03-camada-onyx.md) | Camada de tinta da Onyx ligada à página | concluida |
| [04](etapas/04-teste-no-boox.md) | Teste no Boox e decisão | pendente |

## Riscos

- A documentação do SDK da Onyx é escassa, e o comportamento varia com o firmware.
- O teste da caneta depende do aparelho do autor; a nuvem só compila o APK e testa a página no Chromium.
- O Android SDK ocupa espaço considerável na cota fixa de disco da sessão.

## Fora do escopo

- Trazer o código do artefato para o repositório e criar a camada de compatibilidade.
- Implantação na VPS.
- Modo e-ink e ferramentas de reorganização.
