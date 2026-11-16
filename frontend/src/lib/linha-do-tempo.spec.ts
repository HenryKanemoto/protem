import {Emprestimo, Solicitacao} from '../types/models';
import {etapasDoPedido} from './linha-do-tempo';

const base: Solicitacao = {
  id: 's1',
  solicitanteId: 'u',
  itemId: 'i',
  devolucaoDesejada: '2026-11-20',
  status: 'pendente',
  criadoEm: new Date(2026, 10, 14, 9).toISOString(),
};
const aprovada: Solicitacao = {...base, status: 'aprovada', avaliadoEm: new Date(2026, 10, 14, 10).toISOString()};
const emprestimo: Emprestimo = {
  id: 'e1',
  solicitacaoId: 's1',
  itemId: 'i',
  usuarioId: 'u',
  registradoPor: 'r',
  retiradoEm: new Date(2026, 10, 14, 11).toISOString(),
  devolucaoPrevista: '2026-11-20',
  diasAtraso: 0,
};

const estados = (e: ReturnType<typeof etapasDoPedido>) => e.map((x) => x.estado);

describe('linha do tempo do pedido', () => {
  it('sempre tem as quatro etapas, na ordem', () => {
    expect(etapasDoPedido(base).map((e) => e.chave)).toEqual(['pedido', 'aprovacao', 'retirada', 'devolucao']);
  });

  it('pedido em análise: a aprovação é a etapa de agora', () => {
    const etapas = etapasDoPedido(base);
    expect(estados(etapas)).toEqual(['feito', 'atual', 'pendente', 'pendente']);
    expect(etapas[0].detalhe).toBe('14/11/2026');
    expect(etapas[1].detalhe).toBe('Em análise');
    expect(etapas[3].detalhe).toBe('Prazo até 20/11/2026');
  });

  it('aprovado e não retirado: a retirada é a etapa de agora', () => {
    const etapas = etapasDoPedido(aprovada);
    expect(estados(etapas)).toEqual(['feito', 'feito', 'atual', 'pendente']);
    expect(etapas[2].detalhe).toBe('Retire hoje');
  });

  it('emprestado no prazo: a devolução é a etapa de agora, com a data', () => {
    const etapas = etapasDoPedido({...aprovada, status: 'concluida'}, emprestimo);
    expect(estados(etapas)).toEqual(['feito', 'feito', 'feito', 'atual']);
    expect(etapas[2].detalhe).toBe('14/11/2026');
    expect(etapas[3].detalhe).toBe('Até 20/11/2026');
    expect(etapas[3].alerta).toBeFalsy();
  });

  it('atrasado: a devolução é a etapa de agora e pede atenção', () => {
    const etapas = etapasDoPedido({...aprovada, status: 'concluida'}, {...emprestimo, diasAtraso: 2});
    expect(etapas[3]).toMatchObject({estado: 'atual', alerta: true, detalhe: 'Venceu em 20/11/2026'});
  });

  it('devolvido: tudo feito; o atraso aparece na data da devolução', () => {
    const devolvido: Emprestimo = {...emprestimo, devolvidoEm: new Date(2026, 10, 22, 9).toISOString(), diasAtraso: 2};
    const etapas = etapasDoPedido({...aprovada, status: 'concluida'}, devolvido);
    expect(estados(etapas)).toEqual(['feito', 'feito', 'feito', 'feito']);
    expect(etapas[3].detalhe).toBe('22/11/2026 (2 dias de atraso)');
  });

  it('recusado: a aprovação não aconteceu e o resto não chega', () => {
    const etapas = etapasDoPedido({...base, status: 'recusada', avaliadoEm: new Date(2026, 10, 14, 10).toISOString()});
    expect(estados(etapas)).toEqual(['feito', 'falhou', 'pendente', 'pendente']);
    expect(etapas[1].detalhe).toBe('Recusado em 14/11/2026');
  });

  it('expirado: aprovado, mas a retirada não aconteceu', () => {
    const etapas = etapasDoPedido({...aprovada, status: 'expirada'});
    expect(estados(etapas)).toEqual(['feito', 'feito', 'falhou', 'pendente']);
    expect(etapas[2].detalhe).toBe('Não retirado no dia');
  });
});
