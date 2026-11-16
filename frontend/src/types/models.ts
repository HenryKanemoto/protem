export type PerfilUsuario = 'aluno' | 'professor' | 'responsavel';
export type StatusUsuario = 'pendente' | 'ativa' | 'bloqueada' | 'suspensa' | 'recusada';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  senha?: string;
  perfil: PerfilUsuario;
  status: StatusUsuario;
  suspensoAte?: string; // ISO date string
  criadoEm: string;    // ISO date string
  /** Presente quando o bloqueio ou a suspensão foram aplicados à mão pelo responsável. */
  restricaoManual?: RestricaoManual;
  // Dados pessoais (só as personas de demonstração têm; todos inventados)
  cpf?: string;
  telefone?: string;
  curso?: string;
}

/**
 * Bloqueio ou suspensão aplicados pelo responsável. O sistema não desfaz sozinho:
 * o bloqueio fica até a reativação; a suspensão termina na data de suspensoAte.
 */
export interface RestricaoManual {
  motivo: string;
  porId: string;
  em: string; // ISO date string
}

export interface Categoria {
  id: string;
  nome: string;
  prazoMaxDias: number;
  limitePorPessoa: number;
  descricao?: string;
}

export type StatusItem =
  | 'disponivel'
  | 'solicitado'
  | 'reservado'
  | 'emprestado'
  | 'atrasado'
  | 'manutencao'
  /** Saiu do acervo: foi enviado a um destino (CRC, SENAI Lab...). Não volta ao catálogo. */
  | 'encaminhado';

export interface Item {
  id: string;
  categoriaId: string;
  nome: string;
  descricao: string;
  patrimonio: string;
  codigoQr: string;
  foto?: string;
  status: StatusItem;
  /** Presente quando o item foi encaminhado (status "encaminhado"). */
  encaminhamento?: Encaminhamento;
}

/** Tipo de destino de um item que não tem mais conserto no acervo. */
export type TipoDestino = 'doacao' | 'recondicionamento' | 'aprendizado';

export interface DestinoEncaminhamento {
  id: string;
  nome: string;
  tipo: TipoDestino;
  descricao: string;
}

/** Para onde o item foi, quando e por quê. O nome do destino fica gravado: ele pode ser editado depois. */
export interface Encaminhamento {
  destinoId: string;
  destinoNome: string;
  tipo: TipoDestino;
  em: string; // ISO date string
  porId: string;
  motivo: string;
}

export type StatusSolicitacao =
  | 'pendente'
  | 'aprovada'
  | 'recusada'
  | 'expirada'
  | 'concluida';

export interface Solicitacao {
  id: string;
  solicitanteId: string;
  itemId: string;
  avaliadoPor?: string;
  devolucaoDesejada: string; // ISO date string YYYY-MM-DD
  status: StatusSolicitacao;
  criadoEm: string;          // ISO date string
  avaliadoEm?: string;       // ISO date string
  lembreteEnviadoEm?: string; // ISO date string
  codigoRetirada?:string;
  motivoRecusa?: string;
}

export interface Emprestimo {
  id: string;
  solicitacaoId: string;
  itemId: string;
  usuarioId: string;
  registradoPor: string;
  retiradoEm: string;        // ISO date string
  devolucaoPrevista: string; // ISO date string YYYY-MM-DD
  devolvidoEm?: string;      // ISO date string
  diasAtraso: number;
  /** Código que quem retirou mostra ao responsável na devolução. Vale até o item voltar. */
  codigoDevolucao?: string;
  /** Preenchido quando o responsável devolveu sem o código (o motivo fica aqui e na auditoria). */
  devolvidoSemCodigoMotivo?: string;
}

export type StatusOcorrencia = 'aberta' | 'resolvida';

/** Quanto o item ficou danificado, escolhido pelo responsável na devolução com avaria. */
export type CategoriaAvaria = 'estetica' | 'funcional_leve' | 'incompleto' | 'quebrado';

/** Como a ocorrência terminou: o item foi consertado ou encaminhado a um destino. */
export type DesfechoOcorrencia = 'consertado' | 'encaminhado';

export interface Ocorrencia {
  id: string;
  emprestimoId?: string;
  itemId: string;
  usuarioId: string;
  descricao: string;
  /** Ocorrências antigas, de antes das categorias, não têm. */
  categoria?: CategoriaAvaria;
  status: StatusOcorrencia;
  criadoEm: string;          // ISO date string
  resolvidoEm?: string;      // ISO date string
  desfecho?: DesfechoOcorrencia;
}

export type TipoNotificacao =
  | 'aprovacao'
  | 'recusa'
  | 'expiracao'
  | 'prazo_proximo'
  | 'atraso'
  | 'lembrete'
  | 'novo_pedido'
  | 'nova_conta';

export interface Notificacao {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacao;
  mensagem: string;
  lida: boolean;
  criadoEm: string; // ISO date string
  destino: string;  // Route path e.g. /meus-emprestimos or /painel/solicitacoes
}

export type TipoEventoAuditoria =
  | 'conta_cadastrada'
  | 'conta_aprovada'
  | 'conta_recusada'
  | 'conta_bloqueada'
  | 'conta_suspensa'
  | 'conta_reativada'
  | 'pedido_criado'
  | 'pedido_aprovado'
  | 'pedido_recusado'
  | 'pedido_expirado'
  | 'retirada'
  | 'devolucao'
  | 'devolucao_avaria'
  | 'item_consertado'
  | 'item_encaminhado';

/** Registro de quem fez o quê, com quem e por quê. Gravado pelas próprias regras. */
export interface EventoAuditoria {
  id: string;
  tipo: TipoEventoAuditoria;
  em: string;         // ISO date string
  autorId?: string;   // ausente = feito pelo sistema (rotina automática ou política de atraso)
  afetadoId: string;  // pessoa afetada
  itemId?: string;
  motivo?: string;
  detalhe?: string;
}

export type PoliticaAtraso = 'simples' | 'intermediaria' | 'rigida';

export interface Configuracao {
  politicaAtraso: PoliticaAtraso;
  /** Para onde o responsável pode encaminhar item sem conserto. Sem a lista, vale a padrão. */
  destinosEncaminhamento?: DestinoEncaminhamento[];
}
