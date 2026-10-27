import {calculateDiasAtraso, formatDateShort, isDayEnded, parseDate} from '../../lib/date-utils';
import {EventoAuditoria} from '../../types/models';
import {ProtemState, novaNotificacao, novoEvento, responsaveis} from '../estado';

/**
 * Rotina automática executada ao avançar o relógio:
 * 1. RN04: Expirar pedidos aprovados e não retirados quando o dia termina (item volta a disponível).
 * 2. RN06: Marcar como atrasados os empréstimos cujo prazo venceu.
 *    - item "atrasado"
 *    - conta "bloqueada" nas políticas intermediária e rígida
 * 3. Gerar notificações de prazo próximo (1 dia antes) e de atraso.
 * 4. Encerrar suspensões vencidas (se usuario.suspensoAte <= agora, volta a ativa).
 * Dias de atraso = dias inteiros depois do prazo (mínimo 1).
 */
export function executarRotinaAutomatica(s: ProtemState, clockNow: Date): ProtemState {
  const agoraIso = clockNow.toISOString();
  const itens = [...s.itens];
  let usuarios = [...s.usuarios];
  const notificacoes = [...s.notificacoes];
  // Eventos novos, do mais antigo para o mais recente; entram no topo da auditoria no fim
  const eventos: EventoAuditoria[] = [];
  const politica = s.configuracao.politicaAtraso;

  // 1. RN04: Expirar pedidos aprovados não retirados se o dia da aprovação terminou
  const solicitacoes = s.solicitacoes.map((solic) => {
    if (solic.status !== 'aprovada' || !solic.avaliadoEm) return solic;
    if (!isDayEnded(parseDate(solic.avaliadoEm), clockNow)) return solic;

    // Expirar pedido e devolver item para disponível
    const itemIdx = itens.findIndex((i) => i.id === solic.itemId);
    if (itemIdx >= 0 && itens[itemIdx].status === 'reservado') {
      itens[itemIdx] = {...itens[itemIdx], status: 'disponivel'};
    }
    notificacoes.unshift(
      novaNotificacao(
        solic.solicitanteId,
        'expiracao',
        'Seu pedido aprovado expirou porque a retirada não foi realizada no mesmo dia.',
        agoraIso,
        '/meus-emprestimos',
      ),
    );
    eventos.push(
      novoEvento('pedido_expirado', agoraIso, solic.solicitanteId, {
        itemId: solic.itemId,
        motivo: 'Não foi retirado no dia da aprovação',
      }),
    );
    return {...solic, status: 'expirada' as const};
  });

  // 2. RN06: Marcar atrasos em empréstimos em andamento
  const emprestimos = s.emprestimos.map((emp) => {
    if (emp.devolvidoEm) return emp;
    const diasAtraso = calculateDiasAtraso(emp.devolucaoPrevista, clockNow);
    if (diasAtraso <= 0) return emp;

    const itemIdx = itens.findIndex((i) => i.id === emp.itemId);
    if (itemIdx >= 0 && itens[itemIdx].status !== 'atrasado') {
      itens[itemIdx] = {...itens[itemIdx], status: 'atrasado'};
    }

    // Bloquear conta nas políticas intermediária e rígida
    if (politica === 'intermediaria' || politica === 'rigida') {
      const userIdx = usuarios.findIndex((u) => u.id === emp.usuarioId);
      if (userIdx >= 0 && usuarios[userIdx].status === 'ativa') {
        usuarios[userIdx] = {...usuarios[userIdx], status: 'bloqueada'};
        eventos.push(
          novoEvento('conta_bloqueada', agoraIso, emp.usuarioId, {
            itemId: emp.itemId,
            motivo: `Atraso na devolução (política ${politica === 'rigida' ? 'rígida' : 'intermediária'})`,
          }),
        );
      }
    }

    const empItem = s.itens.find((i) => i.id === emp.itemId);
    const empUser = s.usuarios.find((u) => u.id === emp.usuarioId);

    // Notificação de atraso para o usuário, uma única vez
    const jaNotificado = notificacoes.some(
      (n) => n.usuarioId === emp.usuarioId && n.tipo === 'atraso' && n.mensagem.includes('está atrasada'),
    );
    if (!jaNotificado) {
      notificacoes.unshift(
        novaNotificacao(
          emp.usuarioId,
          'atraso',
          `Atenção: A devolução de "${empItem?.nome || 'item'}" está atrasada em ${diasAtraso} dia(s).`,
          agoraIso,
          '/meus-emprestimos',
        ),
      );
    }

    // Notificar também os responsáveis sobre o atraso (Wireframe R17: "___ está atrasado com ___.")
    responsaveis(s).forEach((resp) => {
      const jaNotificadoResp = notificacoes.some(
        (n) => n.usuarioId === resp.id && n.tipo === 'atraso' && n.mensagem.includes(empItem?.nome || ''),
      );
      if (!jaNotificadoResp) {
        notificacoes.unshift(
          novaNotificacao(
            resp.id,
            'atraso',
            `${empUser?.nome || 'Usuário'} está atrasado com ${empItem?.nome || 'item'}.`,
            agoraIso,
            '/painel',
          ),
        );
      }
    });

    return {...emp, diasAtraso};
  });

  // 3. Notificações de prazo próximo (1 dia antes)
  emprestimos.forEach((emp) => {
    if (emp.devolvidoEm || emp.diasAtraso !== 0) return;
    const diffHours = (parseDate(emp.devolucaoPrevista).getTime() - clockNow.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 0 || diffHours > 24) return;

    // A mensagem usa a data formatada, então a checagem também precisa usar
    const prazo = formatDateShort(emp.devolucaoPrevista);
    const jaTemLembrete = notificacoes.some(
      (n) => n.usuarioId === emp.usuarioId && n.tipo === 'prazo_proximo' && n.mensagem.includes(prazo),
    );
    if (!jaTemLembrete) {
      notificacoes.unshift(
        novaNotificacao(
          emp.usuarioId,
          'prazo_proximo',
          `Lembrete: O prazo de devolução vence em breve (${prazo}).`,
          agoraIso,
          '/meus-emprestimos',
        ),
      );
    }
  });

  // 4. Encerrar suspensões vencidas (automáticas ou aplicadas pelo responsável)
  usuarios = usuarios.map((u) => {
    if (u.status !== 'suspensa' || !u.suspensoAte) return u;
    if (clockNow.getTime() < parseDate(u.suspensoAte).getTime()) return u;

    // Com outro item em atraso, a conta passa direto para bloqueada (políticas intermediária e rígida)
    const aindaAtrasado =
      politica !== 'simples' && emprestimos.some((e) => e.usuarioId === u.id && !e.devolvidoEm && e.diasAtraso > 0);
    notificacoes.unshift(
      novaNotificacao(
        u.id,
        'aprovacao',
        aindaAtrasado
          ? 'Seu período de suspensão encerrou, mas a conta segue bloqueada porque há um item em atraso.'
          : 'Seu período de suspensão encerrou. Sua conta foi reativada.',
        agoraIso,
        aindaAtrasado ? '/meus-emprestimos' : '/catalogo',
      ),
    );
    eventos.push(
      aindaAtrasado
        ? novoEvento('conta_bloqueada', agoraIso, u.id, {motivo: 'Fim da suspensão, mas com item em atraso'})
        : novoEvento('conta_reativada', agoraIso, u.id, {motivo: 'Fim do período de suspensão'}),
    );
    return {
      ...u,
      status: aindaAtrasado ? ('bloqueada' as const) : ('ativa' as const),
      suspensoAte: undefined,
      restricaoManual: undefined,
    };
  });

  if (eventos.length === 0) return {...s, itens, solicitacoes, emprestimos, usuarios, notificacoes};
  return {...s, itens, solicitacoes, emprestimos, usuarios, notificacoes, auditoria: [...eventos.reverse(), ...s.auditoria]};
}
