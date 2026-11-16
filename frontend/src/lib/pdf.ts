import type {jsPDF} from 'jspdf';
import {DocumentoRelatorio, textoPdf} from './relatorio-documento';

/**
 * Desenha um relatório em PDF no próprio navegador, sem enviar nada para servidor.
 * A biblioteca (jsPDF) só é carregada quando alguém pede o PDF, num pacote separado.
 * Cores da marca: navy no cabeçalho e nas colunas, azul claro nas linhas alternadas, dourado só no traço.
 */
const NAVY: [number, number, number] = [14, 26, 58];
const AZUL_SUAVE: [number, number, number] = [234, 241, 254];
const BORDA: [number, number, number] = [213, 220, 232];
const TEXTO: [number, number, number] = [31, 41, 55];
const TEXTO_SUAVE: [number, number, number] = [91, 100, 117];
const DOURADO: [number, number, number] = [242, 183, 5];

const MARGEM = 40;
const ALTURA_CABECALHO = 46;

export async function montarPdf(documento: DocumentoRelatorio): Promise<jsPDF> {
  const [{jsPDF: JsPdf}, {default: autoTable}] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const t = textoPdf;

  const pdf = new JsPdf({orientation: 'landscape', unit: 'pt', format: 'a4'});
  pdf.setProperties({
    title: t(`${documento.titulo} - Protem`),
    subject: t(documento.descricao),
    author: 'Protem',
    creator: 'Protem - Plataforma Web de Empréstimos',
  });
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();

  // Título, para que serve, quando e por quem foi gerado
  let y = ALTURA_CABECALHO + 36;
  pdf.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...NAVY);
  pdf.text(t(documento.titulo), MARGEM, y);
  y += 16;
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...TEXTO_SUAVE);
  const descricao = pdf.splitTextToSize(t(documento.descricao), largura - MARGEM * 2) as string[];
  pdf.text(descricao, MARGEM, y);
  y += descricao.length * 12 + 2;
  pdf.text(t(`Gerado em ${documento.geradoEm} por ${documento.geradoPor}`), MARGEM, y);
  y += 14;

  // Filtros usados: sem eles, quem lê o papel não sabe o que ficou de fora
  pdf.setTextColor(...TEXTO).setFontSize(9);
  const filtros = pdf.splitTextToSize(
    t('Filtros: ' + documento.filtros.map(([rotulo, valor]) => `${rotulo}: ${valor}`).join('  |  ')),
    largura - MARGEM * 2,
  ) as string[];
  pdf.text(filtros, MARGEM, y);
  y += filtros.length * 11 + 6;

  // Resumo: uma linha de números
  autoTable(pdf, {
    startY: y,
    margin: {left: MARGEM, right: MARGEM},
    head: [documento.resumo.map(([rotulo]) => t(rotulo))],
    body: [documento.resumo.map(([, valor]) => t(valor))],
    theme: 'plain',
    styles: {font: 'helvetica', fontSize: 9, halign: 'center', textColor: TEXTO, cellPadding: 5},
    headStyles: {fontSize: 8, fontStyle: 'normal', textColor: TEXTO_SUAVE, fillColor: AZUL_SUAVE},
    bodyStyles: {fontStyle: 'bold', fontSize: 13, textColor: NAVY},
  });
  y = (pdf as unknown as {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 16;

  // Tabela principal; repete o cabeçalho a cada página
  autoTable(pdf, {
    startY: y,
    margin: {top: ALTURA_CABECALHO + 18, left: MARGEM, right: MARGEM, bottom: 36},
    head: [documento.colunas.map(t)],
    body: documento.linhas.length
      ? documento.linhas.map((linha) => linha.map(t))
      : [[{content: 'Nenhum registro com esses filtros.', colSpan: documento.colunas.length, styles: {halign: 'center'}}]],
    theme: 'grid',
    styles: {font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: TEXTO, lineColor: BORDA, lineWidth: 0.4, overflow: 'linebreak', valign: 'top'},
    headStyles: {fillColor: NAVY, textColor: 255, fontStyle: 'bold'},
    alternateRowStyles: {fillColor: AZUL_SUAVE},
    rowPageBreak: 'avoid',
  });

  // Cabeçalho com a marca e rodapé com a página, em todas as páginas
  const total = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    pdf.setPage(pagina);
    pdf.setFillColor(...NAVY).rect(0, 0, largura, ALTURA_CABECALHO, 'F');
    pdf.setFillColor(...DOURADO).rect(0, ALTURA_CABECALHO, 56, 3, 'F');
    pdf.setFont('helvetica', 'bold').setFontSize(15).setTextColor(255, 255, 255);
    pdf.text('Protem', MARGEM, 29);
    pdf.setFont('helvetica', 'normal').setFontSize(9);
    pdf.text('Plataforma Web de Empréstimos', MARGEM + 58, 29);
    pdf.text(t(documento.titulo), largura - MARGEM, 29, {align: 'right'});

    pdf.setFontSize(8).setTextColor(...TEXTO_SUAVE);
    pdf.text(t(`Protem · gerado em ${documento.geradoEm}`), MARGEM, altura - 18);
    pdf.text(`Página ${pagina} de ${total}`, largura - MARGEM, altura - 18, {align: 'right'});
  }
  return pdf;
}

/** Gera o PDF e o baixa com o nome sugerido. */
export async function baixarPdf(documento: DocumentoRelatorio): Promise<void> {
  const pdf = await montarPdf(documento);
  pdf.save(documento.arquivo);
}
