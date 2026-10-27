import {Categoria, Emprestimo, Item, Solicitacao, Usuario} from '../../types/models';
import {ProtemState} from '../estado';

/**
 * Estado mínimo e previsível para os testes das regras: relógio em 15/10/2026 às 10:00
 * (horário local), um responsável, uma aluna ativa e duas categorias com itens disponíveis.
 */
export const AGORA = new Date(2026, 9, 15, 10, 0, 0);

export function usuario(id: string, mudanca: Partial<Usuario> = {}): Usuario {
  return {
    id,
    nome: id,
    email: `${id}@escola.edu.br`,
    matricula: id.toUpperCase(),
    senha: '123456',
    perfil: 'aluno',
    status: 'ativa',
    criadoEm: AGORA.toISOString(),
    ...mudanca,
  };
}

export function item(id: string, categoriaId: string, mudanca: Partial<Item> = {}): Item {
  return {
    id,
    categoriaId,
    nome: `Item ${id}`,
    descricao: '',
    patrimonio: `PAT-${id}`,
    codigoQr: `QR-${id}`,
    status: 'disponivel',
    ...mudanca,
  };
}

export function estadoDeTeste(mudanca: Partial<ProtemState> = {}): ProtemState {
  const categorias: Categoria[] = [
    {id: 'cat-a', nome: 'Notebooks', prazoMaxDias: 2, limitePorPessoa: 1},
    {id: 'cat-b', nome: 'Kits', prazoMaxDias: 7, limitePorPessoa: 2},
  ];
  return {
    agora: AGORA.toISOString(),
    usuarioLogadoId: null,
    configuracao: {politicaAtraso: 'rigida'},
    usuarios: [usuario('resp', {perfil: 'responsavel'}), usuario('aluna')],
    categorias,
    itens: [item('a1', 'cat-a'), item('a2', 'cat-a'), item('b1', 'cat-b'), item('b2', 'cat-b'), item('b3', 'cat-b')],
    solicitacoes: [],
    emprestimos: [],
    ocorrencias: [],
    notificacoes: [],
    auditoria: [],
    ...mudanca,
  };
}

export function solicitacao(id: string, itemId: string, mudanca: Partial<Solicitacao> = {}): Solicitacao {
  return {
    id,
    solicitanteId: 'aluna',
    itemId,
    devolucaoDesejada: '2026-10-16',
    status: 'pendente',
    criadoEm: AGORA.toISOString(),
    ...mudanca,
  };
}

export function emprestimo(id: string, itemId: string, mudanca: Partial<Emprestimo> = {}): Emprestimo {
  return {
    id,
    solicitacaoId: `solic-${id}`,
    itemId,
    usuarioId: 'aluna',
    registradoPor: 'resp',
    retiradoEm: AGORA.toISOString(),
    devolucaoPrevista: '2026-10-16',
    diasAtraso: 0,
    ...mudanca,
  };
}

/** Data local no formato ISO, para mover o relógio nos testes. */
export function em(ano: number, mes: number, dia: number, hora = 0, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

export const buscar = {
  item: (s: ProtemState, id: string) => s.itens.find((i) => i.id === id)!,
  usuario: (s: ProtemState, id: string) => s.usuarios.find((u) => u.id === id)!,
  solicitacao: (s: ProtemState, id: string) => s.solicitacoes.find((x) => x.id === id)!,
  emprestimo: (s: ProtemState, id: string) => s.emprestimos.find((e) => e.id === id)!,
};
