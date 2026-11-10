// Apoio aos testes que abrem livros como o autor faz, pela tela da biblioteca:
// o botão do painel lateral e a linha do livro, achada pelo nome do arquivo.

'use strict';

/** Espera a lista da biblioteca chegar com pelo menos tantos livros. */
const esperarLista = (pagina, quantos = 1) => pagina.waitForFunction(
  (n) => window.bibliotecaDaPrancheta.estado.lista.length >= n, quantos, { timeout: 15000 },
);

/** Abre a tela da biblioteca pelo botão do painel lateral, se ela ainda não estiver aberta. */
async function abrirABiblioteca(pagina) {
  if (await pagina.locator('#tela-biblioteca').isHidden()) await pagina.locator('#biblioteca [data-acao="abrir-a-biblioteca"]').click();
  await pagina.locator('#tela-biblioteca').waitFor();
}

/** Toca na linha de um livro, na tela da biblioteca. */
async function abrirPelaBiblioteca(pagina, arquivo) {
  await abrirABiblioteca(pagina);
  await pagina.locator(`#tela-biblioteca .tb-livro[data-arquivo="${arquivo}"] .tb-abrir`).click();
}

/** Abre a ficha de um livro pelo botão no fim da linha dele, na tela da biblioteca. */
async function abrirAFicha(pagina, arquivo) {
  await abrirABiblioteca(pagina);
  await pagina.locator(`#tela-biblioteca .tb-livro[data-arquivo="${arquivo}"] [data-acao="ficha"]`).click();
  await pagina.locator('#tela-biblioteca .tb-ficha-titulo').waitFor();
}

module.exports = { esperarLista, abrirABiblioteca, abrirPelaBiblioteca, abrirAFicha };
