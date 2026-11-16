import {montarHistorico} from './historico';
import {
  Contexto,
  documentoAuditoria,
  documentoAvarias,
  documentoHistorico,
  nomeDoArquivo,
  situacaoDaOcorrencia,
  textoPdf,
} from './relatorio-documento';
import {Emprestimo, EventoAuditoria, Item, Ocorrencia, Solicitacao, Usuario} from '../types/models';

const ctx: Contexto = {agora: new Date(2026, 10, 15, 9, 30), geradoPor: 'Enzo Capiel'};

const usuarios: Usuario[] = [
  {id: 'resp', nome: 'Enzo Capiel', email: 'e@example.com', matricula: 'R1', perfil: 'responsavel', status: 'ativa', criadoEm: '2026-01-01T00:00:00.000Z'},
  {id: 'ana', nome: 'Ana Souza', email: 'a@example.com', matricula: 'A1', perfil: 'aluno', status: 'ativa', criadoEm: '2026-01-01T00:00:00.000Z'},
];
const itemBase: Item = {id: 'i1', categoriaId: 'c', nome: 'Projetor', descricao: '', patrimonio: 'NX-0001', codigoQr: 'QR1', status: 'manutencao'};

const solicitacao: Solicitacao = {
  id: 's1',
  solicitanteId: 'ana',
  itemId: 'i1',
  devolucaoDesejada: '2026-11-12',
  status: 'concluida',
  criadoEm: new Date(2026, 10, 2, 9).toISOString(),
  avaliadoEm: new Date(2026, 10, 2, 10).toISOString(),
};
const emprestimo: Emprestimo = {
  id: 'e1',
  solicitacaoId: 's1',
  itemId: 'i1',
  usuarioId: 'ana',
  registradoPor: 'resp',
  retiradoEm: new Date(2026, 10, 3, 9).toISOString(),
  devolucaoPrevista: '2026-11-12',
  devolvidoEm: new Date(2026, 10, 14, 9).toISOString(),
  diasAtraso: 2,
};
const ocorrencia: Ocorrencia = {
  id: 'o1',
  emprestimoId: 'e1',
  itemId: 'i1',
  usuarioId: 'ana',
  descricao: 'Lente trincada',
  categoria: 'quebrado',
  status: 'aberta',
  criadoEm: new Date(2026, 10, 14, 9).toISOString(),
};

