import {Emprestimo, Solicitacao} from '../../types/models';
import {ProtemState} from '../estado';

/**
 * Códigos de retirada e de devolução. Quem pediu o item recebe os dois e só os vê em
 * "Meus códigos": o responsável não os vê em nenhuma tela, só digita o que a pessoa mostrar.
 * Assim ninguém retira nem devolve no nome de outra pessoa.
 *
 * - Retirada: vale só enquanto o pedido está "aprovado": depois da retirada (concluída) ou da
 *   expiração no fim do dia (RN04), deixa de valer. Por isso é de uso único.
 * - Devolução: nasce na retirada e vale até o item ser devolvido. Se a pessoa não tiver o
 *   código, o responsável devolve sem ele, com motivo (fica na auditoria).
 * - Sem caracteres que se confundem ao ler em voz alta ou na tela (0/O, 1/I/L).
 */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_CODIGO = 6;

/** Aceita o código digitado com espaços, hífen ou em minúsculas. */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[\s-]/g, '');
}

/** Códigos que ainda podem ser usados: de pedidos aprovados e de empréstimos em aberto. */
export function codigosEmUso(s: ProtemState): Set<string> {
  const emUso = new Set<string>();
  for (const sol of s.solicitacoes) {
    if (sol.status === 'aprovada' && sol.codigoRetirada) emUso.add(sol.codigoRetirada);
  }
  for (const emp of s.emprestimos) {
    if (!emp.devolvidoEm && emp.codigoDevolucao) emUso.add(emp.codigoDevolucao);
  }
  return emUso;
}

/** Gera um código que não está em uso por outro pedido ou empréstimo. */
export function gerarCodigoRetirada(emUso: Set<string>, aleatorio: () => number = Math.random): string {
  for (;;) {
    let codigo = '';
    for (let i = 0; i < TAMANHO_CODIGO; i++) {
      codigo += ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)];
    }
    if (!emUso.has(codigo)) return codigo;
  }
}

/** O código digitado libera a retirada deste pedido? */
export function codigoConfere(solicitacao: Solicitacao, digitado: string): boolean {
  return (
    solicitacao.status === 'aprovada' &&
    !!solicitacao.codigoRetirada &&
    normalizarCodigo(digitado) === solicitacao.codigoRetirada
  );
}

/** O código digitado libera a devolução deste empréstimo? */
export function codigoDevolucaoConfere(emprestimo: Emprestimo, digitado: string): boolean {
  return (
    !emprestimo.devolvidoEm &&
    !!emprestimo.codigoDevolucao &&
    normalizarCodigo(digitado) === emprestimo.codigoDevolucao
  );
}

/**
 * Pedidos aprovados e empréstimos em aberto salvos antes de existirem os códigos recebem um,
 * para a retirada e a devolução não ficarem travadas. Devolve o mesmo estado se nada faltar.
 */
export function garantirCodigosDeRetirada(s: ProtemState): ProtemState {
  if (!s.solicitacoes.some((sol) => sol.status === 'aprovada' && !sol.codigoRetirada)) return s;
  const emUso = codigosEmUso(s);
  return {
    ...s,
    solicitacoes: s.solicitacoes.map((sol) => {
      if (sol.status !== 'aprovada' || sol.codigoRetirada) return sol;
      const codigoRetirada = gerarCodigoRetirada(emUso);
      emUso.add(codigoRetirada);
      return {...sol, codigoRetirada};
    }),
  };
}

export function garantirCodigosDeDevolucao(s: ProtemState): ProtemState {
  if (!s.emprestimos.some((emp) => !emp.devolvidoEm && !emp.codigoDevolucao)) return s;
  const emUso = codigosEmUso(s);
  return {
    ...s,
    emprestimos: s.emprestimos.map((emp) => {
      if (emp.devolvidoEm || emp.codigoDevolucao) return emp;
      const codigoDevolucao = gerarCodigoRetirada(emUso);
      emUso.add(codigoDevolucao);
      return {...emp, codigoDevolucao};
    }),
  };
}

/** Os dois ajustes juntos, usados ao carregar o estado. */
export function garantirCodigos(s: ProtemState): ProtemState {
  return garantirCodigosDeDevolucao(garantirCodigosDeRetirada(s));
}
