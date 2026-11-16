import {montarPdf} from './pdf';
import {DocumentoRelatorio} from './relatorio-documento';

function documento(linhas: number): DocumentoRelatorio {
  return {
    titulo: 'Histórico de empréstimos',
    descricao: 'O caminho de cada pedido.',
    filtros: [['Período', '30 dias']],
    resumo: [['Pedidos', String(linhas)]],
    colunas: ['Pedido em', 'Pessoa', 'Item', 'Situação', 'Caminho do pedido'],
    linhas: Array.from({length: linhas}, (_, i) => [
      '02/11/2026',
      `Pessoa ${i} → ação`,
      'Projetor (NX-0001)',
      'Devolvido',
      '02/11/2026  Pedido\n03/11/2026  Retirado\n05/11/2026  Devolvido (2 dias de atraso)',
    ]),
    geradoEm: '15/11/2026 09:30',
    geradoPor: 'Enzo Capiel',
    arquivo: 'protem-historico-2026-11-15.pdf',
  };
}

describe('PDF do relatório', () => {
  it('gera um PDF de verdade, em A4 paisagem, com o nome do relatório nas propriedades', async () => {
    const pdf = await montarPdf(documento(3));
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight());
    // Título e autor ficam nas propriedades do arquivo
    const texto = new TextDecoder('latin1').decode(bytes);
    expect(texto).toContain('/Author (Protem)');
    expect(texto).toContain('/Title (Hist');
  });

  it('lista longa passa para outras páginas', async () => {
    const pdf = await montarPdf(documento(80));
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('sem registros, ainda gera o PDF (com o aviso de lista vazia)', async () => {
    const pdf = await montarPdf(documento(0));
    expect(pdf.getNumberOfPages()).toBe(1);
  });
});
