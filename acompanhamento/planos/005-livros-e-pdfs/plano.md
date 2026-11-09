---
tipo: plano
id: "005"
titulo: Livros e PDFs, com rede privada e cifra
status: em_andamento
criado_em: 2026-11-09
concluido_em:
---

# Plano 005: livros e PDFs, com rede privada e cifra

## Objetivo

Ler no Boox e no computador os livros e PDFs da biblioteca do WebDAV da VPS, com marcações ligadas a quadros. Antes disso, pôr a Prancheta numa rede privada, com o Tailscale, e fechar o endereço público dela, e cifrar os quadros ponta a ponta, de modo que a VPS guarde só dados cifrados.

## Por que agora

Os planos 003 e 004 deixaram a escrita no Boox e a sincronização com o computador em uso diário. O passo seguinte da visão é ler PDFs e e-books e ligar marcações a quadros. O debate de segurança de 2026-11-08, aceito pelo autor, pôs a rede privada e a cifra dos dados antes dos livros, porque a biblioteca do WebDAV passaria a ser entregue pelo servidor da Prancheta.

## Critério de conclusão do plano

- [ ] No Boox, com o Tailscale ligado, o autor abre na Prancheta um livro ou PDF da biblioteca do WebDAV, faz uma marcação e a liga a um quadro, e a marcação aparece no computador depois da sincronização; o endereço público da Prancheta não responde, e a VPS guarda os quadros só cifrados.

## Etapas

| Etapa | Título | Status |
|---|---|---|
| [01](etapas/01-rede-privada.md) | Rede privada com o Tailscale e endereço público fechado | em_andamento |
| 02 | Cifra ponta a ponta dos quadros | pendente |
| 03 | Biblioteca do WebDAV entregue pela Prancheta | pendente |
| 04 | Leitor de PDF e EPUB com marcações ligadas a quadros | pendente |

As decisões de 2026-11-09, do autor: a rede privada usa o Tailscale; depois que ela funcionar, o endereço público da Prancheta fecha de vez, para a página, a sincronização e os livros; a cifra é ponta a ponta, com a senha só nos aparelhos. As etapas 02 a 04 serão detalhadas com o autor antes de começar.

## Riscos

- O Tailscale no Boox ocupa a vaga de VPN do Android e precisa conviver com a casca e com a camada da Onyx; o primeiro passo da etapa 01 é testar isso.
- No computador, a Prancheta passa a abrir por outro endereço, e o banco local do navegador pertence a cada endereço: tudo o que estiver só no banco antigo precisa ser sincronizado antes da troca.
- Com o endereço público fechado, a conferência de cada publicação pelo GitHub não alcança mais a Prancheta pela internet e precisa ser feita na própria VPS.
- Na cifra ponta a ponta, perder a senha torna ilegível a cópia da VPS; a recuperação depende de um aparelho que ainda tenha os quadros.
- O repositório é público: o nome da VPS na rede privada, as chaves do Tailscale, a senha da cifra e os caminhos do WebDAV nunca entram nele.

## Fora do escopo

- Mais de um usuário e compartilhamento de quadros.
- Conversa com o Claude e conectores MCP.
- Edição dos livros e PDFs; a biblioteca é só de leitura.
