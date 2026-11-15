import {PoliticaAtraso} from '../../types/models';
import {ProtemState} from '../estado';
import {registrarDevolucao, registrarRetirada, registrarRetiradaPorQr} from './emprestimos';
import {AGORA, buscar, em, emprestimo, estadoDeTeste, solicitacao, usuario} from './estado-de-teste';

/** Código que a aluna recebeu na aprovação do pedido de a1. */
const CODIGO = 'K7PM4X';

/** Pedido aprovado hoje para a1, com o item reservado esperando retirada. */
function comPedidoAprovado(): ProtemState {
  const s = estadoDeTeste({
    solicitacoes: [
      solicitacao('p', 'a1', {status: 'aprovada', avaliadoPor: 'resp', avaliadoEm: AGORA.toISOString(), codigoRetirada: CODIGO}),
    ],
  });
  s.itens[0] = {...s.itens[0], status: 'reservado'};
  return s;
}

/** Empréstimo de a1 com prazo em 13/10; o relógio está em 15/10 às 10:00 (2 dias de atraso). */
function comEmprestimoAtrasado(politica: PoliticaAtraso, statusConta: 'ativa' | 'bloqueada' = 'bloqueada'): ProtemState {
  const s = estadoDeTeste({
    configuracao: {politicaAtraso: politica},
    usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna', {status: statusConta})],
    emprestimos: [emprestimo('e', 'a1', {devolucaoPrevista: '2026-10-13', diasAtraso: 2})],
  });
  s.itens[0] = {...s.itens[0], status: 'atrasado'};
  return s;
}

