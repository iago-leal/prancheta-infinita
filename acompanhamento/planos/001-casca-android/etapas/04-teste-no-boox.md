---
tipo: etapa
plano: "001"
etapa: "04"
titulo: Teste no Boox e decisão
status: em_andamento
depende_de: ["03"]
iniciada_em: 2026-11-08
concluida_em:
---

# Etapa 04: teste no Boox e decisão

## Objetivo

Instalar o APK no Boox Note Air4 C do autor, testar a escrita e os gestos e registrar a decisão de arquitetura. Os resultados vêm do autor, que usa o aparelho; o Claude os registra.

## Critérios de conclusão

- [ ] O meio de levar o APK ao Boox está definido, registrado e funcionando.
- [ ] O APK está instalado no Boox Note Air4 C do autor.
- [ ] A latência percebida foi comparada com a do app de notas nativo, e o resultado está registrado.
- [ ] Os traços caem no lugar certo depois de mover e ampliar a área de desenho.
- [ ] Os toques dos dedos chegam à página enquanto a caneta está ativa, permitindo mover e ampliar com dois dedos.
- [ ] O autor avaliou o salto entre o traço provisório e o traço final, e a avaliação está registrada.
- [ ] A decisão de seguir com a casca, ajustá-la ou recorrer à PWA está registrada no plano e no estado.

## Registro

### 2026-11-08

- O PR #3 foi mesclado no `main`, a pedido do autor, e o branch de trabalho recomeçou a partir dele.
- Meio escolhido pelo autor para levar o APK ao Boox: envio pelo aplicativo do Claude. O APK foi compilado do zero a partir do commit `e6154ef` do `main`, com os testes passando, e enviado como `prancheta-casca-0.1.0-debug.apk`, com 21 MB e SHA-256 `6678126e166f5dbe641cd4696fe55adfedb923b7c63c1f0982338330a4b0db34`. Ele é assinado com a chave de depuração do Android.
- Falta o autor confirmar a instalação e relatar o teste. Roteiro combinado:
  1. Abrir o aplicativo e conferir, na barra, se aparece "tinta nativa".
  2. Escrever à mão e comparar a sensação de atraso com a do aplicativo de notas da Boox.
  3. Mover e ampliar com dois dedos e escrever de novo, conferindo se o traço cai sob a caneta.
  4. Observar se o traço provisório some e o definitivo aparece sem salto incômodo.
  5. Tocar em "Limpar" e "Reiniciar vista" com a caneta e com o dedo.

## Resultado
