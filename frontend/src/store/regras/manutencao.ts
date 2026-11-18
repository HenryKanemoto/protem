import {formatDateShort, addHours, parseDate} from '../../lib/date-utils';
import {EtapaManutencao, EventoAuditoria, LaudoTecnico, Notificacao, Ocorrencia, ResultadoLaudo} from '../../types/models';
import {ProtemState, ResultadoAcao, Transicao, novaNotificacao, novoEvento, responsaveis} from '../estado';

/**
 * Manutenção em etapas. Todo item que volta com avaria passa pelo técnico antes de o responsável
 * poder marcar como consertado ou encaminhar:
 *
 *   aguardando envio → com o técnico → laudo (arrumado | sem conserto)
 *
 * O item continua "em manutenção" o tempo todo: quem muda de etapa é a ocorrência.
 * O técnico não tem conta no sistema; o laudo é simulado e chega com o relógio da demonstração.
 */

/** Tempo, em horas, entre enviar o item ao técnico e o laudo chegar. */
export const PRAZO_LAUDO_HORAS = 24;

export const ROTULOS_RESULTADO_LAUDO: Record<ResultadoLaudo, string> = {
  arrumado: 'Arrumado',
  sem_conserto: 'Sem conserto',
};

/** Em que etapa a ocorrência está. Ocorrência antiga, sem envio registrado, conta como aguardando envio. */
export function etapaDaOcorrencia(o: Ocorrencia): EtapaManutencao {
  if (o.laudo) return o.laudo.resultado === 'arrumado' ? 'laudo_arrumado' : 'laudo_sem_conserto';
  return o.envioAoTecnico ? 'com_tecnico' : 'aguardando_envio';
}

/**
 * O que espera o responsável na Manutenção: item para enviar ao técnico e laudo para decidir.
 * Item que está com o técnico não pede ação agora, então não entra na conta.
 */
export function pendenciasDeManutencao(ocorrencias: Ocorrencia[]): number {
  return ocorrencias.filter((o) => o.status === 'aberta' && etapaDaOcorrencia(o) !== 'com_tecnico').length;
}

// Pareceres do técnico, conforme o estado do item. A variante é escolhida pelo código da ocorrência,
// então a mesma ocorrência sempre recebe o mesmo texto.
const PARECERES_SEM_CONSERTO = [
  'Placa principal queimada. O conserto custaria mais do que comprar um item novo.',
  'Dano interno e sem peça de reposição no mercado. Não há como recuperar o item.',
];
const PARECERES_ARRUMADO: Record<string, string[]> = {
  estetica: ['Só danos visuais, já reparados e limpos. O item está pronto para uso.'],
  funcional_leve: [
    'Peça desgastada trocada e funcionamento testado. O item está arrumado.',
    'Ajuste e limpeza dos componentes. O item voltou a funcionar normalmente.',
  ],
  incompleto: ['As peças e os acessórios que faltavam foram repostos. O item está completo e testado.'],
  padrao: ['Item avaliado e reparado. Está funcionando normalmente.'],
};

function variante(lista: string[], chave: string): string {
  let soma = 0;
  for (const c of chave) soma += c.charCodeAt(0);
  return lista[soma % lista.length];
}

/** O laudo que o técnico devolve para esta ocorrência: item quebrado não tem conserto; o resto volta arrumado. */
export function laudoSimulado(o: Ocorrencia): {resultado: ResultadoLaudo; parecer: string} {
  if (o.categoria === 'quebrado') return {resultado: 'sem_conserto', parecer: variante(PARECERES_SEM_CONSERTO, o.id)};
  const lista = PARECERES_ARRUMADO[o.categoria ?? 'padrao'] ?? PARECERES_ARRUMADO['padrao'];
  return {resultado: 'arrumado', parecer: variante(lista, o.id)};
}

