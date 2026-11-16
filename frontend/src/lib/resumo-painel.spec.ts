import {Emprestimo, Item, Solicitacao} from '../types/models';
import {atrasados, devolucoesDeHoje, emprestadosNoPrazo, maisPedidos, nomeBase, pendenciasDePedidos, taxaDeAtraso, usoDoAcervo} from './resumo-painel';

const agora = new Date(2026, 10, 15, 9, 0); // 15/11/2026

const emp = (id: string, extra: Partial<Emprestimo>): Emprestimo => ({
  id,
  solicitacaoId: 's-' + id,
  itemId: 'i-' + id,
  usuarioId: 'u',
  registradoPor: 'r',
  retiradoEm: new Date(2026, 10, 10, 9).toISOString(),
  devolucaoPrevista: '2026-11-20',
  diasAtraso: 0,
  ...extra,
});

const item = (id: string, nome: string, status: Item['status'] = 'disponivel'): Item => ({
  id,
  categoriaId: 'c',
  nome,
  descricao: '',
  patrimonio: 'NX-' + id,
  codigoQr: 'QR-' + id,
  status,
});

const pedido = (id: string, itemId: string, diasAtras: number, status: Solicitacao['status'] = 'concluida'): Solicitacao => ({
  id,
  solicitanteId: 'u',
  itemId,
  devolucaoDesejada: '2026-11-30',
  status,
  criadoEm: new Date(2026, 10, 15 - diasAtras, 9).toISOString(),
});

describe('resumo do painel', () => {
  describe('o que vence hoje, o que está no prazo e o que atrasou', () => {
    const lista = [
      emp('hoje', {devolucaoPrevista: '2026-11-15'}),
      emp('amanha', {devolucaoPrevista: '2026-11-16'}),
      emp('semana', {devolucaoPrevista: '2026-11-22'}),
      emp('atraso1', {devolucaoPrevista: '2026-11-13', diasAtraso: 2}),
      emp('atraso3', {devolucaoPrevista: '2026-11-11', diasAtraso: 4}),
      emp('devolvido', {devolucaoPrevista: '2026-11-15', devolvidoEm: new Date(2026, 10, 14).toISOString()}),
    ];

    it('devoluções de hoje: só o que vence hoje e ainda não voltou', () => {
      expect(devolucoesDeHoje(lista, agora).map((e) => e.id)).toEqual(['hoje']);
    });

    it('no prazo: não repete o que vence hoje e vai do mais próximo ao mais distante', () => {
      expect(emprestadosNoPrazo(lista, agora).map((e) => e.id)).toEqual(['amanha', 'semana']);
    });

    it('atrasados: do maior atraso para o menor', () => {
      expect(atrasados(lista).map((e) => e.id)).toEqual(['atraso3', 'atraso1']);
    });
  });

  describe('pendências da tela Pedidos', () => {
    it('conta pedidos pendentes e aprovados, mais devoluções atrasadas e de hoje', () => {
      const pedidos = [
        pedido('p1', 'i1', 0, 'pendente'),
        pedido('p2', 'i2', 0, 'aprovada'),
        pedido('p3', 'i3', 1, 'recusada'),
        pedido('p4', 'i4', 3, 'concluida'),
        pedido('p5', 'i5', 3, 'expirada'),
      ];
      const emprestimos = [
        emp('hoje', {devolucaoPrevista: '2026-11-15'}),
        emp('amanha', {devolucaoPrevista: '2026-11-16'}),
        emp('atraso', {devolucaoPrevista: '2026-11-13', diasAtraso: 2}),
        emp('devolvido', {devolucaoPrevista: '2026-11-15', devolvidoEm: new Date(2026, 10, 14).toISOString()}),
      ];
      expect(pendenciasDePedidos(pedidos, emprestimos, agora)).toEqual({emprestimos: 2, devolucoes: 2, total: 4});
    });

    it('sem nada esperando, tudo zero', () => {
      expect(pendenciasDePedidos([], [], agora)).toEqual({emprestimos: 0, devolucoes: 0, total: 0});
    });
  });

  describe('uso do acervo', () => {
    it('conta emprestados e atrasados sobre o acervo, sem os encaminhados', () => {
      const itens = [
        item('1', 'A', 'emprestado'),
        item('2', 'B', 'atrasado'),
        item('3', 'C', 'disponivel'),
        item('4', 'D', 'manutencao'),
        item('5', 'E', 'encaminhado'),
      ];
      expect(usoDoAcervo(itens)).toEqual({emUso: 2, total: 4, percentual: 50});
    });

    it('acervo vazio não divide por zero', () => {
      expect(usoDoAcervo([])).toEqual({emUso: 0, total: 0, percentual: 0});
    });
  });

  describe('taxa de atraso', () => {
    it('considera só os empréstimos dos últimos 30 dias', () => {
      const lista = [
        emp('a', {}),
        emp('b', {diasAtraso: 1}),
        emp('c', {diasAtraso: 3, devolvidoEm: new Date(2026, 10, 14).toISOString()}),
        emp('d', {retiradoEm: new Date(2026, 8, 1, 9).toISOString(), diasAtraso: 5}), // fora da janela
      ];
      expect(taxaDeAtraso(lista, agora)).toEqual({total: 3, atrasados: 2, percentual: 67});
    });

    it('sem empréstimos na janela não há taxa (null, não 0%)', () => {
      expect(taxaDeAtraso([], agora)).toEqual({total: 0, atrasados: 0, percentual: null});
    });
  });

  describe('mais pedidos', () => {
    it('agrupa os itens de mesmo nome sem o número, conta no período e ordena', () => {
      expect(nomeBase('Kit Arduino Iniciante #2')).toBe('Kit Arduino Iniciante');
      expect(nomeBase('Projetor Epson')).toBe('Projetor Epson');

      const itens = [item('1', 'Kit Arduino #1'), item('2', 'Kit Arduino #2'), item('3', 'Projetor Epson'), item('4', 'Notebook')];
      const solicitacoes = [
        pedido('p1', '1', 2),
        pedido('p2', '2', 5),
        pedido('p3', '3', 1),
        pedido('p4', '3', 3, 'recusada'), // recusado também foi pedido
        pedido('p5', '4', 90), // fora do período
        pedido('p6', 'sumiu', 1), // item que não existe mais
      ];
      expect(maisPedidos(solicitacoes, itens, agora)).toEqual([
        {nome: 'Kit Arduino', pedidos: 2},
        {nome: 'Projetor Epson', pedidos: 2},
      ]);
    });

    it('respeita o limite', () => {
      const itens = ['A', 'B', 'C'].map((n, i) => item(String(i), n));
      const solicitacoes = itens.map((i) => pedido('p' + i.id, i.id, 1));
      expect(maisPedidos(solicitacoes, itens, agora, 30, 2)).toHaveLength(2);
    });
  });
});
