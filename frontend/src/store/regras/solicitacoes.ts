import {addDays, differenceInHours, formatDateShort, parseDate} from '../../lib/date-utils';
import {Item, Solicitacao, StatusItem, Usuario} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novaNotificacao, novoEvento, responsaveis} from '../estado';
import {codigosEmUso, gerarCodigoRetirada} from './codigos';

export interface PermissaoSolicitacao {
  pode: boolean;
  motivo?: string;
  itensAtuais: number;
  limiteMax: number;
}

function mudarStatusItem(s: ProtemState, itemId: string, status: StatusItem): Item[] {
  return s.itens.map((i) => (i.id === itemId ? {...i, status} : i));
}

/** Motivo pelo qual a conta não pode solicitar, ou null se pode. */
export function bloqueioDaConta(usuario: Usuario): string | null {
  if (usuario.status === 'pendente') return 'Sua conta ainda está aguardando aprovação.';
  const motivo = usuario.restricaoManual ? ` Motivo: ${usuario.restricaoManual.motivo}` : '';
  if (usuario.status === 'bloqueada') {
    return usuario.restricaoManual
      ? `Sua conta foi bloqueada pelo responsável.${motivo}`
      : 'Sua conta está bloqueada porque há um item em atraso. Ela volta ao normal quando o item for devolvido.';
  }
  if (usuario.status === 'suspensa') {
    const ate = usuario.suspensoAte ? ` até ${formatDateShort(usuario.suspensoAte)}` : '';
    const porque = usuario.restricaoManual ? motivo : ' Motivo: devolução com atraso.';
    return `Sua conta está suspensa${ate} e não pode pedir itens.${porque}`;
  }
  return null;
}

/**
 * RN03: Conta quantos itens daquela categoria o usuário possui atualmente em
 * solicitado, reservado, emprestado ou atrasado.
 */
export function contarItensAtivosDoUsuarioNaCategoria(s: ProtemState, categoriaId: string, usuarioId: string | null): number {
  if (!usuarioId) return 0;
  const daCategoria = (itemId: string) => s.itens.find((i) => i.id === itemId)?.categoriaId === categoriaId;

  // 1) Itens em solicitações pendentes ou aprovadas (reservadas)
  const emSolicitacao = s.solicitacoes
    .filter((sol) => sol.solicitanteId === usuarioId && (sol.status === 'pendente' || sol.status === 'aprovada'))
    .map((sol) => sol.itemId);

  // 2) Itens em empréstimos ativos (emprestado ou atrasado)
  const emEmprestimo = s.emprestimos
    .filter((emp) => emp.usuarioId === usuarioId && !emp.devolvidoEm)
    .map((emp) => emp.itemId);

  return new Set([...emSolicitacao, ...emEmprestimo].filter(daCategoria)).size;
}

/**
 * Valida se o usuário pode solicitar um item de uma determinada categoria
 * considerando limite (RN03) e status da conta (bloqueada/suspensa/pendente).
 */
export function verificarPermissaoSolicitacao(s: ProtemState, categoriaId: string, usuarioId: string | null): PermissaoSolicitacao {
  const usuario = s.usuarios.find((u) => u.id === usuarioId);
  const categoria = s.categorias.find((c) => c.id === categoriaId);

  const limiteMax = categoria?.limitePorPessoa ?? 1;
  const itensAtuais = contarItensAtivosDoUsuarioNaCategoria(s, categoriaId, usuarioId);

  if (!usuario) {
    return {pode: false, motivo: 'Usuário não autenticado.', itensAtuais, limiteMax};
  }
  const bloqueio = bloqueioDaConta(usuario);
  if (bloqueio) {
    return {pode: false, motivo: bloqueio, itensAtuais, limiteMax};
  }
  if (itensAtuais >= limiteMax) {
    return {
      pode: false,
      motivo: `Você já atingiu o limite de itens desta categoria (${itensAtuais} de ${limiteMax}).`,
      itensAtuais,
      limiteMax,
    };
  }
  return {pode: true, itensAtuais, limiteMax};
}

/**
 * RN01: Pedido precisa de aprovação do responsável.
 * RN02: Data de devolução dentro do prazoMaxDias da categoria.
 * RN03: Limite por pessoa ao mesmo tempo na categoria (contam solicitado, reservado, emprestado e atrasado).
 * RN09: Item fica "solicitado" e sai do catálogo.
 * Conta bloqueada ou suspensa ou pendente NÃO pode solicitar.
 */
