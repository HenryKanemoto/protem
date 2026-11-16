import {Emprestimo, Item, Solicitacao} from '../types/models';
import {addDays, isSameDay, parseDate} from './date-utils';

/**
 * Números do painel do responsável. Funções puras sobre os dados do app, usando o relógio
 * (simulado ou não) que a tela passa: a tela só exibe.
 */

/** Devoluções que vencem hoje: emprestados ainda no prazo cujo último dia é hoje. */
export function devolucoesDeHoje(emprestimos: Emprestimo[], agora: Date): Emprestimo[] {
  return emprestimos.filter((e) => !e.devolvidoEm && e.diasAtraso === 0 && isSameDay(parseDate(e.devolucaoPrevista), agora));
}

/** Emprestados no prazo e que não vencem hoje, da devolução mais próxima para a mais distante. */
export function emprestadosNoPrazo(emprestimos: Emprestimo[], agora: Date): Emprestimo[] {
  const hoje = devolucoesDeHoje(emprestimos, agora).map((e) => e.id);
  return emprestimos
    .filter((e) => !e.devolvidoEm && e.diasAtraso === 0 && !hoje.includes(e.id))
    .sort((a, b) => a.devolucaoPrevista.localeCompare(b.devolucaoPrevista));
}

/** Atrasados, do maior atraso para o menor. */
export function atrasados(emprestimos: Emprestimo[]): Emprestimo[] {
  return emprestimos.filter((e) => !e.devolvidoEm && e.diasAtraso > 0).sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export interface PendenciasDePedidos {
  /** Pedidos esperando análise mais pedidos aprovados esperando retirada. */
  emprestimos: number;
  /** Devoluções atrasadas mais as que vencem hoje. */
  devolucoes: number;
  total: number;
}

/**
 * O que está esperando o responsável na tela Pedidos. É o número das duas abas e do selo do menu,
 * então os três sempre batem. Empréstimos que ainda estão no prazo não contam: não pedem ação hoje.
 */
export function pendenciasDePedidos(solicitacoes: Solicitacao[], emprestimos: Emprestimo[], agora: Date): PendenciasDePedidos {
  const pedidos = solicitacoes.filter((s) => s.status === 'pendente' || s.status === 'aprovada').length;
  const devolucoes = atrasados(emprestimos).length + devolucoesDeHoje(emprestimos, agora).length;
  return {emprestimos: pedidos, devolucoes, total: pedidos + devolucoes};
}

export interface UsoDoAcervo {
  emUso: number;
  total: number;
  /** 0 a 100; 0 quando o acervo está vazio. */
  percentual: number;
}

/** Quantos itens do acervo estão com alguém (emprestados ou atrasados). Itens encaminhados já saíram do acervo. */
export function usoDoAcervo(itens: Item[]): UsoDoAcervo {
  const doAcervo = itens.filter((i) => i.status !== 'encaminhado');
  const emUso = doAcervo.filter((i) => i.status === 'emprestado' || i.status === 'atrasado').length;
  return {emUso, total: doAcervo.length, percentual: doAcervo.length ? Math.round((emUso / doAcervo.length) * 100) : 0};
}

export interface TaxaDeAtraso {
  /** Empréstimos retirados na janela. */
  total: number;
  /** Desses, quantos passaram do prazo (devolvidos com atraso ou ainda atrasados). */
  atrasados: number;
  /** 0 a 100; null quando não houve empréstimo na janela (não dá para calcular). */
  percentual: number | null;
}

/** Empréstimos dos últimos `dias` dias que passaram do prazo. */
export function taxaDeAtraso(emprestimos: Emprestimo[], agora: Date, dias = 30): TaxaDeAtraso {
  const desde = addDays(agora, -dias).getTime();
  const naJanela = emprestimos.filter((e) => parseDate(e.retiradoEm).getTime() >= desde);
  const atrasadosNaJanela = naJanela.filter((e) => e.diasAtraso > 0).length;
  return {
    total: naJanela.length,
    atrasados: atrasadosNaJanela,
    percentual: naJanela.length ? Math.round((atrasadosNaJanela / naJanela.length) * 100) : null,
  };
}

export interface ItemMaisPedido {
  nome: string;
  pedidos: number;
}

/** "Kit Arduino Iniciante #2" e "#3" são o mesmo tipo de item: agrupa pelo nome sem o número. */
export function nomeBase(nome: string): string {
  return nome.replace(/\s*#\d+\s*$/, '').trim();
}

/**
 * Tipos de item mais pedidos nos últimos `dias` dias (pedidos recusados também contam: foram
 * pedidos). Empate: ordem alfabética, para o resultado não mudar de um carregamento para outro.
 */
export function maisPedidos(solicitacoes: Solicitacao[], itens: Item[], agora: Date, dias = 30, limite = 5): ItemMaisPedido[] {
  const desde = addDays(agora, -dias).getTime();
  const contagem = new Map<string, number>();
  for (const s of solicitacoes) {
    if (parseDate(s.criadoEm).getTime() < desde) continue;
    const item = itens.find((i) => i.id === s.itemId);
    if (!item) continue;
    const nome = nomeBase(item.nome);
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([nome, pedidos]) => ({nome, pedidos}))
    .sort((a, b) => b.pedidos - a.pedidos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
}