describe('regras de retirada e devolução', () => {
  describe('RN05: retirada', () => {
    it('registra a retirada, começa o prazo agora e conclui o pedido', () => {
      const {estado, resultado} = registrarRetirada(comPedidoAprovado(), 'a1', 'resp', CODIGO);
      expect(resultado.sucesso).toBe(true);

      const emp = buscar.emprestimo(estado, resultado.emprestimoId!);
      expect(emp).toMatchObject({
        itemId: 'a1',
        usuarioId: 'aluna',
        registradoPor: 'resp',
        retiradoEm: AGORA.toISOString(),
        devolucaoPrevista: '2026-10-16',
        diasAtraso: 0,
      });
      expect(buscar.item(estado, 'a1').status).toBe('emprestado');
      expect(buscar.solicitacao(estado, 'p').status).toBe('concluida');
    });

    it.each(['qr-a1', 'QR-A1', ' pat-a1 '])('encontra o item pelo QR ou patrimônio digitado ("%s")', (codigo) => {
      const {resultado} = registrarRetiradaPorQr(comPedidoAprovado(), codigo, 'resp', CODIGO);
      expect(resultado).toMatchObject({sucesso: true, itemId: 'a1'});
    });

    it('avisa quando o código não existe', () => {
      const {resultado} = registrarRetiradaPorQr(comPedidoAprovado(), 'XYZ-999', 'resp', CODIGO);
      expect(resultado.sucesso).toBe(false);
      expect(resultado.mensagem).toContain('não encontrado');
    });

    it('não registra retirada sem pedido aprovado', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1', {status: 'pendente'})]});
      const {estado, resultado} = registrarRetirada(s, 'a1', 'resp', CODIGO);
      expect(resultado.sucesso).toBe(false);
      expect(estado).toBe(s);
    });

    describe('código de retirada', () => {
      it.each(['', 'K7PM4Y', 'ABCDEF'])('não libera com código errado ou vazio ("%s")', (codigo) => {
        const s = comPedidoAprovado();
        const {estado, resultado} = registrarRetirada(s, 'a1', 'resp', codigo);
        expect(resultado.sucesso).toBe(false);
        expect(resultado.mensagem).toContain('Código de retirada incorreto');
        // A mensagem nunca mostra o código certo
        expect(resultado.mensagem).not.toContain(CODIGO);
        expect(estado).toBe(s);
      });

      it.each(['k7pm4x', ' K7P-M4X ', 'K7 PM 4X'])('aceita o código com minúsculas, espaços ou hífen ("%s")', (codigo) => {
        expect(registrarRetirada(comPedidoAprovado(), 'a1', 'resp', codigo).resultado.sucesso).toBe(true);
      });

      it('não libera pedido aprovado sem código', () => {
        const s = comPedidoAprovado();
        s.solicitacoes[0] = {...s.solicitacoes[0], codigoRetirada: undefined};
        expect(registrarRetirada(s, 'a1', 'resp', '').resultado.sucesso).toBe(false);
      });

      it('é de uso único: depois da retirada o mesmo código não vale mais', () => {
        const depois = registrarRetirada(comPedidoAprovado(), 'a1', 'resp', CODIGO).estado;
        expect(buscar.solicitacao(depois, 'p').status).toBe('concluida');
        const deNovo = registrarRetirada(depois, 'a1', 'resp', CODIGO);
        expect(deNovo.resultado.sucesso).toBe(false);
      });

      it('RN04: pedido expirado no fim do dia não aceita o código', () => {
        const s = comPedidoAprovado();
        s.solicitacoes[0] = {...s.solicitacoes[0], status: 'expirada'};
        expect(registrarRetirada(s, 'a1', 'resp', CODIGO).resultado.sucesso).toBe(false);
      });
    });
  });

  describe('devolução', () => {
    it('no prazo e sem avaria: item volta a ficar disponível', () => {
      const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
      s.itens[0] = {...s.itens[0], status: 'emprestado'};

      const {estado, resultado} = registrarDevolucao(s, 'e', false);
      expect(resultado.sucesso).toBe(true);
      expect(buscar.emprestimo(estado, 'e')).toMatchObject({devolvidoEm: s.agora, diasAtraso: 0});
      expect(buscar.item(estado, 'a1').status).toBe('disponivel');
      expect(estado.ocorrencias).toHaveLength(0);
      expect(buscar.usuario(estado, 'aluna').status).toBe('ativa');
    });

    it('RN07: com avaria o item vai para manutenção e abre ocorrência', () => {
      const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
      const {estado} = registrarDevolucao(s, 'e', true, 'Tela trincada');

      expect(buscar.item(estado, 'a1').status).toBe('manutencao');
      expect(estado.ocorrencias).toHaveLength(1);
      expect(estado.ocorrencias[0]).toMatchObject({
        emprestimoId: 'e',
        itemId: 'a1',
        usuarioId: 'aluna',
        descricao: 'Tela trincada',
        status: 'aberta',
      });
    });

    it('não devolve duas vezes', () => {
      const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1', {devolvidoEm: AGORA.toISOString()})]});
      expect(registrarDevolucao(s, 'e', false).resultado.sucesso).toBe(false);
    });

    describe('RN06: política de atraso na devolução', () => {
      it('simples: só registra o atraso, a conta não muda', () => {
        const {estado, resultado} = registrarDevolucao(comEmprestimoAtrasado('simples', 'ativa'), 'e', false);
        expect(buscar.emprestimo(estado, 'e').diasAtraso).toBe(2);
        expect(buscar.usuario(estado, 'aluna').status).toBe('ativa');
        expect(resultado.mensagem).toContain('2 dia(s) de atraso');
      });

      it('intermediária: desbloqueia a conta depois da devolução', () => {
        const {estado} = registrarDevolucao(comEmprestimoAtrasado('intermediaria'), 'e', false);
        expect(buscar.usuario(estado, 'aluna').status).toBe('ativa');
      });

      it('intermediária: continua bloqueada se ainda há outro item atrasado', () => {
        const s = comEmprestimoAtrasado('intermediaria');
        s.emprestimos.push(emprestimo('outro', 'b1', {devolucaoPrevista: '2026-10-14', diasAtraso: 1}));
        const {estado, resultado} = registrarDevolucao(s, 'e', false);
        expect(buscar.usuario(estado, 'aluna').status).toBe('bloqueada');
        // A mensagem não pode dizer que desbloqueou
        expect(resultado.mensagem).not.toContain('desbloqueada');
        expect(resultado.mensagem).toContain('continua bloqueada');
      });

      it('simples: conta bloqueada antes da troca de política é liberada na devolução', () => {
        // Bloqueada pela política rígida; depois o responsável trocou para a simples
        const {estado} = registrarDevolucao(comEmprestimoAtrasado('simples', 'bloqueada'), 'e', false);
        expect(buscar.usuario(estado, 'aluna').status).toBe('ativa');
      });

      it('rígida: suspende pelo mesmo número de dias de atraso, contados da devolução', () => {
        const {estado, resultado} = registrarDevolucao(comEmprestimoAtrasado('rigida'), 'e', false);
        const aluna = buscar.usuario(estado, 'aluna');
        expect(aluna.status).toBe('suspensa');
        expect(aluna.suspensoAte).toBe(em(2026, 10, 17, 10, 0));
        expect(resultado.mensagem).toContain('suspensa por 2 dia(s)');
      });

      it('devolução no prazo libera conta bloqueada sem outros atrasos', () => {
        const s = estadoDeTeste({
          usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna', {status: 'bloqueada'})],
          emprestimos: [emprestimo('e', 'a1')],
        });
        expect(buscar.usuario(registrarDevolucao(s, 'e', false).estado, 'aluna').status).toBe('ativa');
      });
    });
  });
});
