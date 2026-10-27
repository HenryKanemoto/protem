import {Emprestimo, Item, Ocorrencia, Solicitacao, Usuario} from '../types/models';
import {formatDateShort} from './date-utils';

/** Situação final de um pedido no histórico; também é a chave de cor do StatusBadge. */
export type SituacaoHistorico =
  | 'pendente'
  | 'aguardando_retirada'
  | 'recusado'
  | 'expirado'
  | 'emprestado'
  | 'atrasado'
  | 'devolvido'
  | 'devolvido_atraso'
  | 'devolvido_avaria';

/** Agrupamento usado no filtro do histórico. */
export type GrupoHistorico = 'andamento' | 'devolvidos' | 'nao_retirados' | 'atraso' | 'avaria';

export interface EtapaHistorico {
  rotulo: string;
  data: string; // ISO
  observacao?: string;
}

/** Um pedido e tudo o que aconteceu com ele, do pedido até a devolução. */
export interface LinhaHistorico {
  id: string;
  pessoaId: string;
  pessoa: string;
  item: string;
  patrimonio: string;
  itemId: string;
  data: string; // data do pedido (ou da retirada, se não houver pedido)
  etapas: EtapaHistorico[];
  situacao: SituacaoHistorico;
  grupos: GrupoHistorico[];
}

interface Dados {
  usuarios: Usuario[];
  itens: Item[];
  solicitacoes: Solicitacao[];
  emprestimos: Emprestimo[];
  ocorrencias: Ocorrencia[];
}

const plural = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Monta o histórico a partir dos registros guardados, do pedido mais recente para o mais antigo. */
export function montarHistorico(d: Dados): LinhaHistorico[] {
  const usuario = (id: string) => d.usuarios.find((u) => u.id === id);
  const itemPorId = (id: string) => d.itens.find((i) => i.id === id);
  const emprestimoDoPedido = new Map(d.emprestimos.map((e) => [e.solicitacaoId, e]));

  const linha = (id: string, pessoaId: string, itemId: string, data: string, sol?: Solicitacao, emp?: Emprestimo) => {
    const item = itemPorId(itemId);
    const etapas: EtapaHistorico[] = [];
    let situacao: SituacaoHistorico = 'pendente';
    const grupos: GrupoHistorico[] = [];

    if (sol) {
      etapas.push({rotulo: 'Pedido', data: sol.criadoEm, observacao: `devolver até ${formatDateShort(sol.devolucaoDesejada)}`});
      if (sol.status === 'recusada') {
        etapas.push({rotulo: 'Recusado', data: sol.avaliadoEm ?? sol.criadoEm, observacao: sol.motivoRecusa});
        situacao = 'recusado';
      } else if (sol.avaliadoEm) {
        etapas.push({rotulo: 'Aprovado', data: sol.avaliadoEm});
        situacao = 'aguardando_retirada';
      }
      if (sol.status === 'expirada') {
        etapas.push({rotulo: 'Expirado', data: sol.avaliadoEm ?? sol.criadoEm, observacao: 'não foi retirado no dia'});
        situacao = 'expirado';
      }
    }

    if (emp) {
      etapas.push({rotulo: 'Retirado', data: emp.retiradoEm, observacao: `devolução prevista ${formatDateShort(emp.devolucaoPrevista)}`});
      const avaria = d.ocorrencias.find((o) => o.emprestimoId === emp.id);
      if (emp.devolvidoEm) {
        const atraso = emp.diasAtraso > 0 ? `${plural(emp.diasAtraso)} de atraso` : 'no prazo';
        etapas.push({
          rotulo: avaria ? 'Devolvido com avaria' : 'Devolvido',
          data: emp.devolvidoEm,
          observacao: avaria ? `${atraso}; ${avaria.descricao}` : atraso,
        });
        situacao = avaria ? 'devolvido_avaria' : emp.diasAtraso > 0 ? 'devolvido_atraso' : 'devolvido';
      } else {
        situacao = emp.diasAtraso > 0 ? 'atrasado' : 'emprestado';
      }
      if (emp.diasAtraso > 0) grupos.push('atraso');
      if (avaria) grupos.push('avaria');
    }

    if (situacao === 'pendente' || situacao === 'aguardando_retirada' || situacao === 'emprestado' || situacao === 'atrasado') {
      grupos.push('andamento');
    } else if (situacao === 'recusado' || situacao === 'expirado') {
      grupos.push('nao_retirados');
    } else {
      grupos.push('devolvidos');
    }

    return {
      id,
      pessoaId,
      pessoa: usuario(pessoaId)?.nome ?? 'Pessoa não identificada',
      item: item?.nome ?? 'Item removido',
      patrimonio: item?.patrimonio ?? '',
      itemId,
      data,
      etapas,
      situacao,
      grupos,
    };
  };

  const linhas = d.solicitacoes.map((sol) =>
    linha(sol.id, sol.solicitanteId, sol.itemId, sol.criadoEm, sol, emprestimoDoPedido.get(sol.id)),
  );
  // Empréstimos sem o pedido correspondente (dados antigos) ainda aparecem
  const pedidos = new Set(d.solicitacoes.map((s) => s.id));
  for (const emp of d.emprestimos) {
    if (!pedidos.has(emp.solicitacaoId)) linhas.push(linha(emp.id, emp.usuarioId, emp.itemId, emp.retiradoEm, undefined, emp));
  }
  return linhas.sort((a, b) => b.data.localeCompare(a.data));
}
