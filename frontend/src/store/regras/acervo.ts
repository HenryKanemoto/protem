import {Categoria, DestinoEncaminhamento, Item, PoliticaAtraso, StatusItem, TipoDestino} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novoEvento} from '../estado';
import {destinosDe} from './avaria';

function upsert<T extends {id: string}>(lista: T[], registro: T): T[] {
  return lista.some((r) => r.id === registro.id)
    ? lista.map((r) => (r.id === registro.id ? registro : r))
    : [registro, ...lista];
}

export function salvarItem(s: ProtemState, item: Item): ProtemState {
  return {...s, itens: upsert(s.itens, item)};
}

export function removerItem(s: ProtemState, itemId: string): ProtemState {
  return {...s, itens: s.itens.filter((i) => i.id !== itemId)};
}

export function salvarCategoria(s: ProtemState, cat: Categoria): ProtemState {
  return {...s, categorias: upsert(s.categorias, cat)};
}

/** Conserto: a ocorrência fecha, o item volta ao catálogo e o responsável fica registrado na auditoria. */
export function resolverOcorrencia(
  s: ProtemState,
  ocorrenciaId: string,
  itemRetornarDisponivel = true,
  responsavelId?: string,
): ProtemState {
  const ocorr = s.ocorrencias.find((o) => o.id === ocorrenciaId);
  if (!ocorr) return s;

  const evento = novoEvento('item_consertado', s.agora, ocorr.usuarioId, {
    autorId: responsavelId,
    itemId: ocorr.itemId,
    detalhe: 'Voltou ao catálogo como disponível',
  });
  return {
    ...s,
    ocorrencias: s.ocorrencias.map((o) =>
      o.id === ocorrenciaId ? {...o, status: 'resolvida' as const, resolvidoEm: s.agora, desfecho: 'consertado' as const} : o,
    ),
    itens: itemRetornarDisponivel
      ? s.itens.map((i) => (i.id === ocorr.itemId ? {...i, status: 'disponivel' as StatusItem} : i))
      : s.itens,
    auditoria: [evento, ...s.auditoria],
  };
}

/**
 * Item sem conserto: sai da manutenção e do acervo e vai para um destino (CRC, SENAI Lab...).
 * Só item em manutenção pode ser encaminhado, e o motivo é obrigatório. O item não volta
 * ao catálogo; o destino, a data e o motivo ficam no item e na auditoria.
 */
export function encaminharItem(
  s: ProtemState,
  itemId: string,
  responsavelId: string,
  destinoId: string,
  motivo: string,
): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  const item = s.itens.find((i) => i.id === itemId);
  if (!item) return falha('Item não encontrado.');
  if (item.status !== 'manutencao') return falha('Só item em manutenção pode ser encaminhado.');
  const destino = destinosDe(s.configuracao).find((d) => d.id === destinoId);
  if (!destino) return falha('Escolha o destino do item.');
  const motivoTexto = motivo.trim();
  if (!motivoTexto) return falha('Informe o motivo do encaminhamento.');

  const ocorrenciasAbertas = s.ocorrencias.filter((o) => o.itemId === itemId && o.status === 'aberta');
  // A pessoa que devolveu o item com a avaria; sem ocorrência, fica o próprio responsável
  const afetadoId = ocorrenciasAbertas[0]?.usuarioId ?? responsavelId;
  return {
    estado: {
      ...s,
      itens: s.itens.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: 'encaminhado' as StatusItem,
              encaminhamento: {
                destinoId: destino.id,
                destinoNome: destino.nome,
                tipo: destino.tipo,
                em: s.agora,
                porId: responsavelId,
                motivo: motivoTexto,
              },
            }
          : i,
      ),
      ocorrencias: s.ocorrencias.map((o) =>
        o.itemId === itemId && o.status === 'aberta'
          ? {...o, status: 'resolvida' as const, resolvidoEm: s.agora, desfecho: 'encaminhado' as const}
          : o,
      ),
      auditoria: [
        novoEvento('item_encaminhado', s.agora, afetadoId, {
          autorId: responsavelId,
          itemId,
          motivo: motivoTexto,
          detalhe: `Destino: ${destino.nome}`,
        }),
        ...s.auditoria,
      ],
    },
    resultado: {sucesso: true, mensagem: `"${item.nome}" foi encaminhado para ${destino.nome}.`},
  };
}

/** Inclui um destino ou muda o nome, o tipo e a descrição de um que já existe. */
export function salvarDestino(
  s: ProtemState,
  dados: {id?: string; nome: string; tipo: TipoDestino; descricao: string},
): Transicao<ResultadoAcao> {
  const nome = dados.nome.trim();
  if (!nome) return {estado: s, resultado: {sucesso: false, mensagem: 'Informe o nome do destino.'}};
  const lista = destinosDe(s.configuracao);
  const outroComMesmoNome = lista.some((d) => d.id !== dados.id && d.nome.toLowerCase() === nome.toLowerCase());
  if (outroComMesmoNome) return {estado: s, resultado: {sucesso: false, mensagem: 'Já existe um destino com esse nome.'}};

  const destino: DestinoEncaminhamento = {
    id: dados.id ?? 'dest-' + Date.now(),
    nome,
    tipo: dados.tipo,
    descricao: dados.descricao.trim(),
  };
  const destinosEncaminhamento = lista.some((d) => d.id === destino.id)
    ? lista.map((d) => (d.id === destino.id ? destino : d))
    : [...lista, destino];
  return {
    estado: {...s, configuracao: {...s.configuracao, destinosEncaminhamento}},
    resultado: {sucesso: true, mensagem: dados.id ? 'Destino atualizado.' : 'Destino incluído.'},
  };
}

/** Remove um destino da lista. Itens já encaminhados guardam o nome, então não mudam. Sempre sobra um. */
export function removerDestino(s: ProtemState, destinoId: string): Transicao<ResultadoAcao> {
  const lista = destinosDe(s.configuracao);
  if (!lista.some((d) => d.id === destinoId)) return {estado: s, resultado: {sucesso: false, mensagem: 'Destino não encontrado.'}};
  if (lista.length === 1) {
    return {estado: s, resultado: {sucesso: false, mensagem: 'Mantenha pelo menos um destino para poder encaminhar itens.'}};
  }
  return {
    estado: {...s, configuracao: {...s.configuracao, destinosEncaminhamento: lista.filter((d) => d.id !== destinoId)}},
    resultado: {sucesso: true, mensagem: 'Destino removido.'},
  };
}

export function alterarPoliticaAtraso(s: ProtemState, politicaAtraso: PoliticaAtraso): ProtemState {
  return {...s, configuracao: {...s.configuracao, politicaAtraso}};
}

export function marcarNotificacaoComoLida(s: ProtemState, notificacaoId: string): ProtemState {
  return {...s, notificacoes: s.notificacoes.map((n) => (n.id === notificacaoId ? {...n, lida: true} : n))};
}

export function marcarTodasNotificacoesComoLidas(s: ProtemState, usuarioId: string): ProtemState {
  return {...s, notificacoes: s.notificacoes.map((n) => (n.usuarioId === usuarioId ? {...n, lida: true} : n))};
}