export function solicitarEmprestimo(
  s: ProtemState,
  itemId: string,
  solicitanteId: string,
  devolucaoDesejada: string,
): Transicao<ResultadoAcao & {solicitacaoId?: string}> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});

  const usuario = s.usuarios.find((u) => u.id === solicitanteId);
  if (!usuario) return falha('Usuário não encontrado.');

  if (usuario.status === 'pendente') return falha('Sua conta ainda está pendente de aprovação.');
  if (usuario.status === 'bloqueada' || usuario.status === 'suspensa') return falha(bloqueioDaConta(usuario)!);

  const item = s.itens.find((i) => i.id === itemId);
  if (!item) return falha('Item não encontrado.');
  if (item.status !== 'disponivel') {
    return falha(`O item não está disponível no momento (status: ${item.status}).`);
  }

  const categoria = s.categorias.find((c) => c.id === item.categoriaId);
  if (!categoria) return falha('Categoria não encontrada.');

  // RN02: Validar prazo máximo da categoria (até o fim do último dia permitido)
  const maxDate = addDays(parseDate(s.agora), categoria.prazoMaxDias);
  const maxDateEndOfDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);
  if (parseDate(devolucaoDesejada).getTime() > maxDateEndOfDay.getTime()) {
    return falha(
      `A data de devolução excede o prazo máximo permitido para a categoria ${categoria.nome} (${categoria.prazoMaxDias} dia(s)).`,
    );
  }

  // RN03: Limite por pessoa ao mesmo tempo na categoria
  if (contarItensAtivosDoUsuarioNaCategoria(s, categoria.id, solicitanteId) >= categoria.limitePorPessoa) {
    return falha(
      `Você atingiu o limite de itens simultâneos para a categoria ${categoria.nome} (máximo ${categoria.limitePorPessoa} item(ns)). Conclua devoluções antes de novo pedido.`,
    );
  }

  const novaSolicitacao: Solicitacao = {
    id: 'solic-' + Date.now(),
    solicitanteId,
    itemId,
    devolucaoDesejada,
    status: 'pendente',
    criadoEm: s.agora,
  };

  const novasNotifs = responsaveis(s).map((resp) =>
    novaNotificacao(
      resp.id,
      'novo_pedido',
      `${usuario.nome} solicitou o empréstimo de: ${item.nome}.`,
      s.agora,
      '/painel/solicitacoes',
    ),
  );

  return {
    estado: {
      ...s,
      // Item passa a "solicitado" (RN09: sai do catálogo)
      itens: mudarStatusItem(s, itemId, 'solicitado'),
      solicitacoes: [novaSolicitacao, ...s.solicitacoes],
      notificacoes: [...novasNotifs, ...s.notificacoes],
      auditoria: [
        novoEvento('pedido_criado', s.agora, solicitanteId, {autorId: solicitanteId, itemId}),
        ...s.auditoria,
      ],
    },
    resultado: {
      sucesso: true,
      mensagem: 'Solicitação enviada com sucesso! Aguarde a aprovação do responsável.',
      solicitacaoId: novaSolicitacao.id,
    },
  };
}

/**
 * RN01 & RN04: Aprovado o pedido, a retirada deve acontecer no mesmo dia;
 * se o dia terminar sem retirada, expira. Item passa para 'reservado'.
 * Gera o código de retirada que só quem pediu recebe (ver ./codigos).
 */
export function aprovarPedido(s: ProtemState, solicitacaoId: string, responsavelId: string): Transicao<ResultadoAcao> {
  const solic = s.solicitacoes.find((sol) => sol.id === solicitacaoId);
  if (!solic) return {estado: s, resultado: {sucesso: false, mensagem: 'Solicitação não encontrada.'}};
  if (solic.status !== 'pendente') return {estado: s, resultado: {sucesso: false, mensagem: 'Solicitação já foi avaliada.'}};

  const item = s.itens.find((i) => i.id === solic.itemId);
  const codigoRetirada = gerarCodigoRetirada(codigosEmUso(s));
  const notif = novaNotificacao(
    solic.solicitanteId,
    'aprovacao',
    `Seu pedido para "${item?.nome || 'o item'}" foi APROVADO! Realize a retirada hoje no setor responsável com o código ${codigoRetirada}.`,
    s.agora,
    '/meus-emprestimos',
  );

  return {
    estado: {
      ...s,
      solicitacoes: s.solicitacoes.map((sol) =>
        sol.id === solicitacaoId
          ? {...sol, status: 'aprovada' as const, avaliadoPor: responsavelId, avaliadoEm: s.agora, codigoRetirada}
          : sol,
      ),
      itens: mudarStatusItem(s, solic.itemId, 'reservado'),
      notificacoes: [notif, ...s.notificacoes],
      auditoria: [
        novoEvento('pedido_aprovado', s.agora, solic.solicitanteId, {autorId: responsavelId, itemId: solic.itemId}),
        ...s.auditoria,
      ],
    },
    resultado: {sucesso: true, mensagem: 'Pedido aprovado com sucesso! Aguardando retirada hoje.'},
  };
}

