---
tipo: etapa
plano: "003"
etapa: "04"
titulo: Sincronização no banco local
status: pendente
depende_de: ["03"]
iniciada_em:
concluida_em:
---

# Etapa 04: sincronização no banco local

## Objetivo

Ensinar o banco local a conversar com o servidor da etapa 03: enviar as mudanças registradas desde a última sincronização, receber as dos outros aparelhos e combiná-las sem perder itens, sempre que houver rede, sem que a Prancheta dependa disso para funcionar.

## Critérios de conclusão

- [ ] Com rede, o banco local envia as mudanças registradas desde a última sincronização e recebe as dos outros aparelhos, sem travar a página, e as assinaturas avisam a Prancheta do que chegou.
- [ ] Quando dois aparelhos mudam o mesmo fragmento de um quadro, nenhum item se perde: os itens são combinados um a um, e a regra para o mesmo item mudado nos dois aparelhos está descrita no Registro.
- [ ] Sem rede, a Prancheta funciona como antes, e a sincronização retoma sozinha quando a rede volta.
- [ ] O registro de mudanças é podado depois de cada sincronização confirmada pelo servidor.
- [ ] O endereço do servidor e a chave de acesso são informados uma única vez em cada aparelho e ficam no banco local, fora do código.
- [ ] Testes no Chromium, com dois perfis de navegador e o servidor da etapa 03, confirmam que um quadro feito num perfil aparece no outro, inclusive com edições simultâneas e um período sem rede.

## Registro

## Resultado
