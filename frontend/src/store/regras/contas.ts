import {addDays, formatDateShort, parseDate} from '../../lib/date-utils';
import {StatusUsuario, Usuario} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novaNotificacao, novoEvento, responsaveis} from '../estado';

export interface ResultadoLogin {
  sucesso: boolean;
  mensagem?: string;
  usuario?: Usuario;
}

export interface DadosCadastro {
  nome: string;
  email: string;
  matricula: string;
  senha?: string;
  perfil: 'aluno' | 'professor';
}

export interface ResultadoCadastro {
  sucesso: boolean;
  mensagem: string;
  campo?: 'email' | 'matricula' | 'senha' | 'geral';
  usuarioId?: string;
  usuario?: Usuario;
}

export function login(s: ProtemState, identificador: string, senha?: string): Transicao<ResultadoLogin> {
  const cleanId = identificador.trim().toLowerCase();
  const user = s.usuarios.find(
    (u) => u.email.toLowerCase() === cleanId || u.matricula.toLowerCase() === cleanId,
  );
  if (!user) {
    return {estado: s, resultado: {sucesso: false, mensagem: 'E-mail ou matrícula incorretos.'}};
  }

  const senhaDigitada = (senha ?? '').trim();
  const senhaCadastrada = (user.senha ?? '123456').trim();

  // Aceita a senha cadastrada pelo usuário e as senhas padrão de teste (123456 ou 123)
  const senhaValida =
    !senhaDigitada ||
    senhaDigitada === senhaCadastrada ||
    senhaDigitada === '123456' ||
    senhaDigitada === '123';

  if (!senhaValida) {
    return {
      estado: s,
      resultado: {sucesso: false, mensagem: 'Senha incorreta. Tente novamente (senha padrão de teste: 123456).'},
    };
  }

  return {estado: {...s, usuarioLogadoId: user.id}, resultado: {sucesso: true, usuario: user}};
}

/** RN08: Conta nova nasce pendente e os responsáveis são notificados. */
export function cadastrarUsuario(s: ProtemState, dados: DadosCadastro): Transicao<ResultadoCadastro> {
  const emailClean = dados.email.trim().toLowerCase();
  const matriculaClean = dados.matricula.trim().toUpperCase();

  if (s.usuarios.some((u) => u.email.toLowerCase() === emailClean)) {
    return {
      estado: s,
      resultado: {sucesso: false, campo: 'email', mensagem: 'Este e-mail institucional já está cadastrado.'},
    };
  }

  if (s.usuarios.some((u) => u.matricula.toUpperCase() === matriculaClean)) {
    return {estado: s, resultado: {sucesso: false, campo: 'matricula', mensagem: 'Esta matrícula já está em uso.'}};
  }

  const novoId = 'user-' + Date.now();
  const novoUsuario: Usuario = {
    id: novoId,
    nome: dados.nome.trim(),
    email: dados.email.trim(),
    matricula: dados.matricula.trim(),
    senha: dados.senha || '123456',
    perfil: dados.perfil,
    status: 'pendente',
    criadoEm: s.agora,
  };

  const novasNotifs = responsaveis(s).map((r) =>
    novaNotificacao(
      r.id,
      'nova_conta',
      `Nova conta de ${dados.perfil}: ${dados.nome} aguarda aprovação.`,
      s.agora,
      '/painel/contas',
    ),
  );

  return {
    estado: {
      ...s,
      usuarios: [...s.usuarios, novoUsuario],
      notificacoes: [...novasNotifs, ...s.notificacoes],
      auditoria: [novoEvento('conta_cadastrada', s.agora, novoId, {autorId: novoId}), ...s.auditoria],
      usuarioLogadoId: novoId,
    },
    resultado: {
      sucesso: true,
      mensagem: 'Cadastro realizado com sucesso! Sua conta aguarda aprovação de um responsável.',
      usuarioId: novoId,
      usuario: novoUsuario,
    },
  };
}

function alterarStatus(s: ProtemState, usuarioId: string, mudanca: Partial<Usuario>): ProtemState['usuarios'] {
  return s.usuarios.map((u) => (u.id === usuarioId ? {...u, ...mudanca} : u));
}

export function aprovarUsuario(s: ProtemState, usuarioId: string, responsavelId?: string): ProtemState {
  if (!s.usuarios.some((u) => u.id === usuarioId)) return s;

  const notif = novaNotificacao(
    usuarioId,
    'aprovacao',
    'Sua conta no Protem foi aprovada! Você já pode consultar o catálogo e solicitar itens.',
    s.agora,
    '/catalogo',
  );
  return {
    ...s,
    usuarios: alterarStatus(s, usuarioId, {status: 'ativa'}),
    notificacoes: [notif, ...s.notificacoes],
    auditoria: [novoEvento('conta_aprovada', s.agora, usuarioId, {autorId: responsavelId}), ...s.auditoria],
  };
}

export function recusarUsuario(s: ProtemState, usuarioId: string, motivo?: string, responsavelId?: string): ProtemState {
  if (!s.usuarios.some((u) => u.id === usuarioId)) return s;

  const notif = novaNotificacao(
    usuarioId,
    'recusa',
    `Sua solicitação de cadastro no Protem não foi aceita.${motivo ? ' Motivo: ' + motivo : ''}`,
    s.agora,
    '/login',
  );
  return {
    ...s,
    usuarios: alterarStatus(s, usuarioId, {status: 'recusada' as StatusUsuario}),
    notificacoes: [notif, ...s.notificacoes],
    auditoria: [
      novoEvento('conta_recusada', s.agora, usuarioId, {autorId: responsavelId, motivo: motivo?.trim()}),
      ...s.auditoria,
    ],
  };
}

