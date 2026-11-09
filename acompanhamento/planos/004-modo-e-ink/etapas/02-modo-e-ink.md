---
tipo: etapa
plano: "004"
etapa: "02"
titulo: Modo e-ink na casca e refazer com três dedos
status: em_andamento
depende_de: ["01"]
iniciada_em: 2026-11-09
concluida_em:
---

# Etapa 02: modo e-ink na casca e refazer com três dedos

## Objetivo

Adaptar a aparência da Prancheta na casca ao e-ink do Boox, sem sombras, transições, animações ou fundos translúcidos, que o e-ink mostra como manchas cinzas, com a ferramenta ativa e os itens selecionados bem destacados; e fazer o refazer por dois toques seguidos de três dedos funcionar no Boox, como o desfazer com dois dedos já funciona.

## Critérios de conclusão

- [x] Na casca, nenhum elemento da interface tem sombra, transição ou animação.
- [x] Na casca, a ferramenta ativa e os botões ligados aparecem invertidos, com fundo escuro e ícone claro, e os itens selecionados ganham contorno escuro e contínuo.
- [x] Na casca, menus, barra de seleção e diálogos têm fundo opaco e borda fina, sem escurecer a tela atrás deles.
- [ ] Dois toques seguidos com três dedos refazem no Boox; sem nada a desfazer ou refazer, a Prancheta avisa com "Nada a desfazer" ou "Nada a refazer".
- [x] No navegador do computador, a aparência não muda.
- [ ] O autor confirma no Boox que a tela fica legível, sem manchas cinzas, e que a ferramenta ativa se destaca.

## Registro

### 2026-11-09

- O autor aprovou estes critérios. Pediu também a seleção por laço e um botão só para as formas, a linha e os símbolos elétricos, que ficaram para a etapa 03, por escolha dele.
- O autor relatou que, no Boox com a 0.3.7, dois toques seguidos com dois dedos desfazem, mas dois toques seguidos com três dedos não refazem: nada acontece, mesmo logo depois de desfazer. No código, a lista do que refazer só é zerada ao trocar de quadro ou ao gravar uma mudança nova; o gesto, portanto, não chega a ser reconhecido. No Chromium, com toques simulados, ele funciona.
- Causa provável da falha: o Boox tem um gesto de sistema de captura de tela com três dedos, que pode tomar os toques de três dedos e cancelá-los no aplicativo, e a Prancheta, desde a 0.3.5, ignora todo gesto cancelado; o desfazer com dois dedos não passa por isso. Como a página não vê o que a casca e o sistema fazem com os toques, a correção veio com um diagnóstico.
- Modo e-ink, só na casca, no adaptador `web/app/compat/casca.js`: nenhuma sombra, transição ou animação; a cor de destaque vira a cor do texto, o que deixa o contorno dos itens selecionados escuro e contínuo; a ferramenta ativa e os botões ligados ficam invertidos, com fundo escuro e ícone claro; menus, barra de seleção, opções da caneta e atalhos têm fundo opaco e borda fina; o diálogo de sincronização não escurece mais a tela, e a prévia de arquivos tem fundo opaco.
- Gestos, com quatro mudanças novas na lista da página, agora 19, e duas revistas: o toque duplo vale com o maior número de dedos dos dois toques, até 500 ms entre eles; um toque de três ou mais dedos pode durar até 650 ms e cada dedo se deslocar até 28 px; um toque de três ou mais dedos curto e parado ainda conta se for cancelado, como faz o sistema do Boox; e, sem nada a desfazer ou refazer, aparece "Nada a desfazer" ou "Nada a refazer".
- Diagnóstico: o item "Ligar diagnóstico do traço e dos toques", em "Mais opções", mostra num aviso cada gesto de dedos, com o número de dedos, a duração e se houve movimento ou cancelamento; a casca avisa também os toques que ela mesma descarta ou cancela, com o motivo, como a caneta perto, um contato largo tido como palma ou o cancelamento pelo sistema.
- Testes: 4 testes novos no Chromium, 65 na web, e 1 JUnit novo, 36 na casca; acusam as 13 mutações introduzidas nos gestos, no diagnóstico e no estilo e as 3 no relato dos motivos. O detector da skill Impeccable não apontou problemas. Versão 0.3.8 da casca, código 12.
- Os critérios 1, 2, 3 e 5 foram verificados pelos testes "na casca, a página fica sem sombras, transições, animações e fundos translúcidos" e "no navegador, a aparência continua com as sombras e o destaque de antes". Faltam o critério 4, o refazer com três dedos no Boox, e a confirmação do autor; se o refazer ainda falhar, o diagnóstico mostra o motivo, e desligar a captura de tela com três dedos, em Configurações, Mais configurações, Capturas de tela, é o teste seguinte.

## Resultado
