---
tipo: plano
id: "003"
titulo: Prancheta no Boox e sincronização com a VPS
status: em_andamento
criado_em: 2026-11-08
concluido_em:
---

# Plano 003: Prancheta no Boox e sincronização com a VPS

## Objetivo

Levar a Prancheta independente de `web/app/` para dentro da casca Android, para usá-la sem internet no Boox com a tinta da Onyx e um traço sensível à pressão que não muda quando a tela se atualiza, e sincronizar os quadros entre o Boox e o computador por meio da VPS, onde a Prancheta também fica publicada, com acesso protegido por uma chave.

## Por que agora

O plano 002 deixou a Prancheta funcionando sem internet no navegador, mas o uso principal é escrever à mão no Boox, onde só a casca dá a latência da tinta da Onyx. Além disso, enquanto não houver sincronização, cada aparelho guarda sozinho os seus quadros, e perder o aparelho ou limpar os dados do navegador apaga o que foi feito.

## Critério de conclusão do plano

- [ ] No Boox, a Prancheta abre pela casca sem internet e escreve com a tinta da Onyx; um quadro criado nela aparece no navegador do computador, aberto no endereço da VPS, depois que os dois aparelhos se conectam, e um quadro criado no computador aparece no Boox do mesmo modo.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-prancheta-na-casca.md) | Prancheta real dentro da casca | em_andamento |
| [02](etapas/02-traco-sensivel-a-pressao.md) | Traço sensível à pressão igual na Onyx e na página | pendente |
| [03](etapas/03-servidor-de-sincronizacao.md) | Servidor de sincronização | pendente |
| [04](etapas/04-sincronizacao-no-banco-local.md) | Sincronização no banco local | pendente |
| [05](etapas/05-publicacao-na-vps.md) | Publicação na VPS e acesso protegido | pendente |

As etapas 01 e 02 tratam do Boox, e as etapas 03 a 05, da sincronização; as duas frentes podem avançar em paralelo, mas a etapa 05 só fecha com a casca sincronizando.

## Riscos

- A WebView da casca pode não aceitar o service worker que entrega os arquivos enviados em `/_blob/<id>`; nesse caso, a casca precisa entregar esse caminho por conta própria, ou a Prancheta passa a embutir as imagens no quadro, como já faz sem service worker.
- O motor de canetas da Onyx é fechado; se o contorno calculado por ele não puder ser obtido para cada traço, resta aproximar o traço da página por calibração, com alguma diferença visível.
- Os itens de um quadro ficam agrupados em fragmentos; quando dois aparelhos mudam itens do mesmo fragmento, combinar por documento inteiro perderia edições, então a combinação precisa ser feita item a item.
- Os relógios do Boox e do computador podem divergir; a sincronização não deve ordenar mudanças só pelo horário.
- A VPS abriga outros serviços; o servidor da Prancheta precisa rodar isolado, numa conta sem privilégios, e as ações de administrador ficam com o autor.
- O repositório é público: a chave de acesso nunca entra no Git, e cada aparelho a recebe uma única vez, pelo autor.

## Fora do escopo

- Modo e-ink e ferramentas de reorganização, previstos para o plano 004.
- Leitura de PDFs e de e-books com marcações ligadas a quadros.
- Mais de um usuário e compartilhamento de quadros.
- Conversa com o Claude, conectores MCP, comentários e autopublicação do código.
- Cópias de segurança automáticas dos dados da VPS; até lá, cada aparelho guarda uma cópia completa dos quadros.
