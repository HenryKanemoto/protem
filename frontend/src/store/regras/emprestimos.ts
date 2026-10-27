import {addDays, calculateDiasAtraso, formatDateShort, parseDate} from '../../lib/date-utils';
import {Emprestimo, EventoAuditoria, Ocorrencia, StatusItem, StatusUsuario, Usuario} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novaNotificacao, novoEvento} from '../estado';
import {codigoConfere} from './codigos';

export type ResultadoRetirada = ResultadoAcao & {emprestimoId?: string; itemId?: string};

/**
 * RN05: A retirada só é registrada pelo responsável, lendo o QR code do item;
 * o prazo começa a contar nesse momento.
 * Só libera com o código de retirada que a pessoa recebeu na aprovação (ver ./codigos).
 */
export function registrarRetiradaPorQr(
  s: ProtemState,
  codigoQrOuPatrimonio: string,
  responsavelId: string,
  codigoRetirada: string,
): Transicao<ResultadoRetirada> {
  const codigo = codigoQrOuPatrimonio.trim().toUpperCase();
  const item = s.itens.find((i) => i.codigoQr.toUpperCase() === codigo || i.patrimonio.toUpperCase() === codigo);
  if (!item) {
    return {
      estado: s,
      resultado: {sucesso: false, mensagem: `Item não encontrado para o código "${codigoQrOuPatrimonio}".`},
    };
  }
  return registrarRetirada(s, item.id, responsavelId, codigoRetirada);
}

export function registrarRetirada(
  s: ProtemState,
  itemId: string,
  responsavelId: string,
  codigoRetirada: string,
): Transicao<ResultadoRetirada> {
  const item = s.itens.find((i) => i.id === itemId);
  if (!item) return {estado: s, resultado: {sucesso: false, mensagem: 'Item não encontrado.'}};

  const solic = s.solicitacoes.find((sol) => sol.itemId === itemId && sol.status === 'aprovada');
  if (!solic) {
    return {
      estado: s,
      resultado: {
        sucesso: false,
        mensagem: `Não há pedido aprovado aguardando retirada para o item ${item.nome} (${item.patrimonio}).`,
      },
    };
  }

  if (!codigoConfere(solic, codigoRetirada)) {
    return {
      estado: s,
      resultado: {
        sucesso: false,
        mensagem: 'Código de retirada incorreto. Peça à pessoa que mostre o código no app, em Meus empréstimos.',
      },
    };
  }

  const novoEmprestimo: Emprestimo = {
    id: 'emp-' + Date.now(),
    solicitacaoId: solic.id,
    itemId: item.id,
    usuarioId: solic.solicitanteId,
    registradoPor: responsavelId,
    retiradoEm: s.agora,
    devolucaoPrevista: solic.devolucaoDesejada,
    diasAtraso: 0,
  };

  const notif = novaNotificacao(
    solic.solicitanteId,
    'aprovacao',
    `Retirada confirmada para "${item.nome}". Devolução prevista: ${formatDateShort(solic.devolucaoDesejada)}.`,
    s.agora,
    '/meus-emprestimos',
  );

  return {
    estado: {
      ...s,
      itens: s.itens.map((i) => (i.id === itemId ? {...i, status: 'emprestado' as StatusItem} : i)),
      solicitacoes: s.solicitacoes.map((sol) => (sol.id === solic.id ? {...sol, status: 'concluida' as const} : sol)),
      emprestimos: [novoEmprestimo, ...s.emprestimos],
      notificacoes: [notif, ...s.notificacoes],
      auditoria: [
        novoEvento('retirada', s.agora, solic.solicitanteId, {
          autorId: responsavelId,
          itemId: item.id,
          detalhe: `Devolução prevista para ${formatDateShort(solic.devolucaoDesejada)}`,
        }),
        ...s.auditoria,
      ],
    },
    resultado: {
      sucesso: true,
      mensagem: `Retirada registrada com sucesso para ${item.nome}!`,
      emprestimoId: novoEmprestimo.id,
      itemId: item.id,
    },
  };
}

/**
 * RN06: Política de atraso configurável (simples, intermediária, rígida).
 * RN07: Item devolvido com defeito vai para manutenção, sai do catálogo e gera ocorrência.
 */