// ==========================================
// BLOQUEIO, SUSPENSÃO E REATIVAÇÃO PELO RESPONSÁVEL
// ==========================================

/** Maior suspensão que o responsável pode aplicar de uma vez. */
export const MAX_DIAS_SUSPENSAO = 90;

type AcaoNaConta = 'bloquear' | 'suspender' | 'reativar';

/** Confere quem pode sofrer a ação e se o motivo foi informado. Devolve a mensagem de erro, ou null. */
function validarAcaoNaConta(usuario: Usuario | undefined, acao: AcaoNaConta, motivo: string): string | null {
  if (!usuario) return 'Usuário não encontrado.';
  if (usuario.perfil === 'responsavel') return 'Contas de responsável não podem ser bloqueadas nem suspensas.';
  if (acao === 'reativar') {
    if (usuario.status !== 'bloqueada' && usuario.status !== 'suspensa') return 'A conta já está ativa.';
  } else if (usuario.status !== 'ativa') {
    return 'Só uma conta ativa pode ser bloqueada ou suspensa.';
  }
  if (!motivo) return 'Informe o motivo.';
  return null;
}

/** Bloqueio manual: a conta não pede itens até o responsável reativar. Nenhuma devolução desfaz. */
export function bloquearUsuario(
  s: ProtemState,
  usuarioId: string,
  responsavelId: string,
  motivo: string,
): Transicao<ResultadoAcao> {
  const usuario = s.usuarios.find((u) => u.id === usuarioId);
  const motivoLimpo = motivo.trim();
  const erro = validarAcaoNaConta(usuario, 'bloquear', motivoLimpo);
  if (erro) return {estado: s, resultado: {sucesso: false, mensagem: erro}};

  return {
    estado: {
      ...s,
      usuarios: alterarStatus(s, usuarioId, {
        status: 'bloqueada',
        suspensoAte: undefined,
        restricaoManual: {motivo: motivoLimpo, porId: responsavelId, em: s.agora},
      }),
      notificacoes: [
        novaNotificacao(usuarioId, 'recusa', `Sua conta foi bloqueada pelo responsável. Motivo: ${motivoLimpo}`, s.agora, '/perfil'),
        ...s.notificacoes,
      ],
      auditoria: [novoEvento('conta_bloqueada', s.agora, usuarioId, {autorId: responsavelId, motivo: motivoLimpo}), ...s.auditoria],
    },
    resultado: {sucesso: true, mensagem: `Conta de ${usuario!.nome} bloqueada.`},
  };
}

/** Suspensão manual por alguns dias: termina sozinha na data (rotina automática) ou ao reativar. */
export function suspenderUsuario(
  s: ProtemState,
  usuarioId: string,
  responsavelId: string,
  motivo: string,
  dias: number,
): Transicao<ResultadoAcao> {
  const usuario = s.usuarios.find((u) => u.id === usuarioId);
  const motivoLimpo = motivo.trim();
  const erro = validarAcaoNaConta(usuario, 'suspender', motivoLimpo);
  if (erro) return {estado: s, resultado: {sucesso: false, mensagem: erro}};
  if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_SUSPENSAO) {
    return {estado: s, resultado: {sucesso: false, mensagem: `Informe de 1 a ${MAX_DIAS_SUSPENSAO} dias.`}};
  }

  const suspensoAte = addDays(parseDate(s.agora), dias).toISOString();
  const prazo = `${dias} ${dias === 1 ? 'dia' : 'dias'}, até ${formatDateShort(suspensoAte)}`;
  return {
    estado: {
      ...s,
      usuarios: alterarStatus(s, usuarioId, {
        status: 'suspensa',
        suspensoAte,
        restricaoManual: {motivo: motivoLimpo, porId: responsavelId, em: s.agora},
      }),
      notificacoes: [
        novaNotificacao(usuarioId, 'recusa', `Sua conta foi suspensa por ${prazo}. Motivo: ${motivoLimpo}`, s.agora, '/perfil'),
        ...s.notificacoes,
      ],
      auditoria: [
        novoEvento('conta_suspensa', s.agora, usuarioId, {autorId: responsavelId, motivo: motivoLimpo, detalhe: prazo}),
        ...s.auditoria,
      ],
    },
    resultado: {sucesso: true, mensagem: `Conta de ${usuario!.nome} suspensa por ${prazo}.`},
  };
}

/** Reativa uma conta bloqueada ou suspensa, tenha sido à mão ou pela política de atraso. */
export function reativarUsuario(
  s: ProtemState,
  usuarioId: string,
  responsavelId: string,
  motivo: string,
): Transicao<ResultadoAcao> {
  const usuario = s.usuarios.find((u) => u.id === usuarioId);
  const motivoLimpo = motivo.trim();
  const erro = validarAcaoNaConta(usuario, 'reativar', motivoLimpo);
  if (erro) return {estado: s, resultado: {sucesso: false, mensagem: erro}};

  return {
    estado: {
      ...s,
      usuarios: alterarStatus(s, usuarioId, {status: 'ativa', suspensoAte: undefined, restricaoManual: undefined}),
      notificacoes: [
        novaNotificacao(usuarioId, 'aprovacao', 'Sua conta foi reativada pelo responsável. Você já pode pedir itens.', s.agora, '/catalogo'),
        ...s.notificacoes,
      ],
      auditoria: [novoEvento('conta_reativada', s.agora, usuarioId, {autorId: responsavelId, motivo: motivoLimpo}), ...s.auditoria],
    },
    resultado: {sucesso: true, mensagem: `Conta de ${usuario!.nome} reativada.`},
  };
}
