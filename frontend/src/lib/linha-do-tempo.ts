import {Emprestimo, Solicitacao} from '../types/models';
import {formatDateShort} from './date-utils';

/**
 * As quatro etapas de um pedido: Pedido → Aprovação → Retirada → Devolução, cada uma com a
 * data e o estado (feita, a etapa de agora, ainda não chegou, ou não aconteceu).
 * Função pura: a tela só desenha o que sai daqui.
 */
export type EstadoEtapa = 'feito' | 'atual' | 'pendente' | 'falhou';

export interface EtapaDoPedido {
  chave: 'pedido' | 'aprovacao' | 'retirada' | 'devolucao';
  rotulo: string;
  estado: EstadoEtapa;
  /** Texto curto embaixo do nome: a data ou o que fazer. */
  detalhe: string;
  /** Etapa de agora que pede atenção (devolução atrasada). */
  alerta?: boolean;
}

const dia = (iso?: string) => (iso ? formatDateShort(iso) : '');

export function etapasDoPedido(solicitacao: Solicitacao, emprestimo?: Emprestimo): EtapaDoPedido[] {
  const {status} = solicitacao;
  const pedido: EtapaDoPedido = {chave: 'pedido', rotulo: 'Pedido', estado: 'feito', detalhe: dia(solicitacao.criadoEm)};

  // Aprovação
  let aprovacao: EtapaDoPedido;
  if (status === 'pendente') {
    aprovacao = {chave: 'aprovacao', rotulo: 'Aprovação', estado: 'atual', detalhe: 'Em análise'};
  } else if (status === 'recusada') {
    aprovacao = {chave: 'aprovacao', rotulo: 'Aprovação', estado: 'falhou', detalhe: `Recusado em ${dia(solicitacao.avaliadoEm)}`.trim()};
  } else {
    aprovacao = {chave: 'aprovacao', rotulo: 'Aprovação', estado: 'feito', detalhe: dia(solicitacao.avaliadoEm ?? solicitacao.criadoEm)};
  }

  // Retirada
  let retirada: EtapaDoPedido;
  if (emprestimo) {
    retirada = {chave: 'retirada', rotulo: 'Retirada', estado: 'feito', detalhe: dia(emprestimo.retiradoEm)};
  } else if (status === 'aprovada') {
    retirada = {chave: 'retirada', rotulo: 'Retirada', estado: 'atual', detalhe: 'Retire hoje'};
  } else if (status === 'expirada') {
    retirada = {chave: 'retirada', rotulo: 'Retirada', estado: 'falhou', detalhe: 'Não retirado no dia'};
  } else if (status === 'concluida') {
    retirada = {chave: 'retirada', rotulo: 'Retirada', estado: 'feito', detalhe: ''};
  } else {
    retirada = {chave: 'retirada', rotulo: 'Retirada', estado: 'pendente', detalhe: 'No dia da aprovação'};
  }

  // Devolução
  let devolucao: EtapaDoPedido;
  if (emprestimo?.devolvidoEm) {
    const atraso = emprestimo.diasAtraso > 0 ? ` (${emprestimo.diasAtraso} ${emprestimo.diasAtraso === 1 ? 'dia' : 'dias'} de atraso)` : '';
    devolucao = {chave: 'devolucao', rotulo: 'Devolução', estado: 'feito', detalhe: `${dia(emprestimo.devolvidoEm)}${atraso}`};
  } else if (emprestimo) {
    const atrasado = emprestimo.diasAtraso > 0;
    devolucao = {
      chave: 'devolucao',
      rotulo: 'Devolução',
      estado: 'atual',
      detalhe: atrasado ? `Venceu em ${dia(emprestimo.devolucaoPrevista)}` : `Até ${dia(emprestimo.devolucaoPrevista)}`,
      alerta: atrasado,
    };
  } else {
    devolucao = {chave: 'devolucao', rotulo: 'Devolução', estado: 'pendente', detalhe: `Prazo até ${dia(solicitacao.devolucaoDesejada)}`};
  }

  return [pedido, aprovacao, retirada, devolucao];
}