/** Envia o item em manutenção ao técnico. O laudo chega depois de PRAZO_LAUDO_HORAS. */
export function enviarParaTecnico(s: ProtemState, ocorrenciaId: string, responsavelId: string): Transicao<ResultadoAcao> {
  const falha = (mensagem: string) => ({estado: s, resultado: {sucesso: false, mensagem}});
  const ocorr = s.ocorrencias.find((o) => o.id === ocorrenciaId);
  if (!ocorr || ocorr.status !== 'aberta') return falha('Ocorrência não encontrada ou já encerrada.');
  const item = s.itens.find((i) => i.id === ocorr.itemId);
  if (!item || item.status !== 'manutencao') return falha('Só item em manutenção pode ir ao técnico.');
  if (etapaDaOcorrencia(ocorr) !== 'aguardando_envio') return falha('Este item já foi enviado ao técnico.');

  const previsto = addHours(parseDate(s.agora), PRAZO_LAUDO_HORAS).toISOString();
  return {
    estado: {
      ...s,
      ocorrencias: s.ocorrencias.map((o) =>
        o.id === ocorrenciaId ? {...o, envioAoTecnico: {em: s.agora, porId: responsavelId, laudoPrevistoEm: previsto}} : o,
      ),
      auditoria: [
        novoEvento('item_enviado_tecnico', s.agora, ocorr.usuarioId, {
          autorId: responsavelId,
          itemId: ocorr.itemId,
          detalhe: `Laudo previsto para ${formatDateShort(previsto)}`,
        }),
        ...s.auditoria,
      ],
    },
    resultado: {
      sucesso: true,
      mensagem: `"${item.nome}" foi enviado ao técnico. O laudo é esperado até ${formatDateShort(previsto)}.`,
    },
  };
}

/** Põe o evento no lugar certo da lista (mais recente primeiro), sem reordenar o resto. */
function inserirPorData(auditoria: EventoAuditoria[], evento: EventoAuditoria): EventoAuditoria[] {
  const quando = parseDate(evento.em).getTime();
  const posicao = auditoria.findIndex((e) => parseDate(e.em).getTime() <= quando);
  return posicao < 0 ? [...auditoria, evento] : [...auditoria.slice(0, posicao), evento, ...auditoria.slice(posicao)];
}

/**
 * Rotina automática: recebe os laudos cujo prazo já passou (mesmo que o relógio tenha pulado dias).
 * Cada laudo avisa os responsáveis e grava o evento na auditoria, com a data em que ele chegou.
 */
export function receberLaudos(s: ProtemState, clockNow: Date): ProtemState {
  const chegaram = s.ocorrencias
    .filter(
      (o) =>
        o.status === 'aberta' &&
        o.envioAoTecnico &&
        !o.laudo &&
        parseDate(o.envioAoTecnico.laudoPrevistoEm).getTime() <= clockNow.getTime(),
    )
    .sort((a, b) => a.envioAoTecnico!.laudoPrevistoEm.localeCompare(b.envioAoTecnico!.laudoPrevistoEm));
  if (chegaram.length === 0) return s;

  const laudos = new Map<string, LaudoTecnico>();
  const notificacoes: Notificacao[] = [];
  let auditoria = s.auditoria;
  for (const o of chegaram) {
    const chegouEm = o.envioAoTecnico!.laudoPrevistoEm;
    const laudo: LaudoTecnico = {...laudoSimulado(o), em: chegouEm};
    laudos.set(o.id, laudo);

    const nomeItem = s.itens.find((i) => i.id === o.itemId)?.nome ?? 'item';
    const resumo = laudo.resultado === 'sem_conserto' ? 'não tem conserto' : 'está arrumado';
    for (const resp of responsaveis(s)) {
      notificacoes.unshift(
        novaNotificacao(resp.id, 'laudo', `O técnico avaliou "${nomeItem}": ${resumo}. Veja o parecer em Manutenção.`, chegouEm, '/painel/manutencao'),
      );
    }
    auditoria = inserirPorData(
      auditoria,
      novoEvento('laudo_tecnico', chegouEm, o.usuarioId, {
        itemId: o.itemId,
        motivo: laudo.parecer,
        detalhe: `Laudo do técnico: ${ROTULOS_RESULTADO_LAUDO[laudo.resultado].toLowerCase()}`,
      }),
    );
  }

  return {
    ...s,
    ocorrencias: s.ocorrencias.map((o) => (laudos.has(o.id) ? {...o, laudo: laudos.get(o.id)} : o)),
    notificacoes: [...notificacoes, ...s.notificacoes],
    auditoria,
  };
}
