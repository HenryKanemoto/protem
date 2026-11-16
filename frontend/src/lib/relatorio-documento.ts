import {CATEGORIAS_AVARIA, rotuloCategoriaAvaria} from '../store/regras/avaria';
import {EventoAuditoria, Item, Ocorrencia, Usuario} from '../types/models';
import {GRUPOS_EVENTO, TIPOS_EVENTO} from './auditoria-utils';
import {formatDateShort, formatDateTime} from './date-utils';
import {GrupoHistorico, LinhaHistorico, ROTULOS_SITUACAO} from './historico';

/**
 * O que vai para o PDF de um relatório, já em texto. As telas montam o documento com os
 * mesmos filtros que estão na tela; lib/pdf.ts só desenha. Assim o conteúdo dá para testar
 * sem gerar PDF.
 */
export interface DocumentoRelatorio {
  titulo: string;
  /** Uma frase sobre para que serve o relatório. */
  descricao: string;
  /** Filtros usados, para quem lê o papel saber o que está (e o que não está) ali. */
  filtros: [string, string][];
  resumo: [string, string][];
  colunas: string[];
  linhas: string[][];
  /** Data e hora de geração (relógio do app) e quem gerou. */
  geradoEm: string;
  geradoPor: string;
  /** Nome sugerido para o arquivo, sem pasta. */
  arquivo: string;
}

export interface Contexto {
  /** Relógio do app (o da demonstração, se estiver simulado). */
  agora: Date;
  geradoPor: string;
}

/** Nome de arquivo seguro: sem acento e com a data, ex.: protem-historico-2026-11-15.pdf. */
export function nomeDoArquivo(tipo: string, agora: Date): string {
  const dia = [agora.getFullYear(), String(agora.getMonth() + 1).padStart(2, '0'), String(agora.getDate()).padStart(2, '0')].join('-');
  const base = tipo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `protem-${base}-${dia}.pdf`;
}

/**
 * As fontes padrão do PDF não têm todos os símbolos (setas, reticências em um caractere,
 * aspas curvas...). Troca por equivalentes simples, para nada sair como quadrado ou lixo.
 */
export function textoPdf(texto: string): string {
  const simples = texto
    .replace(/[→⇒]/g, '>')
    .replace(/←/g, '<')
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    .replace(/[•●]/g, '-')
    .split(String.fromCharCode(0xa0)) // espaço que não quebra linha
    .join(' ');
  // O que sobrar fora do Latin-1 vira "?" em vez de lixo
  return Array.from(simples)
    .map((c) => (cabeNaFonte(c.codePointAt(0) ?? 0) ? c : '?'))
    .join('');
}

/** Tabulação, quebra de linha, ASCII visível e a faixa Latin-1 (acentos). */
function cabeNaFonte(codigo: number): boolean {
  return codigo === 9 || codigo === 10 || (codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa1 && codigo <= 0xff);
}

const OU_TODOS = (valor: string, padrao: string) => valor || padrao;

// ==========================================
// HISTÓRICO DE EMPRÉSTIMOS
// ==========================================

export interface FiltrosHistorico {
  periodo: string;
  pessoa: string;
  busca: string;
  situacao: string;
}

const ROTULOS_GRUPO: Record<GrupoHistorico, string> = {
  andamento: 'Em andamento',
  devolvidos: 'Devolvidos',
  nao_retirados: 'Recusados ou expirados',
  atraso: 'Com atraso',
  avaria: 'Com avaria',
};

export function documentoHistorico(linhas: LinhaHistorico[], filtros: FiltrosHistorico, ctx: Contexto): DocumentoRelatorio {
  const contar = (g: GrupoHistorico) => String(linhas.filter((l) => l.grupos.includes(g)).length);
  return {
    titulo: 'Histórico de empréstimos',
    descricao: 'O caminho de cada pedido: pedido, aprovação, retirada, devolução e o que aconteceu com o item.',
    filtros: [
      ['Período', filtros.periodo],
      ['Pessoa', OU_TODOS(filtros.pessoa, 'Todas')],
      ['Item ou patrimônio', OU_TODOS(filtros.busca, 'Todos')],
      ['Situação', OU_TODOS(filtros.situacao, 'Todas')],
    ],
    resumo: [
      ['Pedidos', String(linhas.length)],
      [ROTULOS_GRUPO.andamento, contar('andamento')],
      [ROTULOS_GRUPO.devolvidos, contar('devolvidos')],
      [ROTULOS_GRUPO.nao_retirados, contar('nao_retirados')],
      [ROTULOS_GRUPO.atraso, contar('atraso')],
      [ROTULOS_GRUPO.avaria, contar('avaria')],
    ],
    colunas: ['Pedido em', 'Pessoa', 'Item', 'Situação', 'Caminho do pedido'],
    linhas: linhas.map((l) => [
      formatDateShort(l.data),
      l.pessoa,
      l.patrimonio ? `${l.item} (${l.patrimonio})` : l.item,
      ROTULOS_SITUACAO[l.situacao],
      l.etapas
        .map((e) => `${formatDateShort(e.data)}  ${e.rotulo}${e.observacao ? ` (${e.observacao})` : ''}`)
        .join('\n'),
    ]),
    geradoEm: formatDateTime(ctx.agora),
    geradoPor: ctx.geradoPor,
    arquivo: nomeDoArquivo('historico', ctx.agora),
  };
}