export function registrarDevolucao(
  s: ProtemState,
  emprestimoId: string,
  comDefeito: boolean,
  descricaoDefeito?: string,
  responsavelId?: string,
): Transicao<ResultadoAcao> {
  const emp = s.emprestimos.find((e) => e.id === emprestimoId);
  if (!emp) return {estado: s, resultado: {sucesso: false, mensagem: 'Empréstimo não encontrado.'}};
  if (emp.devolvidoEm) return {estado: s, resultado: {sucesso: false, mensagem: 'Item já consta como devolvido.'}};

  const item = s.itens.find((i) => i.id === emp.itemId);
  const usuario = s.usuarios.find((u) => u.id === emp.usuarioId);
  const clockNow = parseDate(s.agora);
  const diasAtraso = calculateDiasAtraso(emp.devolucaoPrevista, clockNow);

  const emprestimos = s.emprestimos.map((e) => (e.id === emprestimoId ? {...e, devolvidoEm: s.agora, diasAtraso} : e));

  const ocorrencias = [...s.ocorrencias];
  if (comDefeito) {
    const novaOcorrencia: Ocorrencia = {
      id: 'ocorr-' + Date.now(),
      emprestimoId: emp.id,
      itemId: emp.itemId,
      usuarioId: emp.usuarioId,
      descricao: descricaoDefeito || 'Defeito relatado na devolução do item.',
      status: 'aberta',
      criadoEm: s.agora,
    };
    ocorrencias.unshift(novaOcorrencia);
  }
  // RN07: item com defeito vai para manutenção
  const novoStatusItem: StatusItem = comDefeito ? 'manutencao' : 'disponivel';
  const itens = s.itens.map((i) => (i.id === emp.itemId ? {...i, status: novoStatusItem} : i));

  const {usuarios, mensagem, eventoConta} = aplicarPoliticaAtraso(s, usuario, emprestimos, diasAtraso, clockNow, item?.nome);

  const notif = novaNotificacao(
    emp.usuarioId,
    'aprovacao',
    `A devolução de "${item?.nome || 'item'}" foi confirmada pelo responsável.${comDefeito ? ' O item foi encaminhado para manutenção com registro de ocorrência.' : ''}`,
    s.agora,
    '/meus-emprestimos',
  );

  const eventoDevolucao = novoEvento(comDefeito ? 'devolucao_avaria' : 'devolucao', s.agora, emp.usuarioId, {
    autorId: responsavelId,
    itemId: emp.itemId,
    motivo: comDefeito ? ocorrencias[0].descricao : undefined,
    detalhe: diasAtraso > 0 ? `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} de atraso` : 'No prazo',
  });
  // A consequência na conta (se houver) vem depois da devolução, então fica mais acima na lista
  const auditoria = [...(eventoConta ? [eventoConta] : []), eventoDevolucao, ...s.auditoria];

  return {
    estado: {...s, emprestimos, itens, ocorrencias, usuarios, notificacoes: [notif, ...s.notificacoes], auditoria},
    resultado: {sucesso: true, mensagem},
  };
}

/** RN06: decide o que acontece com a conta de quem devolveu, conforme a política configurada. */
function aplicarPoliticaAtraso(
  s: ProtemState,
  usuario: Usuario | undefined,
  emprestimos: Emprestimo[],
  diasAtraso: number,
  clockNow: Date,
  nomeItem = 'o item',
): {usuarios: Usuario[]; mensagem: string; eventoConta?: EventoAuditoria} {
  const padrao = 'Devolução registrada com sucesso!';
  if (!usuario) return {usuarios: s.usuarios, mensagem: padrao};

  // Bloqueio ou suspensão aplicados pelo responsável: a devolução não mexe na conta
  if (usuario.restricaoManual) {
    const atraso = diasAtraso > 0 ? ` com ${diasAtraso} dia(s) de atraso` : '';
    return {
      usuarios: s.usuarios,
      mensagem: `Devolução registrada${atraso}. A conta continua ${usuario.status} pelo responsável.`,
    };
  }

  const mudar = (mudanca: Partial<Usuario>) =>
    s.usuarios.map((u) => (u.id === usuario.id ? {...u, ...mudanca} : u));
  const temOutroAtraso = emprestimos.some((e) => e.usuarioId === usuario.id && !e.devolvidoEm && e.diasAtraso > 0);
  // Feito pelo sistema (sem autor), como consequência da devolução
  const evento = (tipo: 'conta_suspensa' | 'conta_reativada', motivo: string, detalhe?: string) =>
    novoEvento(tipo, s.agora, usuario.id, {motivo, detalhe});
  const desbloqueio = {status: 'ativa' as const};

  if (diasAtraso <= 0) {
    // Devolvido no prazo: se estava bloqueado e não há outros atrasos, volta a ativa
    if (!temOutroAtraso && usuario.status === 'bloqueada') {
      return {
        usuarios: mudar(desbloqueio),
        mensagem: padrao,
        eventoConta: evento('conta_reativada', 'Nenhum item em atraso depois da devolução'),
      };
    }
    return {usuarios: s.usuarios, mensagem: padrao};
  }

  const politica = s.configuracao.politicaAtraso;
  if (politica === 'rigida') {
    // Suspende a pessoa pelo mesmo número de dias de atraso após a devolução
    const suspensoAte = addDays(clockNow, diasAtraso);
    const prazo = `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}, até ${formatDateShort(suspensoAte)}`;
    return {
      usuarios: mudar({status: 'suspensa' as StatusUsuario, suspensoAte: suspensoAte.toISOString()}),
      mensagem: `Devolução registrada com atraso de ${diasAtraso} dia(s). Pela política rígida, a conta foi suspensa por ${diasAtraso} dia(s) (até ${formatDateShort(suspensoAte)}).`,
      eventoConta: evento('conta_suspensa', `Devolveu "${nomeItem}" com ${diasAtraso} dia(s) de atraso (política rígida)`, prazo),
    };
  }
  if (politica === 'intermediaria') {
    // Desbloqueia após a devolução, desde que não tenha outros atrasos
    const desbloqueia = !temOutroAtraso && usuario.status !== 'ativa';
    return {
      usuarios: temOutroAtraso ? s.usuarios : mudar(desbloqueio),
      mensagem: 'Devolução registrada. Como o item atrasado foi devolvido, a conta foi desbloqueada.',
      eventoConta: desbloqueia ? evento('conta_reativada', `Devolveu "${nomeItem}", que estava em atraso`) : undefined,
    };
  }
  // Simples: não suspende
  return {
    usuarios: s.usuarios,
    mensagem: `Devolução registrada com ${diasAtraso} dia(s) de atraso (política simples).`,
  };
}
