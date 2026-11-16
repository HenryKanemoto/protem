import {AGORA, buscar, em, emprestimo, estadoDeTeste, solicitacao, usuario} from './estado-de-teste';
import {
  aprovarPedido,
  contarItensAtivosDoUsuarioNaCategoria,
  enviarLembrete,
  podeEnviarLembrete,
  recusarPedido,
  solicitarEmprestimo,
  verificarPermissaoSolicitacao,
} from './solicitacoes';

describe('regras de solicitação', () => {
  describe('solicitarEmprestimo', () => {
    it('RN01/RN09: cria pedido pendente, tira o item do catálogo e avisa o responsável', () => {
      const {estado, resultado} = solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-16');

      expect(resultado.sucesso).toBe(true);
      const pedido = buscar.solicitacao(estado, resultado.solicitacaoId!);
      expect(pedido.status).toBe('pendente');
      expect(pedido.criadoEm).toBe(AGORA.toISOString());
      expect(buscar.item(estado, 'a1').status).toBe('solicitado');
      expect(estado.notificacoes).toHaveLength(1);
      expect(estado.notificacoes[0]).toMatchObject({usuarioId: 'resp', tipo: 'novo_pedido'});
    });

    it.each([
      ['pendente', 'pendente de aprovação'],
      ['bloqueada', 'bloqueada'],
      ['suspensa', 'suspensa'],
      ['recusada', 'não foi aceito'],
    ] as const)('RN08/RN06: conta %s não pode pedir', (status, trecho) => {
      const s = estadoDeTeste({usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna', {status})]});
      const {estado, resultado} = solicitarEmprestimo(s, 'a1', 'aluna', '2026-10-16');
      expect(resultado.sucesso).toBe(false);
      expect(resultado.mensagem).toContain(trecho);
      expect(estado).toBe(s);
    });

    it('RN08: conta com cadastro recusado também não passa na verificação de permissão', () => {
      const s = estadoDeTeste({usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna', {status: 'recusada'})]});
      expect(verificarPermissaoSolicitacao(s, 'cat-a', 'aluna').pode).toBe(false);
    });

    it('recusa item que não está disponível', () => {
      const s = estadoDeTeste();
      s.itens[0] = {...s.itens[0], status: 'manutencao'};
      expect(solicitarEmprestimo(s, 'a1', 'aluna', '2026-10-16').resultado.sucesso).toBe(false);
    });

    it('RN02: aceita devolução até o último dia do prazo da categoria e recusa o dia seguinte', () => {
      // cat-a tem prazo de 2 dias: hoje é 15/10, então o limite é 17/10
      expect(solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-17').resultado.sucesso).toBe(true);
      const {resultado} = solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-18');
      expect(resultado.sucesso).toBe(false);
      expect(resultado.mensagem).toContain('prazo máximo');
    });

    it('RN03: respeita o limite por pessoa na categoria', () => {
      // cat-a: limite 1
      const primeiro = solicitarEmprestimo(estadoDeTeste(), 'a1', 'aluna', '2026-10-16');
      const segundo = solicitarEmprestimo(primeiro.estado, 'a2', 'aluna', '2026-10-16');
      expect(segundo.resultado.sucesso).toBe(false);
      expect(segundo.resultado.mensagem).toContain('limite');
      // Outra categoria não conta para o limite
      expect(solicitarEmprestimo(primeiro.estado, 'b1', 'aluna', '2026-10-16').resultado.sucesso).toBe(true);
    });
  });

  describe('RN03: contagem de itens ativos', () => {
    it('conta solicitado, reservado, emprestado e atrasado; ignora devolvidos, recusados e expirados', () => {
      const s = estadoDeTeste({
        solicitacoes: [
          solicitacao('p', 'b1', {status: 'pendente'}),
          solicitacao('ap', 'b2', {status: 'aprovada'}),
          solicitacao('rec', 'b3', {status: 'recusada'}),
          solicitacao('exp', 'b3', {status: 'expirada'}),
        ],
        emprestimos: [
          emprestimo('ativo', 'b3'),
          emprestimo('atrasado', 'a1', {diasAtraso: 3}),
          emprestimo('devolvido', 'a2', {devolvidoEm: AGORA.toISOString()}),
        ],
      });
      expect(contarItensAtivosDoUsuarioNaCategoria(s, 'cat-b', 'aluna')).toBe(3);
      expect(contarItensAtivosDoUsuarioNaCategoria(s, 'cat-a', 'aluna')).toBe(1);
      expect(contarItensAtivosDoUsuarioNaCategoria(s, 'cat-a', null)).toBe(0);
    });

    it('verificarPermissaoSolicitacao informa motivo e contagem', () => {
      const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
      expect(verificarPermissaoSolicitacao(s, 'cat-a', 'aluna')).toMatchObject({pode: false, itensAtuais: 1, limiteMax: 1});
      expect(verificarPermissaoSolicitacao(s, 'cat-b', 'aluna')).toMatchObject({pode: true, itensAtuais: 0, limiteMax: 2});
      expect(verificarPermissaoSolicitacao(s, 'cat-b', null).pode).toBe(false);
    });
  });

  describe('aprovação e recusa', () => {
    it('RN01/RN04: aprovar reserva o item e registra quem e quando aprovou', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1')]});
      s.itens[0] = {...s.itens[0], status: 'solicitado'};

      const {estado, resultado} = aprovarPedido(s, 'p', 'resp');
      expect(resultado.sucesso).toBe(true);
      expect(buscar.solicitacao(estado, 'p')).toMatchObject({status: 'aprovada', avaliadoPor: 'resp', avaliadoEm: s.agora});
      expect(buscar.item(estado, 'a1').status).toBe('reservado');
      expect(estado.notificacoes[0]).toMatchObject({usuarioId: 'aluna', tipo: 'aprovacao'});
    });

    it('aprovar gera o código de retirada, avisa só quem pediu e não mostra o código no aviso', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1')]});
      const {estado} = aprovarPedido(s, 'p', 'resp');
      const codigo = buscar.solicitacao(estado, 'p').codigoRetirada!;
      expect(codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      // O código só aparece em Meus códigos: nenhuma notificação o traz
      expect(estado.notificacoes.filter((n) => n.mensagem.includes(codigo))).toEqual([]);
      const aviso = estado.notificacoes.filter((n) => n.tipo === 'aprovacao');
      expect(aviso.map((n) => [n.usuarioId, n.destino])).toEqual([['aluna', '/codigos']]);
    });

    it('não aprova duas vezes', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1', {status: 'aprovada'})]});
      expect(aprovarPedido(s, 'p', 'resp').resultado.sucesso).toBe(false);
    });

    it('RN09: recusar devolve o item ao catálogo', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1')]});
      s.itens[0] = {...s.itens[0], status: 'solicitado'};

      const {estado} = recusarPedido(s, 'p', 'resp', 'Sem uso pedagógico');
      expect(buscar.solicitacao(estado, 'p').status).toBe('recusada');
      expect(buscar.item(estado, 'a1').status).toBe('disponivel');
      expect(estado.notificacoes[0].mensagem).toContain('Sem uso pedagógico');
    });
  });

  describe('RN10: lembrete ao responsável', () => {
    it('só libera depois de 2 horas sem análise', () => {
      const pedido = solicitacao('p', 'a1', {criadoEm: em(2026, 10, 15, 8, 1)});
      const s = estadoDeTeste({solicitacoes: [pedido]});
      expect(podeEnviarLembrete(s, pedido)).toBe(false);
      expect(podeEnviarLembrete({...s, agora: em(2026, 10, 15, 10, 1)}, pedido)).toBe(true);
    });

    it('envia uma única vez por pedido e avisa os responsáveis', () => {
      const s = estadoDeTeste({solicitacoes: [solicitacao('p', 'a1', {criadoEm: em(2026, 10, 15, 7, 0)})]});
      const primeiro = enviarLembrete(s, 'p');
      expect(primeiro.resultado.sucesso).toBe(true);
      expect(buscar.solicitacao(primeiro.estado, 'p').lembreteEnviadoEm).toBe(s.agora);
      expect(primeiro.estado.notificacoes[0]).toMatchObject({usuarioId: 'resp', tipo: 'lembrete'});

      expect(enviarLembrete(primeiro.estado, 'p').resultado.sucesso).toBe(false);
    });

    it('pedido já analisado não aceita lembrete', () => {
      const pedido = solicitacao('p', 'a1', {status: 'aprovada', criadoEm: em(2026, 10, 14, 7, 0)});
      expect(podeEnviarLembrete(estadoDeTeste({solicitacoes: [pedido]}), pedido)).toBe(false);
    });
  });
});
