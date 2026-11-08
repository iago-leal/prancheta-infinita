---
tipo: etapa
plano: "002"
etapa: "04"
titulo: Cliente de compatibilidade e Prancheta rodando fora do claude.ai
status: pendente
depende_de: ["03"]
iniciada_em:
concluida_em:
---

# Etapa 04: cliente de compatibilidade e Prancheta rodando fora do claude.ai

## Objetivo

Criar o `window.claude.use(nome)` que a página carrega antes do código do artefato e que conversa com o servidor da etapa 03, para que a Prancheta rode fora do claude.ai com o mínimo de mudanças no código original.

## Critérios de conclusão

- [ ] `claude.use('db')` reproduz os métodos e as formas de resposta que o artefato usa, e `assets`, `downloads`, `user` e `permissions` têm equivalentes.
- [ ] Os recursos sem equivalente, como a conversa com o Claude, os conectores MCP, os comentários e a autopublicação, ficam indisponíveis sem erros, e a interface esconde o que depende deles.
- [ ] A página não faz nenhuma requisição a servidores externos: a `perfect-freehand` e a fonte são servidas pelo próprio servidor.
- [ ] Testes no Chromium, com o servidor local, criam um quadro com cartão, seta e traço, recarregam a página e confirmam que tudo persistiu; duas páginas abertas no mesmo quadro veem as mudanças uma da outra.
- [ ] Os quadros importados na etapa 03 abrem e mostram o mesmo número de itens que tinham no artefato.
- [ ] As mudanças feitas no código original estão listadas, com o motivo de cada uma.

## Registro

### 2026-11-08

- Decisão do autor: a Prancheta independente começa com o banco limpo. O critério "Os quadros importados na etapa 03 abrem e mostram o mesmo número de itens que tinham no artefato." fica dispensado pelo autor e não será marcado.

## Resultado
