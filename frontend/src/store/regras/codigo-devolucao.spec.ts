import {ProtemState} from '../estado';
import {
  codigoDevolucaoConfere,
  codigosEmUso,
  garantirCodigos,
  garantirCodigosDeDevolucao,
} from './codigos';
import {registrarDevolucao, registrarRetirada} from './emprestimos';
import {aprovarPedido} from './solicitacoes';
import {AGORA, buscar, emprestimo, estadoDeTeste, solicitacao} from './estado-de-teste';

const CODIGO_RETIRADA = 'K7PM4X';
const CODIGO_DEVOLUCAO = 'P4Q9RT';

function comEmprestimoComCodigo(): ProtemState {
  const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1', {codigoDevolucao: CODIGO_DEVOLUCAO})]});
  s.itens[0] = {...s.itens[0], status: 'emprestado'};
  return s;
}

describe('código de devolução', () => {
  describe('quando nasce', () => {
    it('a retirada gera o código de devolução do empréstimo', () => {
      const s = estadoDeTeste({
        solicitacoes: [solicitacao('p', 'a1', {status: 'aprovada', codigoRetirada: CODIGO_RETIRADA})],
      });
      const {estado, resultado} = registrarRetirada(s, 'a1', 'resp', CODIGO_RETIRADA);
      const emp = buscar.emprestimo(estado, resultado.emprestimoId!);
      expect(emp.codigoDevolucao).toMatch(/^[A-Z2-9]{6}$/);
      expect(emp.codigoDevolucao).not.toBe(CODIGO_RETIRADA);
    });

    it('as mensagens da aprovação e da retirada não trazem os códigos', () => {
      const aprovado = aprovarPedido(estadoDeTeste({solicitacoes: [solicitacao('p', 'a1')]}), 'p', 'resp');
      const codigoRetirada = buscar.solicitacao(aprovado.estado, 'p').codigoRetirada!;
      const notifAprovacao = aprovado.estado.notificacoes[0];
      expect(notifAprovacao.mensagem).not.toContain(codigoRetirada);
      expect(notifAprovacao.destino).toBe('/codigos');

      const retirado = registrarRetirada(aprovado.estado, 'a1', 'resp', codigoRetirada);
      const emp = buscar.emprestimo(retirado.estado, retirado.resultado.emprestimoId!);
      const notifRetirada = retirado.estado.notificacoes[0];
      expect(notifRetirada.mensagem).not.toContain(emp.codigoDevolucao!);
      expect(notifRetirada.destino).toBe('/codigos');
    });
  });

  describe('conferência', () => {
    it('confere com o código certo, em qualquer caixa e com hífen', () => {
      const emp = emprestimo('e', 'a1', {codigoDevolucao: CODIGO_DEVOLUCAO});
      expect(codigoDevolucaoConfere(emp, ' p4q-9rt ')).toBe(true);
      expect(codigoDevolucaoConfere(emp, 'P4Q9RU')).toBe(false);
    });

    it('não confere depois de devolvido nem sem código', () => {
      const emp = emprestimo('e', 'a1', {codigoDevolucao: CODIGO_DEVOLUCAO});
      expect(codigoDevolucaoConfere({...emp, devolvidoEm: AGORA.toISOString()}, CODIGO_DEVOLUCAO)).toBe(false);
      expect(codigoDevolucaoConfere({...emp, codigoDevolucao: undefined}, '')).toBe(false);
    });

    it('só conta como em uso o código de empréstimo em aberto', () => {
      const s = estadoDeTeste({
        emprestimos: [
          emprestimo('aberto', 'a1', {codigoDevolucao: 'AAAAAA'}),
          emprestimo('fechado', 'a2', {codigoDevolucao: 'BBBBBB', devolvidoEm: AGORA.toISOString()}),
        ],
      });
      expect([...codigosEmUso(s)]).toEqual(['AAAAAA']);
    });

    it('empréstimos em aberto salvos antes do código ganham um, sem mexer nos outros', () => {
      const s = estadoDeTeste({
        emprestimos: [
          emprestimo('antigo', 'a1'),
          emprestimo('comCodigo', 'a2', {codigoDevolucao: CODIGO_DEVOLUCAO}),
          emprestimo('fechado', 'b1', {devolvidoEm: AGORA.toISOString()}),
        ],
      });
      const depois = garantirCodigosDeDevolucao(s);
      expect(buscar.emprestimo(depois, 'antigo').codigoDevolucao).toMatch(/^[A-Z2-9]{6}$/);
      expect(buscar.emprestimo(depois, 'antigo').codigoDevolucao).not.toBe(CODIGO_DEVOLUCAO);
      expect(buscar.emprestimo(depois, 'comCodigo').codigoDevolucao).toBe(CODIGO_DEVOLUCAO);
      expect(buscar.emprestimo(depois, 'fechado').codigoDevolucao).toBeUndefined();
      expect(garantirCodigos(depois)).toBe(depois);
    });
  });

  describe('devolução com código', () => {
    it('devolve com o código certo', () => {
      const {estado, resultado} = registrarDevolucao(comEmprestimoComCodigo(), 'e', false, undefined, 'resp', {
        codigo: 'p4q9rt',
      });
      expect(resultado.sucesso).toBe(true);
      expect(buscar.emprestimo(estado, 'e').devolvidoEm).toBe(AGORA.toISOString());
      expect(buscar.emprestimo(estado, 'e').devolvidoSemCodigoMotivo).toBeUndefined();
    });

    it.each(['', 'P4Q9RU'])('não devolve com código errado ou vazio ("%s")', (codigo) => {
      const s = comEmprestimoComCodigo();
      const {estado, resultado} = registrarDevolucao(s, 'e', false, undefined, 'resp', {codigo});
      expect(resultado.sucesso).toBe(false);
      expect(resultado.mensagem).toContain('ódigo');
      expect(estado).toBe(s);
    });

    it('sem informar nada, também não devolve', () => {
      const s = comEmprestimoComCodigo();
      expect(registrarDevolucao(s, 'e', false, undefined, 'resp').resultado.sucesso).toBe(false);
    });

    it('sem código mas com motivo: devolve e deixa o motivo na auditoria', () => {
      const {estado, resultado} = registrarDevolucao(comEmprestimoComCodigo(), 'e', false, undefined, 'resp', {
        semCodigoMotivo: '  Celular sem bateria  ',
      });
      expect(resultado.sucesso).toBe(true);
      expect(buscar.emprestimo(estado, 'e').devolvidoSemCodigoMotivo).toBe('Celular sem bateria');
      const evento = estado.auditoria.find((e) => e.tipo === 'devolucao')!;
      expect(evento.detalhe).toContain('Sem código de devolução: Celular sem bateria');
      expect(evento.autorId).toBe('resp');
    });

    it('motivo só com espaços não vale como motivo', () => {
      const {resultado} = registrarDevolucao(comEmprestimoComCodigo(), 'e', false, undefined, 'resp', {
        semCodigoMotivo: '   ',
      });
      expect(resultado.sucesso).toBe(false);
    });

    it('com o código certo, o "sem código" não é registrado', () => {
      const {estado} = registrarDevolucao(comEmprestimoComCodigo(), 'e', false, undefined, 'resp', {
        codigo: CODIGO_DEVOLUCAO,
      });
      expect(estado.auditoria.find((e) => e.tipo === 'devolucao')!.detalhe).toBe('No prazo');
    });

    it('empréstimo antigo, sem código, continua devolvendo como antes', () => {
      const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
      expect(registrarDevolucao(s, 'e', false).resultado.sucesso).toBe(true);
    });

    it('a política de atraso continua valendo com o código', () => {
      const s = estadoDeTeste({
        emprestimos: [emprestimo('e', 'a1', {devolucaoPrevista: '2026-10-13', diasAtraso: 2, codigoDevolucao: CODIGO_DEVOLUCAO})],
      });
      const {estado} = registrarDevolucao(s, 'e', false, undefined, 'resp', {codigo: CODIGO_DEVOLUCAO});
      expect(buscar.usuario(estado, 'aluna').status).toBe('suspensa');
    });
  });
});
