---
name: acompanhamento
description: Modelos e procedimentos para registrar o andamento do projeto na pasta acompanhamento/, com estado atual, diário de progresso, planos e etapas.
when_to_use: Ao iniciar ou encerrar uma sessão de trabalho, ao abrir um plano, ao iniciar, registrar ou concluir uma etapa e ao rever uma decisão vigente.
---

# Acompanhamento do projeto

## Papel de cada arquivo

| Arquivo | Pergunta que responde | Como muda |
|---|---|---|
| `acompanhamento/estado.md` | Onde estamos agora? | Reescrito sempre que algo muda; tem no máximo 60 linhas e é importado pelo `AGENTS.md` em toda sessão |
| `acompanhamento/progresso.md` | O que aconteceu e quando? | Recebe uma entrada nova no topo a cada sessão; entradas antigas nunca são reescritas |
| `acompanhamento/planos/NNN-nome/plano.md` | O que o plano pretende e em que pé está? | Atualizado quando uma etapa muda de status |
| `acompanhamento/planos/NNN-nome/etapas/NN-nome.md` | O que foi feito nesta etapa? | O Registro recebe entradas datadas, e o Resultado é preenchido ao concluir |

Cada informação tem um único lugar. Os detalhes de uma etapa ficam na etapa; o progresso apenas resume e aponta para ela; o estado mostra só o presente.

## Vocabulário de status

- Etapa: `pendente`, `em_andamento`, `concluida`, `bloqueada` ou `descartada`.
- Plano: `pendente`, `em_andamento`, `concluido` ou `descartado`.

Números de plano e de etapa vão entre aspas no YAML, como `"001"` e `"02"`, para não perderem os zeros à esquerda.

## Procedimentos

### Iniciar uma sessão

1. O estado já chega carregado pelo `AGENTS.md`.
2. Leia as duas entradas mais recentes de `progresso.md`.
3. Rode `git log --oneline -15`.
4. Se houver plano ativo, leia o `plano.md` e a etapa apontada em `etapa_atual`.

### Abrir um plano

1. Escolha o próximo número, com três dígitos, e um nome curto em minúsculas e com hífens, como `planos/002-camada-compatibilidade/`.
2. Crie o `plano.md` a partir do modelo abaixo e uma etapa por arquivo em `etapas/`, numeradas com dois dígitos.
3. Escreva critérios de conclusão verificáveis: um comando que passa, um teste que fica verde ou um comportamento observável.
4. Atualize `plano_ativo`, `etapa_atual` e as seções Em andamento e Próximo passo do estado.

### Iniciar uma etapa

1. Confirme que as etapas listadas em `depende_de` estão concluídas.
2. Mude o `status` para `em_andamento` e preencha `iniciada_em`.
3. Atualize o status na tabela do plano e a `etapa_atual` no estado.

### Registrar durante o trabalho

Acrescente à seção Registro da etapa uma entrada `### AAAA-MM-DD` com o que foi feito, as descobertas, os desvios e os comandos relevantes. Não apague entradas anteriores.

### Concluir uma etapa

1. Verifique cada critério e marque com `[x]` apenas os que passaram, sem alterar o texto deles.
2. Se todos passaram, mude o `status` para `concluida`, preencha `concluida_em` e escreva o Resultado, dizendo como cada critério foi verificado.
3. Se um critério se mostrou errado, não o altere: registre o problema e consulte o autor. Se a etapa não puder avançar, use `bloqueada` e informe o motivo em `bloqueios` no estado.
4. Atualize a tabela do plano e aponte `etapa_atual` para a etapa seguinte. Se era a última, verifique o critério do plano e conclua-o.

### Dispensar um critério

Só o autor dispensa um critério. Quando isso acontecer, não altere nem marque o critério: registre a decisão, com a data e o texto do critério, no Registro da etapa, ou numa seção "Mudança de escopo" do plano, quando afetar o plano. No Resultado, aponte o critério como dispensado pelo autor. Uma etapa pode ser concluída quando todos os critérios restantes foram verificados.

### Encerrar uma sessão

1. Acrescente no topo de `progresso.md`, logo abaixo do parágrafo de abertura, uma entrada baseada no modelo abaixo.
2. Reescreva o estado para refletir o presente, mantendo-o com no máximo 60 linhas.
3. Faça o commit dessas atualizações junto com o trabalho a que se referem.

### Rever uma decisão

Altere ou remova a linha correspondente em Decisões vigentes, no estado, e registre na entrada de progresso do dia a decisão antiga, a nova e o motivo da mudança.

## Modelos

### Entrada de progresso

Seções sem conteúdo podem ser omitidas.

```markdown
## AAAA-MM-DD · Título curto da sessão

### Feito

- O que foi concluído, com links para etapas quando houver.

### Decidido

- **Decisão.** Motivo e contexto.

### Ideias guardadas

- Ideia que vale retomar depois.

### Pendências

- O que ficou para a próxima sessão.

### Referências

- Commits, PRs e links consultados.
```

### Plano

```markdown
---
tipo: plano
id: "NNN"
titulo: Título do plano
status: em_andamento
criado_em: AAAA-MM-DD
concluido_em:
---

# Plano NNN: título do plano

## Objetivo

## Por que agora

## Critério de conclusão do plano

- [ ] Critério verificável.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-nome.md) | Título da etapa | pendente |

## Riscos

## Fora do escopo
```

### Etapa

```markdown
---
tipo: etapa
plano: "NNN"
etapa: "NN"
titulo: Título da etapa
status: pendente
depende_de: []
iniciada_em:
concluida_em:
---

# Etapa NN: título da etapa

## Objetivo

## Critérios de conclusão

- [ ] Critério verificável.

## Registro

## Resultado
```
