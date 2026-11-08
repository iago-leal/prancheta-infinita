---
tipo: etapa
plano: "003"
etapa: "03"
titulo: Servidor de sincronização
status: pendente
depende_de: []
iniciada_em:
concluida_em:
---

# Etapa 03: servidor de sincronização

## Objetivo

Criar o servidor que vai rodar na VPS e guardar a cópia central dos quadros: ele recebe as mudanças de cada aparelho e devolve as dos outros, no formato do banco local, e só atende quem tem a chave de acesso do autor.

## Critérios de conclusão

- [ ] O servidor recebe e devolve mudanças de documentos e de arquivos enviados no formato do banco local da etapa 05 do plano 002, sem converter os dados.
- [ ] Cada mudança recebida ganha uma posição no registro do servidor, e um aparelho pede só o que veio depois da última posição que já recebeu.
- [ ] Sem a chave de acesso, o servidor responde 401 a qualquer pedido e não revela nenhum dado; a chave não está no repositório.
- [ ] Os dados ficam em disco e sobrevivem a reiniciar o servidor.
- [ ] Testes automatizados cobrem cada rota, a autenticação, mudanças repetidas pelo mesmo aparelho e mudanças de aparelhos diferentes no mesmo documento.

## Registro

## Resultado