/** RN09: Se o pedido for recusado, item volta a "disponivel". O motivo é obrigatório e fica no pedido. */
export function recusarPedido(
  s: ProtemState,
  solicitacaoId: string,
  responsavelId: string,
  motivo: string,
): Transicao<ResultadoAcao> {
  const solic = s.solicitacoes.find((sol) => sol.id === solicitacaoId);
  if (!solic) return {estado: s, resultado: {sucesso: false, mensagem: 'Solicitação não encontrada.'}};
  if (solic.status !== 'pendente') return {estado: s, resultado: {sucesso: false, mensagem: 'Solicitação já foi avaliada.'}};
  const motivoRecusa = motivo.trim();
  if (!motivoRecusa) return {estado: s, resultado: {sucesso: false, mensagem: 'Informe o motivo da recusa.'}};

  const item = s.itens.find((i) => i.id === solic.itemId);
  const notif = novaNotificacao(
    solic.solicitanteId,
    'recusa',
    `Seu pedido para "${item?.nome || 'o item'}" não foi aprovado. Motivo: ${motivoRecusa}`,
    s.agora,
    '/meus-emprestimos',
  );

  return {
    estado: {
      ...s,
      solicitacoes: s.solicitacoes.map((sol) =>
        sol.id === solicitacaoId
          ? {...sol, status: 'recusada' as const, avaliadoPor: responsavelId, avaliadoEm: s.agora, motivoRecusa}
          : sol,
      ),
      itens: mudarStatusItem(s, solic.itemId, 'disponivel'),
      notificacoes: [notif, ...s.notificacoes],
      auditoria: [
        novoEvento('pedido_recusado', s.agora, solic.solicitanteId, {
          autorId: responsavelId,
          itemId: solic.itemId,
          motivo: motivoRecusa,
        }),
        ...s.auditoria,
      ],
    },
    resultado: {sucesso: true, mensagem: 'Pedido recusado. O item voltou a ficar disponível no catálogo.'},
  };
}

/**
 * RN10: Pedido pendente não expira. Depois de 2 horas sem análise,
 * o solicitante pode enviar um lembrete ao responsável, uma única vez por pedido.
 */
export function podeEnviarLembrete(s: ProtemState, solicitacao: Solicitacao): boolean {
  if (solicitacao.status !== 'pendente' || solicitacao.lembreteEnviadoEm) return false;
  return differenceInHours(parseDate(s.agora), parseDate(solicitacao.criadoEm)) >= 2;
}

export function enviarLembrete(s: ProtemState, solicitacaoId: string): Transicao<ResultadoAcao> {
  const solic = s.solicitacoes.find((sol) => sol.id === solicitacaoId);
  if (!solic) return {estado: s, resultado: {sucesso: false, mensagem: 'Solicitação não encontrada.'}};

  if (!podeEnviarLembrete(s, solic)) {
    return {
      estado: s,
      resultado: {sucesso: false, mensagem: 'O lembrete só pode ser enviado após 2 horas sem análise e apenas uma vez.'},
    };
  }

  const solicitante = s.usuarios.find((u) => u.id === solic.solicitanteId);
  const item = s.itens.find((i) => i.id === solic.itemId);
  const novasNotifs = responsaveis(s).map((r) =>
    novaNotificacao(
      r.id,
      'lembrete',
      `Lembrete de análise: ${solicitante?.nome || 'Solicitante'} aguarda avaliação do pedido para "${item?.nome || 'item'}".`,
      s.agora,
      '/painel/solicitacoes',
    ),
  );

  return {
    estado: {
      ...s,
      solicitacoes: s.solicitacoes.map((sol) => (sol.id === solicitacaoId ? {...sol, lembreteEnviadoEm: s.agora} : sol)),
      notificacoes: [...novasNotifs, ...s.notificacoes],
    },
    resultado: {sucesso: true, mensagem: 'Lembrete enviado aos responsáveis!'},
  };
}
