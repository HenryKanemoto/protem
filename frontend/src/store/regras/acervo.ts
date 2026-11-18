import { Categoria, DestinoEncaminhamento, Item, PoliticaAtraso, StatusItem, Subcategoria, TipoDestino } from '../../types/models';
import { ProtemState, ResultadoAcao, Transicao, novoEvento } from '../estado';
import { destinosDe } from './avaria';
import { etapaDaOcorrencia } from './manutencao';

function upsert<T extends {id: string}>(lista: T[], registro: T): T[] {
  return lista.some((r) => r.id === registro.id)
    ? lista.map((r) => (r.id === registro.id ? registro : r))
    : [registro, ...lista];
}

/**
 * Grava o item. A subcategoria só vale se pertencer à categoria do item;
 * se a categoria mudou (ou a subcategoria não existe), ela é descartada.
 */
export function salvarItem(s: ProtemState, item: Item): ProtemState {
  const sub = item.subcategoriaId ? s.subcategorias.find((x) => x.id === item.subcategoriaId) : undefined;
  const gravado: Item = {...item};
  if (sub && sub.categoriaId === item.categoriaId) gravado.subcategoriaId = sub.id;
  else delete gravado.subcategoriaId;
  return {...s, itens: upsert(s.itens, gravado)};
}

/** Cria ou renomeia uma subcategoria. O nome é obrigatório e único dentro da categoria. */
export function salvarSubcategoria(s: ProtemState, subcategoria: Subcategoria): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  const nome = subcategoria.nome.trim();
  if (!nome) return falha('Informe o nome da subcategoria.');
  if (!s.categorias.some((c) => c.id === subcategoria.categoriaId)) return falha('Categoria não encontrada.');
  const existente = s.subcategorias.find((x) => x.id === subcategoria.id);
  if (existente && existente.categoriaId !== subcategoria.categoriaId) {
    return falha('Uma subcategoria não pode mudar de categoria.');
  }
  const repetida = s.subcategorias.some(
    (x) =>
      x.id !== subcategoria.id &&
      x.categoriaId === subcategoria.categoriaId &&
      x.nome.localeCompare(nome, 'pt-BR', {sensitivity: 'base'}) === 0,
  );
  if (repetida) return falha('Já existe uma subcategoria com esse nome nesta categoria.');
  return {
    estado: {...s, subcategorias: upsert(s.subcategorias, {...subcategoria, nome})},
    resultado: {sucesso: true, mensagem: 'Subcategoria salva.'},
  };
}

/** Só sai da lista se nenhum item estiver usando. */
export function removerSubcategoria(s: ProtemState, subcategoriaId: string): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  if (!s.subcategorias.some((x) => x.id === subcategoriaId)) return falha('Subcategoria não encontrada.');
  const emUso = s.itens.filter((i) => i.subcategoriaId === subcategoriaId).length;
  if (emUso > 0) {
    return falha(`${emUso === 1 ? '1 item usa' : emUso + ' itens usam'} essa subcategoria. Mude ${emUso === 1 ? 'o item' : 'os itens'} antes de remover.`);
  }
  return {
    estado: {...s, subcategorias: s.subcategorias.filter((x) => x.id !== subcategoriaId)},
    resultado: {sucesso: true, mensagem: 'Subcategoria removida.'},
  };
}

export function removerCategoria(s: ProtemState, categoriaId: string): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  if (!s.categorias.some((x) => x.id === categoriaId)) return falha('Categoria não encontrada.');
  const emUso = s.itens.filter((i) => i.categoriaId === categoriaId).length;
  if (emUso > 0) {
    return falha(`${emUso === 1 ? '1 item usa' : emUso + ' itens usam'} essa categoria. Mude ${emUso === 1 ? 'o item' : 'os itens'} antes de remover.`);
  }
  return {
    estado: {
      ...s,
      categorias: s.categorias.filter((x) => x.id !== categoriaId),
      subcategorias: s.subcategorias.filter((x) => x.categoriaId !== categoriaId),
    },
    resultado: {sucesso: true, mensagem: 'Categoria removida.'}
  }
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
    motivo: ocorr.laudo?.parecer,
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
 * Marcar como consertado, pelo responsável. Só depois do laudo "arrumado" do técnico:
 * antes disso o item ainda não foi avaliado, e com o laudo "sem conserto" só resta encaminhar.
 */
export function consertarItem(s: ProtemState, ocorrenciaId: string, responsavelId: string): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  const ocorr = s.ocorrencias.find((o) => o.id === ocorrenciaId);
  if (!ocorr || ocorr.status !== 'aberta') return falha('Ocorrência não encontrada ou já encerrada.');
  const etapa = etapaDaOcorrencia(ocorr);
  if (etapa === 'aguardando_envio') return falha('Envie o item ao técnico antes de marcar como consertado.');
  if (etapa === 'com_tecnico') return falha('Espere o laudo do técnico para marcar como consertado.');
  if (etapa === 'laudo_sem_conserto') return falha('O técnico avaliou que não há conserto. Encaminhe o item.');

  const item = s.itens.find((i) => i.id === ocorr.itemId);
  return {
    estado: resolverOcorrencia(s, ocorrenciaId, true, responsavelId),
    resultado: {
      sucesso: true,
      mensagem: `"${item?.nome ?? 'Item'}" (${item?.patrimonio ?? ''}) foi consertado e voltou ao catálogo como disponível.`,
    },
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
  // Com ocorrência aberta, o encaminhamento só vale depois do laudo do técnico (arrumado ou sem conserto)
  const emAvaliacao = ocorrenciasAbertas.find((o) => !o.laudo);
  if (emAvaliacao) {
    return falha(
      etapaDaOcorrencia(emAvaliacao) === 'com_tecnico'
        ? 'Espere o laudo do técnico antes de encaminhar.'
        : 'Envie o item ao técnico antes de encaminhar.',
    );
  }
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
