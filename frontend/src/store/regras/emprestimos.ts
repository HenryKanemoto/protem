import {addDays, calculateDiasAtraso, formatDateShort, parseDate} from '../../lib/date-utils';
import {CategoriaAvaria, Emprestimo, EventoAuditoria, Ocorrencia, StatusItem, StatusUsuario, Usuario} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novaNotificacao, novoEvento} from '../estado';
import {ehCategoriaAvaria, rotuloCategoriaAvaria} from './avaria';
import {codigoConfere, codigoDevolucaoConfere, codigosEmUso, gerarCodigoRetirada, normalizarCodigo} from './codigos';

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
        mensagem: 'Código de retirada incorreto. Peça à pessoa que mostre o código no app, em Meus códigos.',
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
    // A pessoa mostra este código ao responsável quando for devolver (só aparece em Meus códigos)
    codigoDevolucao: gerarCodigoRetirada(codigosEmUso(s)),
  };

  // A mensagem não traz o código: ele só aparece em Meus códigos
  const notif = novaNotificacao(
    solic.solicitanteId,
    'aprovacao',
    `Retirada confirmada para "${item.nome}". Devolução prevista: ${formatDateShort(solic.devolucaoDesejada)}. Seu código de devolução está em Meus códigos.`,
    s.agora,
    '/codigos',
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
/**
 * Dados da devolução além do empréstimo: como foi confirmada (com o código que a pessoa
 * mostrou ou, se ela não tiver, sem código e com motivo) e, se voltou com avaria, de que tipo.
 */
export interface OpcoesDevolucao {
  codigo?: string;
  semCodigoMotivo?: string;
  categoriaAvaria?: CategoriaAvaria;
}

export function registrarDevolucao(
  s: ProtemState,
  emprestimoId: string,
  comDefeito: boolean,
  descricaoDefeito?: string,
  responsavelId?: string,
  opcoes: OpcoesDevolucao = {},
): Transicao<ResultadoAcao> {
  const emp = s.emprestimos.find((e) => e.id === emprestimoId);
  if (!emp) return {estado: s, resultado: {sucesso: false, mensagem: 'Empréstimo não encontrado.'}};
  if (emp.devolvidoEm) return {estado: s, resultado: {sucesso: false, mensagem: 'Item já consta como devolvido.'}};

  // Empréstimo com código: confere o código ou aceita "sem código" com motivo
  const semCodigoMotivo = opcoes.semCodigoMotivo?.trim();
  if (emp.codigoDevolucao && !semCodigoMotivo) {
    if (!normalizarCodigo(opcoes.codigo ?? '')) {
      return {estado: s, resultado: {sucesso: false, mensagem: 'Informe o código de devolução que a pessoa mostrar.'}};
    }
    if (!codigoDevolucaoConfere(emp, opcoes.codigo ?? '')) {
      return {
        estado: s,
        resultado: {
          sucesso: false,
          mensagem: 'Código de devolução incorreto. Peça à pessoa que mostre o código no app, em Meus códigos.',
        },
      };
    }
  }

  // Avaria: o tipo e a descrição são obrigatórios (a ocorrência precisa servir de prova depois)
  const descricao = descricaoDefeito?.trim() ?? '';
  if (comDefeito) {
    if (!ehCategoriaAvaria(opcoes.categoriaAvaria)) {
      return {estado: s, resultado: {sucesso: false, mensagem: 'Escolha o tipo de avaria.'}};
    }
    if (!descricao) {
      return {estado: s, resultado: {sucesso: false, mensagem: 'Descreva a avaria para registrar a ocorrência.'}};
    }
  }

  const item = s.itens.find((i) => i.id === emp.itemId);
  const usuario = s.usuarios.find((u) => u.id === emp.usuarioId);
  const clockNow = parseDate(s.agora);
  const diasAtraso = calculateDiasAtraso(emp.devolucaoPrevista, clockNow);

  const usouSemCodigo = !!emp.codigoDevolucao && !!semCodigoMotivo;
  const emprestimos = s.emprestimos.map((e) =>
    e.id === emprestimoId
      ? {...e, devolvidoEm: s.agora, diasAtraso, ...(usouSemCodigo ? {devolvidoSemCodigoMotivo: semCodigoMotivo} : {})}
      : e,
  );

  const ocorrencias = [...s.ocorrencias];
  if (comDefeito) {
    const novaOcorrencia: Ocorrencia = {
      id: 'ocorr-' + Date.now(),
      emprestimoId: emp.id,
      itemId: emp.itemId,
      usuarioId: emp.usuarioId,
      descricao,
      categoria: opcoes.categoriaAvaria,
      status: 'aberta',
      criadoEm: s.agora,
    };
    ocorrencias.unshift(novaOcorrencia);
  }
  // RN07: item com defeito vai para manutenção
  const novoStatusItem: StatusItem = comDefeito ? 'manutencao' : 'disponivel';
  const itens = s.itens.map((i) => (i.id === emp.itemId ? {...i, status: novoStatusItem} : i));

  const {usuarios, aviso, eventoConta} = aplicarPoliticaAtraso(s, usuario, emprestimos, diasAtraso, clockNow, item?.nome);
  // Uma frase só: o que aconteceu com o item e, se houver, o que aconteceu com a conta
  const atraso = diasAtraso > 0 ? ` com ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} de atraso` : '';
  const mensagem = `Devolução de "${item?.nome || 'item'}" registrada${atraso}.` + (aviso ? ` ${aviso}` : '');
  // A avaria vem à parte, para a tela destacar: o item não volta ao catálogo
  const nota = comDefeito
    ? `Voltou com avaria (${rotuloCategoriaAvaria(opcoes.categoriaAvaria)}) e está em manutenção, aguardando envio ao técnico.`
    : undefined;

  const notif = novaNotificacao(
    emp.usuarioId,
    'aprovacao',
    `A devolução de "${item?.nome || 'item'}" foi confirmada pelo responsável.${comDefeito ? ' O item foi para a manutenção e a ocorrência foi registrada.' : ''}`,
    s.agora,
    '/meus-emprestimos',
  );

  const eventoDevolucao = novoEvento(comDefeito ? 'devolucao_avaria' : 'devolucao', s.agora, emp.usuarioId, {
    autorId: responsavelId,
    itemId: emp.itemId,
    motivo: comDefeito ? ocorrencias[0].descricao : undefined,
    detalhe:
      (comDefeito ? `${rotuloCategoriaAvaria(opcoes.categoriaAvaria)}. ` : '') +
      (diasAtraso > 0 ? `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} de atraso` : 'No prazo') +
      (usouSemCodigo ? `. Sem código de devolução: ${semCodigoMotivo}` : ''),
  });
  // A consequência na conta (se houver) vem depois da devolução, então fica mais acima na lista
  const auditoria = [...(eventoConta ? [eventoConta] : []), eventoDevolucao, ...s.auditoria];

  return {
    estado: {...s, emprestimos, itens, ocorrencias, usuarios, notificacoes: [notif, ...s.notificacoes], auditoria},
    resultado: {sucesso: true, mensagem, ...(nota ? {nota} : {})},
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
): {usuarios: Usuario[]; aviso?: string; eventoConta?: EventoAuditoria} {
  // O aviso é só a consequência na conta; a frase da devolução é montada por quem chama
  if (!usuario) return {usuarios: s.usuarios};

  // Bloqueio ou suspensão aplicados pelo responsável: a devolução não mexe na conta
  if (usuario.restricaoManual) {
    return {usuarios: s.usuarios, aviso: `A conta continua ${usuario.status} pelo responsável.`};
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
        eventoConta: evento('conta_reativada', 'Nenhum item em atraso depois da devolução'),
      };
    }
    return {usuarios: s.usuarios};
  }

  const politica = s.configuracao.politicaAtraso;
  if (politica === 'rigida') {
    // Suspende a pessoa pelo mesmo número de dias de atraso após a devolução
    const suspensoAte = addDays(clockNow, diasAtraso);
    const prazo = `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}, até ${formatDateShort(suspensoAte)}`;
    return {
      usuarios: mudar({status: 'suspensa' as StatusUsuario, suspensoAte: suspensoAte.toISOString()}),
      aviso: `Pela política rígida, a conta foi suspensa por ${diasAtraso} dia(s) (até ${formatDateShort(suspensoAte)}).`,
      eventoConta: evento('conta_suspensa', `Devolveu "${nomeItem}" com ${diasAtraso} dia(s) de atraso (política rígida)`, prazo),
    };
  }
  if (politica === 'intermediaria') {
    // Desbloqueia após a devolução, desde que não tenha outros atrasos
    if (temOutroAtraso) {
      return {usuarios: s.usuarios, aviso: 'A conta continua bloqueada porque há outro item em atraso.'};
    }
    const desbloqueia = usuario.status !== 'ativa';
    return {
      usuarios: desbloqueia ? mudar(desbloqueio) : s.usuarios,
      aviso: desbloqueia ? 'Como o item atrasado foi devolvido, a conta foi desbloqueada.' : undefined,
      eventoConta: desbloqueia ? evento('conta_reativada', `Devolveu "${nomeItem}", que estava em atraso`) : undefined,
    };
  }
  // Simples: só registra o atraso. Se a conta ficou bloqueada por uma política anterior
  // (o responsável trocou de política com o item já atrasado), a devolução a libera.
  const avisoSimples = 'Pela política simples, só o atraso fica registrado.';
  if (usuario.status === 'bloqueada' && !temOutroAtraso) {
    return {
      usuarios: mudar(desbloqueio),
      aviso: `${avisoSimples} A conta foi desbloqueada.`,
      eventoConta: evento('conta_reativada', `Devolveu "${nomeItem}", que estava em atraso`),
    };
  }
  return {usuarios: s.usuarios, aviso: avisoSimples};
}