// ==========================================
// AVARIAS E ENCAMINHAMENTOS
// ==========================================

export interface FiltrosAvarias {
  periodo: string;
  tipo: string;
  situacao: string;
}

/** Situação de uma ocorrência: ainda em manutenção, consertada ou encaminhada (e para onde). */
export function situacaoDaOcorrencia(o: Ocorrencia, item?: Item): string {
  if (o.status === 'aberta') return 'Em manutenção';
  if (o.desfecho === 'encaminhado') {
    const enc = item?.encaminhamento;
    return enc ? `Encaminhado para ${enc.destinoNome} em ${formatDateShort(enc.em)}` : 'Encaminhado';
  }
  return o.resolvidoEm ? `Consertado em ${formatDateShort(o.resolvidoEm)}` : 'Consertado';
}

export function documentoAvarias(
  ocorrencias: Ocorrencia[],
  itens: Item[],
  usuarios: Usuario[],
  filtros: FiltrosAvarias,
  ctx: Contexto,
): DocumentoRelatorio {
  const item = (id: string) => itens.find((i) => i.id === id);
  const pessoa = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? 'Pessoa não identificada';
  const contarTipo = (valor: string) => String(ocorrencias.filter((o) => o.categoria === valor).length);
  const situacoes = ocorrencias.map((o) => situacaoDaOcorrencia(o, item(o.itemId)));
  return {
    titulo: 'Avarias e encaminhamentos',
    descricao: 'Itens que voltaram com avaria, de que tipo, quem devolveu e o que foi feito: conserto ou encaminhamento.',
    filtros: [
      ['Período', filtros.periodo],
      ['Tipo de avaria', OU_TODOS(filtros.tipo, 'Todos')],
      ['Situação', OU_TODOS(filtros.situacao, 'Todas')],
    ],
    resumo: [
      ['Avarias', String(ocorrencias.length)],
      ...CATEGORIAS_AVARIA.map((c): [string, string] => [c.rotulo, contarTipo(c.valor)]),
      ['Em manutenção', String(situacoes.filter((s) => s === 'Em manutenção').length)],
      ['Consertados', String(situacoes.filter((s) => s.startsWith('Consertado')).length)],
      ['Encaminhados', String(situacoes.filter((s) => s.startsWith('Encaminhado')).length)],
    ],
    colunas: ['Data', 'Item', 'Devolvido por', 'Tipo', 'O que aconteceu com o item', 'Situação'],
    linhas: ocorrencias.map((o, i) => {
      const it = item(o.itemId);
      return [
        formatDateShort(o.criadoEm),
        it ? `${it.nome} (${it.patrimonio})` : 'Item removido',
        pessoa(o.usuarioId),
        rotuloCategoriaAvaria(o.categoria),
        o.descricao,
        situacoes[i],
      ];
    }),
    geradoEm: formatDateTime(ctx.agora),
    geradoPor: ctx.geradoPor,
    arquivo: nomeDoArquivo('avarias', ctx.agora),
  };
}

// ==========================================
// AUDITORIA
// ==========================================

export interface FiltrosAuditoria {
  periodo: string;
  pessoa: string;
  busca: string;
  tipo: string;
}

export function documentoAuditoria(
  eventos: EventoAuditoria[],
  itens: Item[],
  nomePessoa: (id?: string) => string,
  filtros: FiltrosAuditoria,
  ctx: Contexto,
): DocumentoRelatorio {
  const item = (id?: string) => itens.find((i) => i.id === id);
  return {
    titulo: 'Auditoria',
    descricao: 'Quem fez o quê, com quem e por quê. Ações sem autor foram feitas pelo sistema (rotina automática ou política de atraso).',
    filtros: [
      ['Período', filtros.periodo],
      ['Pessoa', OU_TODOS(filtros.pessoa, 'Todas')],
      ['Busca', OU_TODOS(filtros.busca, 'Nenhuma')],
      ['Tipo de evento', OU_TODOS(filtros.tipo, 'Todos')],
    ],
    resumo: [
      ['Eventos', String(eventos.length)],
      ...GRUPOS_EVENTO.map((g): [string, string] => [
        g.rotulo,
        String(eventos.filter((e) => TIPOS_EVENTO[e.tipo].grupo === g.valor).length),
      ]),
    ],
    colunas: ['Data e hora', 'Evento', 'Quem fez', 'Afetado', 'Item', 'Motivo e detalhe'],
    linhas: eventos.map((e) => {
      const it = item(e.itemId);
      return [
        formatDateTime(e.em),
        TIPOS_EVENTO[e.tipo].rotulo,
        nomePessoa(e.autorId),
        nomePessoa(e.afetadoId),
        it ? `${it.nome} (${it.patrimonio})` : '',
        [e.motivo, e.detalhe].filter(Boolean).join('. '),
      ];
    }),
    geradoEm: formatDateTime(ctx.agora),
    geradoPor: ctx.geradoPor,
    arquivo: nomeDoArquivo('auditoria', ctx.agora),
  };
}
