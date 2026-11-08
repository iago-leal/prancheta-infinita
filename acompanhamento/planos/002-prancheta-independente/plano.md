---
tipo: plano
id: "002"
titulo: Prancheta independente do claude.ai
status: em_andamento
criado_em: 2026-11-08
concluido_em:
---

# Plano 002: Prancheta independente do claude.ai

## Objetivo

Fazer a Prancheta, com os quadros que o autor já tem no artefato, rodar fora do claude.ai, num servidor próprio, por meio de uma camada de compatibilidade que responde pela mesma porta `claude.use(...)` que o código do artefato usa.

## Por que agora

A casca Android foi validada no plano 001, e o que falta para usar a Prancheta de verdade no Boox é tê-la funcionando fora do claude.ai. Além disso, os quadros do autor continuam crescendo dentro do artefato, então exportá-los cedo reduz o risco de perdê-los.

## Critério de conclusão do plano

- [ ] A Prancheta, com os quadros exportados do artefato, roda num servidor local fora do claude.ai, sem requisições a servidores externos, e os testes no Chromium passam.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-codigo-do-artefato.md) | Código do artefato no repositório | concluida |
| [02](etapas/02-exportacao-dos-dados.md) | Exportação dos dados do artefato | concluida |
| [03](etapas/03-servidor-de-compatibilidade.md) | Servidor de compatibilidade | pendente |
| [04](etapas/04-cliente-de-compatibilidade.md) | Cliente de compatibilidade e Prancheta rodando fora do claude.ai | pendente |

## Mudança de escopo

Em 2026-11-08, depois da exportação da etapa 02, o autor decidiu que a Prancheta independente começa com o banco limpo: os dados do artefato não serão migrados. Por isso, ficam dispensados pelo autor o trecho "com os quadros exportados do artefato" do critério de conclusão do plano, o critério de importação da etapa 03 e o critério dos quadros importados da etapa 04. Os textos dos critérios ficam como foram escritos, e o Resultado de cada etapa aponta o que foi dispensado. A exportação já feita e suas ferramentas continuam no repositório, caso o autor mude de ideia.

## Riscos

- A interface exata dos recursos do claude.ai não é documentada publicamente; a camada imita apenas o que o código do artefato usa, conforme o inventário da etapa 01.
- O código é um único arquivo de cerca de 2.750 linhas; mudanças nele devem ser mínimas até haver testes que protejam o comportamento.
- Os quadros contêm dados pessoais do autor, e o lugar onde a exportação fica guardada precisa da aprovação dele.
- As assinaturas em tempo real do banco exigem um canal contínuo entre servidor e página, como WebSocket ou eventos enviados pelo servidor.

## Fora do escopo

- Implantação na VPS e autenticação, previstas para o plano 003.
- Ligar a Prancheta real à casca Android, o que depende de um servidor acessível pelo Boox, também previsto para o plano 003.
- Modo e-ink e ferramentas de reorganização, previstos para o plano 004.
- Conversa com o Claude, conectores MCP, comentários e autopublicação do código.
