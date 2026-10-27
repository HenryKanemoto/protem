import {montarHistorico} from './historico';
import {AGORA, emprestimo, estadoDeTeste, solicitacao} from '../store/regras/estado-de-teste';

describe('histórico de pedidos', () => {
  const base = estadoDeTeste();
  const depois = (horas: number) => new Date(AGORA.getTime() + horas * 3600_000).toISOString();

  it('junta pedido, aprovação, retirada e devolução em uma linha, com a situação final', () => {
    const linhas = montarHistorico({
      ...base,
      solicitacoes: [solicitacao('p1', 'a1', {status: 'concluida', avaliadoEm: depois(1)})],
      emprestimos: [emprestimo('e1', 'a1', {solicitacaoId: 'p1', retiradoEm: depois(2), devolvidoEm: depois(30), diasAtraso: 2})],
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].etapas.map((e) => e.rotulo)).toEqual(['Pedido', 'Aprovado', 'Retirado', 'Devolvido']);
    expect(linhas[0].situacao).toBe('devolvido_atraso');
    expect(linhas[0].grupos).toEqual(['atraso', 'devolvidos']);
  });

  it('mostra o motivo da recusa e marca avaria', () => {
    const linhas = montarHistorico({
      ...base,
      solicitacoes: [
        solicitacao('p1', 'a1', {status: 'recusada', avaliadoEm: depois(1), motivoRecusa: 'Item reservado'}),
        solicitacao('p2', 'b1', {status: 'concluida', avaliadoEm: depois(1), criadoEm: depois(-5)}),
      ],
      emprestimos: [emprestimo('e2', 'b1', {solicitacaoId: 'p2', devolvidoEm: depois(20)})],
      ocorrencias: [{id: 'o', emprestimoId: 'e2', itemId: 'b1', usuarioId: 'aluna', descricao: 'Cabo partido', status: 'aberta', criadoEm: depois(20)}],
    });
    expect(linhas[0]).toMatchObject({situacao: 'recusado', grupos: ['nao_retirados']});
    expect(linhas[0].etapas[1]).toMatchObject({rotulo: 'Recusado', observacao: 'Item reservado'});
    expect(linhas[1]).toMatchObject({situacao: 'devolvido_avaria'});
    expect(linhas[1].etapas.at(-1)?.observacao).toContain('Cabo partido');
  });
});
