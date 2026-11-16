import {removerCategoria} from './acervo';
import {estadoDeTeste} from './estado-de-teste';

describe('removerCategoria', () => {
  it('bloqueia a remoção quando há itens na categoria', () => {
    const s = estadoDeTeste();
    const r = removerCategoria(s, 'cat-a');

    expect(r.resultado.sucesso).toBe(false);
    expect(r.resultado.mensagem).toContain('2 itens usam');
    expect(r.estado).toBe(s);
  });

  it('remove a categoria e suas subcategorias quando não há itens', () => {
    const s = estadoDeTeste({
      itens: [],
      subcategorias: [
        {id: 'sub-a', categoriaId: 'cat-a', nome: 'Gamer'},
        {id: 'sub-b', categoriaId: 'cat-b', nome: 'Arduino'},
      ],
    });
    const r = removerCategoria(s, 'cat-a');

    expect(r.resultado.sucesso).toBe(true);
    expect(r.estado.categorias.map((x) => x.id)).toEqual(['cat-b']);
    expect(r.estado.subcategorias.map((x) => x.id)).toEqual(['sub-b']);
  });

  it('informa quando a categoria não existe', () => {
    const s = estadoDeTeste();
    const r = removerCategoria(s, 'nao-existe');

    expect(r.resultado.sucesso).toBe(false);
    expect(r.resultado.mensagem).toBe('Categoria não encontrada.');
    expect(r.estado).toBe(s);
  });
});
