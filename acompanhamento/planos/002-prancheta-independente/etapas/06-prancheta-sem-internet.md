---
tipo: etapa
plano: "002"
etapa: "06"
titulo: Cliente de compatibilidade e Prancheta sem internet
status: pendente
depende_de: ["05"]
iniciada_em:
concluida_em:
---

# Etapa 06: cliente de compatibilidade e Prancheta sem internet

## Objetivo

Ligar o código do artefato ao banco local da etapa 05 por um `window.claude.use(nome)` carregado antes dele, com o mínimo de mudanças no código original, e confirmar que a Prancheta funciona inteira sem depender de nenhum servidor para guardar ou ler dados.

## Critérios de conclusão

- [ ] `claude.use('db')` entrega o banco local da etapa 05, e `assets`, `downloads`, `user` e `permissions` têm equivalentes que funcionam sem rede.
- [ ] Os recursos sem equivalente, como a conversa com o Claude, os conectores MCP, os comentários e a autopublicação, ficam indisponíveis sem erros, e a interface esconde o que depende deles.
- [ ] A página não faz nenhuma requisição a servidores externos: a `perfect-freehand` e a fonte são entregues junto com a página.
- [ ] Testes no Chromium criam um quadro com cartão, seta, traço e imagem com o servidor que entrega a página já inacessível, recarregam a página depois e confirmam que tudo persistiu.
- [ ] Duas abas abertas no mesmo quadro veem as mudanças uma da outra.
- [ ] As mudanças feitas no código original estão listadas, com o motivo de cada uma.

## Registro

## Resultado
