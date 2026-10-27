import {aprovarPedido, recusarPedido, solicitarEmprestimo} from './solicitacoes';
import {registrarDevolucao, registrarRetirada} from './emprestimos';
import {executarRotinaAutomatica} from './rotina';
import {buscar, estadoDeTeste, solicitacao} from './estado-de-teste';

/** Cada ação do fluxo grava um evento com quem fez, quem foi afetado, o item e o motivo. */
describe('auditoria', () => {
  it('registra pedido, aprovação, retirada e devolução com avaria, na ordem', () => {
    let s = solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-16').estado;
    const pedido = s.solicitacoes[0];
    s = aprovarPedido(s, pedido.id, 'resp').estado;
    const codigo = buscar.solicitacao(s, pedido.id).codigoRetirada!;
    s = registrarRetirada(s, 'a1', 'resp', codigo).estado;
    s = registrarDevolucao(s, s.emprestimos[0].id, true, 'Tela trincada', 'resp').estado;

    expect(s.auditoria.map((e) => [e.tipo, e.autorId, e.afetadoId, e.itemId])).toEqual([
      ['devolucao_avaria', 'resp', 'aluna', 'a1'],
      ['retirada', 'resp', 'aluna', 'a1'],
      ['pedido_aprovado', 'resp', 'aluna', 'a1'],
      ['pedido_criado', 'aluna', 'aluna', 'a1'],
    ]);
    expect(s.auditoria[0].motivo).toBe('Tela trincada');
  });

  it('recusa de pedido exige motivo e o guarda no pedido e na auditoria', () => {
    const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1')]});
    expect(recusarPedido(s, 'p', 'resp', '  ').resultado).toEqual({sucesso: false, mensagem: 'Informe o motivo da recusa.'});

    const {estado} = recusarPedido(s, 'p', 'resp', 'Item reservado para a feira de ciências');
    expect(buscar.solicitacao(estado, 'p').motivoRecusa).toBe('Item reservado para a feira de ciências');
    expect(estado.auditoria[0]).toMatchObject({
      tipo: 'pedido_recusado',
      autorId: 'resp',
      afetadoId: 'aluna',
      motivo: 'Item reservado para a feira de ciências',
    });
  });

  it('a rotina registra, como sistema, a expiração e o bloqueio por atraso', () => {
    let s = solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-16').estado;
    s = aprovarPedido(s, s.solicitacoes[0].id, 'resp').estado;
    s = executarRotinaAutomatica(s, new Date(2026, 9, 16, 0, 1));
    expect(s.auditoria[0]).toMatchObject({tipo: 'pedido_expirado', afetadoId: 'aluna', itemId: 'a1'});
    expect(s.auditoria[0].autorId).toBeUndefined();

    let t = solicitarEmprestimo(estadoDeTeste(), 'b1', 'aluna', '2026-10-16').estado;
    t = aprovarPedido(t, t.solicitacoes[0].id, 'resp').estado;
    t = registrarRetirada(t, 'b1', 'resp', t.solicitacoes[0].codigoRetirada!).estado;
    t = executarRotinaAutomatica(t, new Date(2026, 9, 18, 9));
    expect(t.auditoria[0]).toMatchObject({tipo: 'conta_bloqueada', afetadoId: 'aluna'});
    expect(t.auditoria[0].autorId).toBeUndefined();
    // Avançar de novo não repete o evento
    expect(executarRotinaAutomatica(t, new Date(2026, 9, 19, 9)).auditoria.length).toBe(t.auditoria.length);
  });

  it('política rígida: devolução atrasada suspende, e o sistema registra o motivo', () => {
    let s = solicitarEmprestimo(estadoDeTeste(), 'b1', 'aluna', '2026-10-16').estado;
    s = aprovarPedido(s, s.solicitacoes[0].id, 'resp').estado;
    s = registrarRetirada(s, 'b1', 'resp', s.solicitacoes[0].codigoRetirada!).estado;
    s = executarRotinaAutomatica({...s, agora: new Date(2026, 9, 18, 9).toISOString()}, new Date(2026, 9, 18, 9));
    s = registrarDevolucao(s, s.emprestimos[0].id, false, undefined, 'resp').estado;

    expect(buscar.usuario(s, 'aluna').status).toBe('suspensa');
    expect(s.auditoria[0]).toMatchObject({tipo: 'conta_suspensa', afetadoId: 'aluna'});
    expect(s.auditoria[0].motivo).toContain('2 dia(s) de atraso');
    expect(s.auditoria[1]).toMatchObject({tipo: 'devolucao', detalhe: '2 dias de atraso'});
  });
});
