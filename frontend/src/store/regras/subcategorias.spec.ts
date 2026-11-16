import {ProtemState} from '../estado';
import {removerSubcategoria, salvarItem, salvarSubcategoria} from './acervo';
import {estadoDeTeste, item} from './estado-de-teste';

function comSubcategorias(): ProtemState {
  const s = estadoDeTeste();
  return {
    ...s,
    subcategorias: [
      {id: 'sub-1', categoriaId: 'cat-a', nome: 'Gamer'},
      {id: 'sub-2', categoriaId: 'cat-b', nome: 'Arduino'},
    ],
  };
}

describe('subcategorias', () => {
  it('cria uma subcategoria dentro de uma categoria', () => {
    const {estado, resultado} = salvarSubcategoria(estadoDeTeste(), {id: 'sub-x', categoriaId: 'cat-a', nome: '  Escritório '});
    expect(resultado.sucesso).toBe(true);
    expect(estado.subcategorias).toEqual([{id: 'sub-x', categoriaId: 'cat-a', nome: 'Escritório'}]);
  });

  it('exige nome e categoria existente', () => {
    const s = estadoDeTeste();
    expect(salvarSubcategoria(s, {id: 'x', categoriaId: 'cat-a', nome: '   '}).resultado.sucesso).toBe(false);
    expect(salvarSubcategoria(s, {id: 'x', categoriaId: 'nao-existe', nome: 'Qualquer'}).resultado.sucesso).toBe(false);
  });

  it('não repete nome na mesma categoria (sem diferenciar maiúsculas e acento), mas aceita em outra', () => {
    const s = comSubcategorias();
    expect(salvarSubcategoria(s, {id: 'novo', categoriaId: 'cat-a', nome: 'gamer'}).resultado.sucesso).toBe(false);
    expect(salvarSubcategoria(s, {id: 'novo', categoriaId: 'cat-b', nome: 'Gamer'}).resultado.sucesso).toBe(true);
  });

  it('renomeia a mesma subcategoria sem acusar repetição, mas não deixa trocar de categoria', () => {
    const s = comSubcategorias();
    expect(salvarSubcategoria(s, {id: 'sub-1', categoriaId: 'cat-a', nome: 'Gamer'}).resultado.sucesso).toBe(true);
    const renomeada = salvarSubcategoria(s, {id: 'sub-1', categoriaId: 'cat-a', nome: 'Jogos'});
    expect(renomeada.estado.subcategorias.find((x) => x.id === 'sub-1')?.nome).toBe('Jogos');
    expect(salvarSubcategoria(s, {id: 'sub-1', categoriaId: 'cat-b', nome: 'Gamer'}).resultado.sucesso).toBe(false);
  });

  it('só remove quando nenhum item usa', () => {
    const s = comSubcategorias();
    const emUso = salvarItem(s, item('n1', 'cat-a', {subcategoriaId: 'sub-1'}));
    const bloqueada = removerSubcategoria(emUso, 'sub-1');
    expect(bloqueada.resultado.sucesso).toBe(false);
    expect(bloqueada.resultado.mensagem).toContain('1 item usa');
    expect(bloqueada.estado).toBe(emUso);

    const livre = removerSubcategoria(s, 'sub-1');
    expect(livre.resultado.sucesso).toBe(true);
    expect(livre.estado.subcategorias.map((x) => x.id)).toEqual(['sub-2']);
    expect(removerSubcategoria(s, 'nao-existe').resultado.sucesso).toBe(false);
  });

  it('guarda a subcategoria do item só quando ela pertence à categoria dele', () => {
    const s = comSubcategorias();
    const certo = salvarItem(s, item('n1', 'cat-a', {subcategoriaId: 'sub-1'}));
    expect(certo.itens.find((i) => i.id === 'n1')?.subcategoriaId).toBe('sub-1');

    const categoriaErrada = salvarItem(s, item('n2', 'cat-a', {subcategoriaId: 'sub-2'}));
    expect(categoriaErrada.itens.find((i) => i.id === 'n2')?.subcategoriaId).toBeUndefined();

    const inexistente = salvarItem(s, item('n3', 'cat-a', {subcategoriaId: 'fantasma'}));
    expect('subcategoriaId' in (inexistente.itens.find((i) => i.id === 'n3') ?? {})).toBe(false);
  });

  it('descarta a subcategoria quando o item muda de categoria', () => {
    const s = salvarItem(comSubcategorias(), item('n1', 'cat-a', {subcategoriaId: 'sub-1'}));
    const movido = salvarItem(s, {...s.itens.find((i) => i.id === 'n1')!, categoriaId: 'cat-b'});
    expect(movido.itens.find((i) => i.id === 'n1')?.subcategoriaId).toBeUndefined();
  });
});