describe('relatório em PDF: conteúdo', () => {
  describe('nome do arquivo', () => {
    it('leva o tipo e a data, sem acento nem espaço', () => {
      expect(nomeDoArquivo('histórico', ctx.agora)).toBe('protem-historico-2026-11-15.pdf');
      expect(nomeDoArquivo('Avarias e encaminhamentos', ctx.agora)).toBe('protem-avarias-e-encaminhamentos-2026-11-15.pdf');
    });
  });

  describe('texto seguro para a fonte do PDF', () => {
    it('troca símbolos que a fonte padrão não tem e mantém os acentos', () => {
      expect(textoPdf('Pedido → Retirada… “ok” – fim')).toBe('Pedido > Retirada... "ok" - fim');
      expect(textoPdf('Devolução com avaria · ação')).toBe('Devolução com avaria · ação');
      expect(textoPdf('emoji 😀')).toBe('emoji ?');
    });
  });

  describe('histórico', () => {
    const linhas = montarHistorico({usuarios, itens: [itemBase], solicitacoes: [solicitacao], emprestimos: [emprestimo], ocorrencias: [ocorrencia]});
    const doc = documentoHistorico(linhas, {periodo: '30 dias', pessoa: '', busca: '', situacao: ''}, ctx);

    it('traz título, quem gerou, quando e o nome do arquivo', () => {
      expect(doc).toMatchObject({titulo: 'Histórico de empréstimos', geradoPor: 'Enzo Capiel', arquivo: 'protem-historico-2026-11-15.pdf'});
      expect(doc.geradoEm).toContain('15/11/2026');
    });

    it('mostra os filtros usados, com "Todas" quando não há filtro', () => {
      expect(doc.filtros).toEqual([
        ['Período', '30 dias'],
        ['Pessoa', 'Todas'],
        ['Item ou patrimônio', 'Todos'],
        ['Situação', 'Todas'],
      ]);
    });

    it('resume o que está na lista', () => {
      expect(Object.fromEntries(doc.resumo)).toMatchObject({Pedidos: '1', Devolvidos: '1', 'Com atraso': '1', 'Com avaria': '1', 'Em andamento': '0'});
    });

    it('uma linha por pedido, com o caminho de cada etapa', () => {
      expect(doc.colunas).toEqual(['Pedido em', 'Pessoa', 'Item', 'Situação', 'Caminho do pedido']);
      expect(doc.linhas).toHaveLength(1);
      const [data, pessoa, item, situacao, caminho] = doc.linhas[0];
      expect([data, pessoa, item, situacao]).toEqual(['02/11/2026', 'Ana Souza', 'Projetor (NX-0001)', 'Devolvido com avaria']);
      expect(caminho.split('\n').map((l) => l.replace(/^\S+\s+/, '').split(' (')[0])).toEqual(['Pedido', 'Aprovado', 'Retirado', 'Devolvido com avaria']);
      expect(caminho).toContain('Quebrado / Inoperante: Lente trincada');
    });

    it('sem registros, o documento sai com a lista vazia e o resumo zerado', () => {
      const vazio = documentoHistorico([], {periodo: 'Tudo', pessoa: 'Ana Souza', busca: 'xyz', situacao: 'Com avaria'}, ctx);
      expect(vazio.linhas).toEqual([]);
      expect(Object.fromEntries(vazio.resumo)['Pedidos']).toBe('0');
      expect(vazio.filtros[1]).toEqual(['Pessoa', 'Ana Souza']);
    });
  });

  describe('avarias e encaminhamentos', () => {
    it('lista cada avaria com tipo, quem devolveu e a situação', () => {
      const doc = documentoAvarias([ocorrencia], [itemBase], usuarios, {periodo: '30 dias', tipo: '', situacao: ''}, ctx);
      expect(doc.colunas).toEqual(['Data', 'Item', 'Devolvido por', 'Tipo', 'O que aconteceu com o item', 'Situação']);
      expect(doc.linhas[0]).toEqual(['14/11/2026', 'Projetor (NX-0001)', 'Ana Souza', 'Quebrado / Inoperante', 'Lente trincada', 'Em manutenção']);
      expect(Object.fromEntries(doc.resumo)).toMatchObject({Avarias: '1', 'Quebrado / Inoperante': '1', 'Avaria estética': '0', 'Em manutenção': '1', Encaminhados: '0'});
    });

    it('mostra para onde o item foi encaminhado', () => {
      const encaminhado: Item = {
        ...itemBase,
        status: 'encaminhado',
        encaminhamento: {destinoId: 'd', destinoNome: 'Unifap CRC', tipo: 'doacao', em: new Date(2026, 10, 15, 8).toISOString(), porId: 'resp', motivo: 'Sem conserto'},
      };
      const resolvida: Ocorrencia = {...ocorrencia, status: 'resolvida', desfecho: 'encaminhado', resolvidoEm: encaminhado.encaminhamento!.em};
      expect(situacaoDaOcorrencia(resolvida, encaminhado)).toBe('Encaminhado para Unifap CRC em 15/11/2026');
      const doc = documentoAvarias([resolvida], [encaminhado], usuarios, {periodo: 'Tudo', tipo: '', situacao: ''}, ctx);
      expect(Object.fromEntries(doc.resumo)).toMatchObject({Encaminhados: '1', 'Em manutenção': '0'});
    });

    it('item consertado e ocorrência antiga, sem tipo', () => {
      const consertada: Ocorrencia = {...ocorrencia, categoria: undefined, status: 'resolvida', desfecho: 'consertado', resolvidoEm: new Date(2026, 10, 15).toISOString()};
      expect(situacaoDaOcorrencia(consertada, itemBase)).toBe('Consertado em 15/11/2026');
      const doc = documentoAvarias([consertada], [itemBase], usuarios, {periodo: 'Tudo', tipo: '', situacao: ''}, ctx);
      expect(doc.linhas[0][3]).toBe('Avaria sem categoria');
    });
  });

  describe('auditoria', () => {
    const eventos: EventoAuditoria[] = [
      {id: 'a1', tipo: 'devolucao_avaria', em: new Date(2026, 10, 14, 9).toISOString(), autorId: 'resp', afetadoId: 'ana', itemId: 'i1', motivo: 'Lente trincada', detalhe: 'Quebrado / Inoperante. No prazo'},
      {id: 'a2', tipo: 'conta_bloqueada', em: new Date(2026, 10, 13, 0, 5).toISOString(), afetadoId: 'ana', motivo: 'Atraso na devolução'},
    ];
    const nome = (id?: string) => (id ? (usuarios.find((u) => u.id === id)?.nome ?? 'Pessoa removida') : 'Sistema');

    it('uma linha por evento, com quem fez ("Sistema" quando não há autor)', () => {
      const doc = documentoAuditoria(eventos, [itemBase], nome, {periodo: '30 dias', pessoa: '', busca: '', tipo: ''}, ctx);
      expect(doc.colunas).toHaveLength(6);
      expect(doc.linhas[0]).toEqual(['14/11/2026 às 09:00', 'Devolução com avaria', 'Enzo Capiel', 'Ana Souza', 'Projetor (NX-0001)', 'Lente trincada. Quebrado / Inoperante. No prazo']);
      expect(doc.linhas[1].slice(1, 4)).toEqual(['Conta bloqueada', 'Sistema', 'Ana Souza']);
      expect(Object.fromEntries(doc.resumo)).toMatchObject({Eventos: '2', 'Retiradas e devoluções': '1', 'Bloqueios e suspensões': '1'});
    });
  });
});
