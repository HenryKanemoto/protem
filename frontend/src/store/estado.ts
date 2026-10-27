import {
  Categoria,
  Configuracao,
  Emprestimo,
  EventoAuditoria,
  Item,
  Notificacao,
  Ocorrencia,
  Solicitacao,
  TipoNotificacao,
  Usuario,
} from '../types/models';

export interface ProtemState {
  agora: string; // ISO date string do relógio simulado
  usuarioLogadoId: string | null;
  configuracao: Configuracao;
  usuarios: Usuario[];
  categorias: Categoria[];
  itens: Item[];
  solicitacoes: Solicitacao[];
  emprestimos: Emprestimo[];
  ocorrencias: Ocorrencia[];
  notificacoes: Notificacao[];
  /** Mais recente primeiro. */
  auditoria: EventoAuditoria[];
}

/** Resultado de uma regra de negócio: o novo estado e o que deve voltar para a tela. */
export interface Transicao<R> {
  estado: ProtemState;
  resultado: R;
}

export interface ResultadoAcao {
  sucesso: boolean;
  mensagem: string;
}

export function novaNotificacao(
  usuarioId: string,
  tipo: TipoNotificacao,
  mensagem: string,
  criadoEm: string,
  destino: string,
): Notificacao {
  return {
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    usuarioId,
    tipo,
    mensagem,
    lida: false,
    criadoEm,
    destino,
  };
}

/** Evento de auditoria. Sem autorId, o evento aparece como feito pelo sistema. */
export function novoEvento(
  tipo: EventoAuditoria['tipo'],
  em: string,
  afetadoId: string,
  extra: Partial<Pick<EventoAuditoria, 'autorId' | 'itemId' | 'motivo' | 'detalhe'>> = {},
): EventoAuditoria {
  return {
    id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    tipo,
    em,
    afetadoId,
    // Só os campos preenchidos, para o estado salvo não acumular "undefined"
    ...Object.fromEntries(Object.entries(extra).filter(([, valor]) => valor)),
  };
}

export function responsaveis(s: ProtemState): Usuario[] {
  return s.usuarios.filter((u) => u.perfil === 'responsavel');
}
