---
tipo: etapa
plano: "003"
etapa: "03"
titulo: Servidor de sincronização
status: concluida
depende_de: []
iniciada_em: 2026-11-08
concluida_em: 2026-11-08
---

# Etapa 03: servidor de sincronização

## Objetivo

Criar o servidor que vai rodar na VPS e guardar a cópia central dos quadros: ele recebe as mudanças de cada aparelho e devolve as dos outros, no formato do banco local, e só atende quem tem a chave de acesso do autor.

## Critérios de conclusão

- [x] O servidor recebe e devolve mudanças de documentos e de arquivos enviados no formato do banco local da etapa 05 do plano 002, sem converter os dados.
- [x] Cada mudança recebida ganha uma posição no registro do servidor, e um aparelho pede só o que veio depois da última posição que já recebeu.
- [x] Sem a chave de acesso, o servidor responde 401 a qualquer pedido e não revela nenhum dado; a chave não está no repositório.
- [x] Os dados ficam em disco e sobrevivem a reiniciar o servidor.
- [x] Testes automatizados cobrem cada rota, a autenticação, mudanças repetidas pelo mesmo aparelho e mudanças de aparelhos diferentes no mesmo documento.

## Registro

### 2026-11-08

- O servidor fica em `servidor/`, em Node puro, sem dependências, para que a VPS só precise do Node 18 ou mais novo: `armazem.cjs` guarda os dados, `servidor.cjs` atende os pedidos, e `LEIA-ME.md` descreve o uso, as rotas e o formato em disco.
- Formato: cada aparelho envia o registro do documento exatamente como o banco local o guarda, com o número da mudança no registro de mudanças dele e a base, a posição da versão que tinha recebido do servidor. O servidor confere só a forma do registro e não examina nem converte os dados.
- Cada mudança aceita ganha a próxima posição. `GET /sync/mudancas?desde=P` devolve a versão atual de cada documento e os dados de cada arquivo mudados depois de `P`, uma vez cada, em páginas, e o aparelho guarda a posição até onde recebeu.
- Repetição: o par aparelho e número da mudança torna o reenvio inofensivo, com o estado `repetida` e a mesma posição.
- Conflito: uma mudança cuja base não é a versão atual não sobrescreve o documento; a resposta traz a versão atual para o aparelho combinar e reenviar, o que a etapa 04 faz item a item. Uma mudança sobre a versão que o próprio aparelho gravou antes não é conflito, porque ele já a conhecia.
- Arquivos: `PUT` e `GET /sync/arquivos/<id>`, com o id do banco local; o mesmo arquivo reenviado é `repetido`, e outro conteúdo com o mesmo id é recusado com 409. Limites de 25 MB para arquivos e para o JSON.
- Chave: só pela variável `PRANCHETA_CHAVE`, com pelo menos 32 caracteres; sem ela, o servidor não inicia. A comparação usa resumos SHA-256 e `timingSafeEqual`. Sem a chave, qualquer rota, mesmo inexistente, responde 401 com `{"erro":"nao_autorizado"}`.
- Ponto para o autor sobre o critério 3: a página da casca Android tem outra origem que o servidor, e o navegador, antes de um pedido com a chave, faz uma consulta prévia sem ela, que não recebe dados. O servidor responde essa consulta com 204 e o corpo vazio só para as origens aceitas, por padrão a da casca, e com 401 para as demais. Como o critério diz 401 a qualquer pedido sem a chave, ele fica sem marca até o autor aceitar essa exceção ou preferir outro caminho, como a casca fazer os pedidos por código nativo.
- Disco: `registro.jsonl`, uma linha por mudança; `documentos/<sha256 do caminho>.json`, a versão atual de cada documento; `arquivos/<id>.bin` e `.json`. Cada gravação vai para um arquivo temporário e é renomeada, e só depois entra a linha do registro; ao abrir, uma linha cortada no fim do registro é descartada, e um documento gravado sem a linha ganha a que faltava.
- Testes: `servidor/testes/servidor.test.cjs`, 10 no total, aprovados em três rodadas seguidas; o fluxo `.github/workflows/servidor.yml` os roda nos Node 18 e 22 a cada mudança em `servidor/`. Verificação por mutação: os testes acusam as 12 mutações introduzidas no armazém e no servidor.
- Descoberta: cortar a conexão no meio de um envio grande demais impedia o cliente de ler o 413; o servidor passou a descartar o excesso e responder no fim, cortando a conexão só se o envio passar quatro vezes o limite.
- Decisão do autor, em 2026-11-08, sobre o critério "Sem a chave de acesso, o servidor responde 401 a qualquer pedido e não revela nenhum dado; a chave não está no repositório": ele aceitou a exceção da consulta prévia do navegador. Essa consulta, que não leva a chave, recebe 204 com o corpo vazio só quando vem de uma origem aceita, por padrão a da casca; qualquer outro pedido sem a chave continua recebendo 401. Com isso, a etapa 04 pode sincronizar pela própria página, sem um caminho nativo na casca.
- Mesclado o PR #15 no `main`, com os testes do servidor aprovados nos Node 18 e 22.

## Resultado

Etapa concluída em 2026-11-08. Os critérios foram verificados pelos testes de `servidor/testes/servidor.test.cjs`, aprovados localmente no `main` depois da mesclagem e no fluxo `.github/workflows/servidor.yml`, nos Node 18 e 22:

1. Formato do banco local: o teste "grava e devolve os documentos no formato do banco local, sem converter" envia registros como o banco local os guarda e confere que voltam idênticos; o teste "arquivos enviados são guardados, listados e devolvidos" faz o mesmo com os arquivos, byte a byte.
2. Posições: o teste "cada mudança ganha uma posição, e o aparelho pede só o que veio depois da última que recebeu" confere a numeração em sequência, a lista a partir de uma posição e a paginação.
3. Chave: o teste "sem a chave, responde 401 a qualquer pedido, sem revelar dados" tenta cada rota, uma rota inexistente e um método não previsto sem chave, com uma chave errada e com chaves que diferem num caractere, e confere o 401 sem nenhum dado gravado no corpo; confere também a exceção aceita pelo autor, a consulta prévia respondida sem dados só para a origem da casca. O teste "o servidor não inicia sem uma chave de acesso, que não fica no repositório" confere que o servidor se recusa a iniciar sem a chave ou com uma chave curta e que o código não traz chave nenhuma; a chave dos testes é fictícia e só existe neles.
4. Disco: o teste "os dados ficam em disco e sobrevivem a reiniciar o servidor" reabre o armazém na mesma pasta e confere documentos, arquivos, posições e reenvios; o teste "depois de uma queda, descarta a linha cortada e recupera o documento gravado sem linha" simula uma queda entre as duas gravações.
5. Cobertura: além dos testes acima, "mudanças repetidas pelo mesmo aparelho não se duplicam", "mudanças de aparelhos diferentes no mesmo documento não se sobrescrevem às cegas" e "recusa pedidos malformados sem gravar nada" completam as rotas, a autenticação e os dois casos pedidos; os testes acusam as 12 mutações introduzidas no armazém e no servidor.
