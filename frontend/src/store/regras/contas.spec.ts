import {
  aprovarUsuario,
  bloquearUsuario,
  cadastrarUsuario,
  login,
  reativarUsuario,
  recusarUsuario,
  suspenderUsuario,
} from './contas';
import {registrarDevolucao} from './emprestimos';
import {executarRotinaAutomatica} from './rotina';
import {solicitarEmprestimo} from './solicitacoes';
import {AGORA, buscar, emprestimo, estadoDeTeste, item, usuario} from './estado-de-teste';

describe('regras de conta', () => {
  describe('RN08: cadastro', () => {
    const dados = {nome: 'Rafa Nunes', email: 'rafa@escola.edu.br', matricula: 'alu-9', perfil: 'aluno' as const};

    it('cria conta pendente e avisa os responsáveis', () => {
      const {estado, resultado} = cadastrarUsuario(estadoDeTeste(), dados);
      expect(resultado.sucesso).toBe(true);
      expect(buscar.usuario(estado, resultado.usuarioId!)).toMatchObject({status: 'pendente', perfil: 'aluno'});
      expect(estado.notificacoes[0]).toMatchObject({usuarioId: 'resp', tipo: 'nova_conta'});
      expect(estado.auditoria[0]).toMatchObject({tipo: 'conta_cadastrada', afetadoId: resultado.usuarioId});
    });

    it('recusa e-mail ou matrícula repetidos, sem diferenciar maiúsculas', () => {
      const s = cadastrarUsuario(estadoDeTeste(), dados).estado;
      expect(cadastrarUsuario(s, {...dados, matricula: 'X'}).resultado).toMatchObject({sucesso: false, campo: 'email'});
      expect(cadastrarUsuario(s, {...dados, email: 'outro@escola.edu.br', matricula: 'ALU-9'}).resultado).toMatchObject({
        sucesso: false,
        campo: 'matricula',
      });
    });

    it('aprovar ativa a conta; recusar marca como recusada; ambos notificam', () => {
      const {estado, resultado} = cadastrarUsuario(estadoDeTeste(), dados);
      const id = resultado.usuarioId!;
      expect(buscar.usuario(aprovarUsuario(estado, id), id).status).toBe('ativa');
      expect(buscar.usuario(recusarUsuario(estado, id, 'Matrícula inválida'), id).status).toBe('recusada');
      expect(recusarUsuario(estado, id, 'Matrícula inválida').notificacoes[0].mensagem).toContain('Matrícula inválida');
    });

    it('aprovação e recusa entram na auditoria com quem fez e o motivo', () => {
      const {estado, resultado} = cadastrarUsuario(estadoDeTeste(), dados);
      const id = resultado.usuarioId!;
      expect(aprovarUsuario(estado, id, 'resp').auditoria[0]).toMatchObject({tipo: 'conta_aprovada', autorId: 'resp', afetadoId: id});
      expect(recusarUsuario(estado, id, 'Matrícula inválida', 'resp').auditoria[0]).toMatchObject({
        tipo: 'conta_recusada',
        autorId: 'resp',
        motivo: 'Matrícula inválida',
      });
    });
  });

  describe('bloqueio, suspensão e reativação pelo responsável', () => {
    it('exigem motivo e só valem para conta ativa de aluno ou professor', () => {
      const s = estadoDeTeste();
      expect(bloquearUsuario(s, 'aluna', 'resp', '   ').resultado).toEqual({sucesso: false, mensagem: 'Informe o motivo.'});
      expect(suspenderUsuario(s, 'resp', 'resp', 'x', 3).resultado.sucesso).toBe(false);
      expect(reativarUsuario(s, 'aluna', 'resp', 'x').resultado.sucesso).toBe(false);
      expect(suspenderUsuario(s, 'aluna', 'resp', 'x', 0).resultado.sucesso).toBe(false);
      expect(suspenderUsuario(s, 'aluna', 'resp', 'x', 91).resultado.sucesso).toBe(false);
    });

    it('bloquear guarda o motivo, avisa a pessoa e registra na auditoria', () => {
      const {estado, resultado} = bloquearUsuario(estadoDeTeste(), 'aluna', 'resp', 'Uso indevido do laboratório');
      expect(resultado.sucesso).toBe(true);
      expect(buscar.usuario(estado, 'aluna')).toMatchObject({
        status: 'bloqueada',
        restricaoManual: {motivo: 'Uso indevido do laboratório', porId: 'resp', em: AGORA.toISOString()},
      });
      expect(estado.notificacoes[0]).toMatchObject({usuarioId: 'aluna'});
      expect(estado.auditoria[0]).toMatchObject({
        tipo: 'conta_bloqueada',
        autorId: 'resp',
        afetadoId: 'aluna',
        motivo: 'Uso indevido do laboratório',
      });
    });

    it('suspender por N dias; a rotina reativa quando o prazo vence', () => {
      const {estado} = suspenderUsuario(estadoDeTeste(), 'aluna', 'resp', 'Faltou à aula de segurança', 3);
      expect(buscar.usuario(estado, 'aluna')).toMatchObject({
        status: 'suspensa',
        suspensoAte: new Date(2026, 9, 18, 10).toISOString(),
      });
      expect(estado.auditoria[0]).toMatchObject({tipo: 'conta_suspensa', motivo: 'Faltou à aula de segurança'});

      const antes = executarRotinaAutomatica(estado, new Date(2026, 9, 18, 9));
      expect(buscar.usuario(antes, 'aluna').status).toBe('suspensa');
      const depois = executarRotinaAutomatica(estado, new Date(2026, 9, 18, 10));
      expect(buscar.usuario(depois, 'aluna')).toMatchObject({status: 'ativa', suspensoAte: undefined, restricaoManual: undefined});
      expect(depois.auditoria[0]).toMatchObject({tipo: 'conta_reativada', afetadoId: 'aluna'});
      expect(depois.auditoria[0].autorId).toBeUndefined();
    });

    it('conta suspensa não pede item e vê o motivo', () => {
      const {estado} = suspenderUsuario(estadoDeTeste(), 'aluna', 'resp', 'Faltou à aula de segurança', 3);
      const {resultado} = solicitarEmprestimo(estado, 'b1', 'aluna', '2026-10-16');
      expect(resultado.sucesso).toBe(false);
      expect(resultado.mensagem).toContain('Faltou à aula de segurança');
    });

    it('reativar encerra bloqueio ou suspensão e registra o motivo', () => {
      const s = estadoDeTeste({
        usuarios: [
          usuario('resp', {perfil: 'responsavel'}),
          usuario('aluna', {status: 'suspensa', suspensoAte: '2026-10-20T00:00:00.000Z'}),
        ],
      });
      const {estado, resultado} = reativarUsuario(s, 'aluna', 'resp', 'Conversou com a coordenação');
      expect(resultado.sucesso).toBe(true);
      expect(buscar.usuario(estado, 'aluna')).toMatchObject({status: 'ativa', suspensoAte: undefined});
      expect(estado.auditoria[0]).toMatchObject({tipo: 'conta_reativada', autorId: 'resp', motivo: 'Conversou com a coordenação'});
    });

    it('devolução não desfaz o bloqueio manual', () => {
      const s = estadoDeTeste({
        configuracao: {politicaAtraso: 'intermediaria'},
        itens: [item('a1', 'cat-a', {status: 'emprestado'})],
        emprestimos: [emprestimo('e1', 'a1')],
      });
      const bloqueado = bloquearUsuario(s, 'aluna', 'resp', 'Danificou equipamento de propósito').estado;
      const {estado} = registrarDevolucao(bloqueado, 'e1', false, undefined, 'resp');
      expect(buscar.usuario(estado, 'aluna').status).toBe('bloqueada');
    });

    it('o bloqueio automático por atraso continua saindo na devolução, pelo sistema', () => {
      const s = estadoDeTeste({
        configuracao: {politicaAtraso: 'intermediaria'},
        usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna', {status: 'bloqueada'})],
        itens: [item('a1', 'cat-a', {status: 'atrasado'})],
        emprestimos: [emprestimo('e1', 'a1', {devolucaoPrevista: '2026-10-13', diasAtraso: 2})],
      });
      const {estado} = registrarDevolucao(s, 'e1', false, undefined, 'resp');
      expect(buscar.usuario(estado, 'aluna').status).toBe('ativa');
      expect(estado.auditoria.map((e) => [e.tipo, e.autorId])).toEqual([
        ['conta_reativada', undefined],
        ['devolucao', 'resp'],
      ]);
    });
  });

  describe('login simulado', () => {
    it('entra por e-mail ou matrícula, sem diferenciar maiúsculas', () => {
      expect(login(estadoDeTeste(), 'ALUNA@escola.edu.br', '123456').estado.usuarioLogadoId).toBe('aluna');
      expect(login(estadoDeTeste(), 'aluna', '123456').estado.usuarioLogadoId).toBe('aluna');
    });

    it('recusa usuário desconhecido e senha errada', () => {
      expect(login(estadoDeTeste(), 'ninguem@escola.edu.br', '123456').resultado.sucesso).toBe(false);
      expect(login(estadoDeTeste(), 'aluna', 'errada').resultado.sucesso).toBe(false);
    });
  });
});
