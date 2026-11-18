import {ProtemState} from '../estado';
import {encaminharItem, removerDestino, resolverOcorrencia, salvarDestino} from './acervo';
import {CATEGORIAS_AVARIA, DESTINOS_PADRAO, destinosDe, ehCategoriaAvaria, rotuloCategoriaAvaria} from './avaria';
import {registrarDevolucao} from './emprestimos';
import {buscar, emprestimo, estadoDeTeste} from './estado-de-teste';
import {CategoriaAvaria} from '../../types/models';

function comEmprestimo(): ProtemState {
  const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
  s.itens[0] = {...s.itens[0], status: 'emprestado'};
  return s;
}

/** Item a1 já devolvido com avaria: em manutenção, com a ocorrência aberta. */
function comItemEmManutencao(categoria: CategoriaAvaria = 'quebrado'): ProtemState {
  return registrarDevolucao(comEmprestimo(), 'e', true, 'Placa-mãe queimada', 'resp', {categoriaAvaria: categoria}).estado;
}

/** O técnico já avaliou: sem conserto, então só resta encaminhar (a regra exige o laudo antes). */
function comLaudoSemConserto(): ProtemState {
  const s = comItemEmManutencao();
  return {
    ...s,
    ocorrencias: s.ocorrencias.map((o) => ({
      ...o,
      envioAoTecnico: {em: s.agora, porId: 'resp', laudoPrevistoEm: s.agora},
      laudo: {resultado: 'sem_conserto' as const, parecer: 'Sem conserto', em: s.agora},
    })),
  };
}

describe('avaria na devolução', () => {
  it('tem as quatro categorias pedidas', () => {
    expect(CATEGORIAS_AVARIA.map((c) => c.rotulo)).toEqual([
      'Avaria estética',
      'Avaria funcional leve',
      'Incompleto',
      'Quebrado / Inoperante',
    ]);
    expect(ehCategoriaAvaria('quebrado')).toBe(true);
    expect(ehCategoriaAvaria('outra')).toBe(false);
    expect(rotuloCategoriaAvaria(undefined)).toBe('Avaria sem categoria');
  });

  it.each(CATEGORIAS_AVARIA.map((c) => c.valor))('categoria "%s": guarda na ocorrência e leva o item à manutenção (RN07)', (categoria) => {
    const s = comItemEmManutencao(categoria);
    expect(buscar.item(s, 'a1').status).toBe('manutencao');
    expect(s.ocorrencias[0]).toMatchObject({categoria, descricao: 'Placa-mãe queimada', status: 'aberta'});
  });

  it('o tipo de avaria é obrigatório', () => {
    const s = comEmprestimo();
    const {estado, resultado} = registrarDevolucao(s, 'e', true, 'Tela trincada', 'resp');
    expect(resultado).toEqual({sucesso: false, mensagem: 'Escolha o tipo de avaria.'});
    expect(estado).toBe(s);
  });

  it.each(['', '   ', undefined])('a descrição é obrigatória ("%s")', (descricao) => {
    const s = comEmprestimo();
    const {estado, resultado} = registrarDevolucao(s, 'e', true, descricao, 'resp', {categoriaAvaria: 'estetica'});
    expect(resultado.sucesso).toBe(false);
    expect(resultado.mensagem).toContain('Descreva a avaria');
    expect(estado).toBe(s);
  });

  it('categoria inválida não passa', () => {
    const {resultado} = registrarDevolucao(comEmprestimo(), 'e', true, 'x', 'resp', {
      categoriaAvaria: 'qualquer' as CategoriaAvaria,
    });
    expect(resultado.sucesso).toBe(false);
  });

  it('sem avaria, o tipo não é pedido nem gravado', () => {
    const {estado, resultado} = registrarDevolucao(comEmprestimo(), 'e', false, undefined, 'resp', {categoriaAvaria: 'quebrado'});
    expect(resultado.sucesso).toBe(true);
    expect(estado.ocorrencias).toHaveLength(0);
  });

  it('a auditoria da devolução diz o tipo da avaria', () => {
    const evento = comItemEmManutencao('incompleto').auditoria.find((e) => e.tipo === 'devolucao_avaria')!;
    expect(evento.detalhe).toBe('Incompleto. No prazo');
    expect(evento.motivo).toBe('Placa-mãe queimada');
  });
});

describe('conserto', () => {
  it('fecha a ocorrência como consertada, devolve o item ao catálogo e registra quem fez', () => {
    const s = comItemEmManutencao();
    const depois = resolverOcorrencia(s, s.ocorrencias[0].id, true, 'resp');
    expect(depois.ocorrencias[0]).toMatchObject({status: 'resolvida', desfecho: 'consertado', resolvidoEm: s.agora});
    expect(buscar.item(depois, 'a1').status).toBe('disponivel');
    expect(depois.auditoria[0]).toMatchObject({tipo: 'item_consertado', autorId: 'resp', itemId: 'a1', afetadoId: 'aluna'});
  });
});

describe('encaminhar item sem conserto', () => {
  const DESTINO = 'dest-unifap-crc';

  it('o item sai do acervo, a ocorrência fecha e o destino fica no item e na auditoria', () => {
    const s = comLaudoSemConserto();
    const {estado, resultado} = encaminharItem(s, 'a1', 'resp', DESTINO, '  Placa-mãe queimada, sem conserto  ');
    expect(resultado).toEqual({sucesso: true, mensagem: '"Item a1" foi encaminhado para Unifap CRC.'});

    expect(buscar.item(estado, 'a1')).toMatchObject({
      status: 'encaminhado',
      encaminhamento: {
        destinoId: DESTINO,
        destinoNome: 'Unifap CRC',
        tipo: 'doacao',
        em: s.agora,
        porId: 'resp',
        motivo: 'Placa-mãe queimada, sem conserto',
      },
    });
    expect(estado.ocorrencias[0]).toMatchObject({status: 'resolvida', desfecho: 'encaminhado'});
    expect(estado.auditoria[0]).toMatchObject({
      tipo: 'item_encaminhado',
      autorId: 'resp',
      itemId: 'a1',
      afetadoId: 'aluna',
      motivo: 'Placa-mãe queimada, sem conserto',
      detalhe: 'Destino: Unifap CRC',
    });
  });

  it('o item encaminhado não volta ao catálogo', () => {
    const s = comLaudoSemConserto();
    const {estado} = encaminharItem(s, 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(estado.itens.filter((i) => i.status === 'disponivel').map((i) => i.id)).not.toContain('a1');
  });

  it.each([
    ['sem motivo', DESTINO, '  ', 'Informe o motivo do encaminhamento.'],
    ['sem destino', '', 'Sem conserto', 'Escolha o destino do item.'],
    ['destino que não existe', 'dest-xyz', 'Sem conserto', 'Escolha o destino do item.'],
  ])('não encaminha %s', (_nome, destino, motivo, mensagem) => {
    const s = comLaudoSemConserto();
    const {estado, resultado} = encaminharItem(s, 'a1', 'resp', destino, motivo);
    expect(resultado).toEqual({sucesso: false, mensagem});
    expect(estado).toBe(s);
  });

  it('só encaminha item que está em manutenção', () => {
    const s = estadoDeTeste();
    const {estado, resultado} = encaminharItem(s, 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(resultado.mensagem).toBe('Só item em manutenção pode ser encaminhado.');
    expect(estado).toBe(s);
    expect(encaminharItem(s, 'nao-existe', 'resp', DESTINO, 'x').resultado.mensagem).toBe('Item não encontrado.');
  });

  it('não encaminha duas vezes o mesmo item', () => {
    const {estado} = encaminharItem(comLaudoSemConserto(), 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(encaminharItem(estado, 'a1', 'resp', DESTINO, 'Sem conserto').resultado.sucesso).toBe(false);
  });

  it('item em manutenção sem ocorrência aberta também pode ser encaminhado (o afetado é o responsável)', () => {
    const s = estadoDeTeste();
    s.itens[0] = {...s.itens[0], status: 'manutencao'};
    const {estado, resultado} = encaminharItem(s, 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(resultado.sucesso).toBe(true);
    expect(estado.auditoria[0].afetadoId).toBe('resp');
  });
});

describe('destinos de encaminhamento', () => {
  it('sem lista salva, valem os três destinos padrão', () => {
    expect(destinosDe(estadoDeTeste().configuracao).map((d) => d.nome)).toEqual([
      'Unifap CRC',
      'SENAI Lab de recondicionamento',
      'SENAI Lab de aprendizado',
    ]);
  });

  it('inclui um destino novo sem perder os padrão', () => {
    const {estado, resultado} = salvarDestino(estadoDeTeste(), {nome: ' Oficina do bairro ', tipo: 'recondicionamento', descricao: 'Conserta eletrônicos'});
    expect(resultado.sucesso).toBe(true);
    const lista = destinosDe(estado.configuracao);
    expect(lista).toHaveLength(DESTINOS_PADRAO.length + 1);
    expect(lista[lista.length - 1]).toMatchObject({nome: 'Oficina do bairro', tipo: 'recondicionamento'});
  });

  it('exige nome e não repete nome', () => {
    const s = estadoDeTeste();
    expect(salvarDestino(s, {nome: '  ', tipo: 'doacao', descricao: ''}).resultado.sucesso).toBe(false);
    const repetido = salvarDestino(s, {nome: 'unifap crc', tipo: 'doacao', descricao: ''});
    expect(repetido.resultado.mensagem).toBe('Já existe um destino com esse nome.');
    expect(repetido.estado).toBe(s);
  });

  it('atualiza um destino que já existe', () => {
    const {estado} = salvarDestino(estadoDeTeste(), {id: 'dest-unifap-crc', nome: 'Unifap CRC (campus Marco Zero)', tipo: 'doacao', descricao: 'Novo texto'});
    const lista = destinosDe(estado.configuracao);
    expect(lista).toHaveLength(DESTINOS_PADRAO.length);
    expect(lista[0]).toMatchObject({id: 'dest-unifap-crc', nome: 'Unifap CRC (campus Marco Zero)'});
  });

  it('remove um destino, mas sempre sobra pelo menos um', () => {
    let s = estadoDeTeste();
    s = removerDestino(s, 'dest-senai-aprendizado').estado;
    s = removerDestino(s, 'dest-senai-recondicionamento').estado;
    expect(destinosDe(s.configuracao).map((d) => d.id)).toEqual(['dest-unifap-crc']);
    const ultimo = removerDestino(s, 'dest-unifap-crc');
    expect(ultimo.resultado.sucesso).toBe(false);
    expect(ultimo.estado).toBe(s);
    expect(removerDestino(s, 'nao-existe').resultado.mensagem).toBe('Destino não encontrado.');
  });

  it('item já encaminhado guarda o nome do destino, mesmo que ele seja removido depois', () => {
    let s = encaminharItem(comLaudoSemConserto(), 'a1', 'resp', 'dest-senai-aprendizado', 'Sem conserto').estado;
    s = removerDestino(s, 'dest-senai-aprendizado').estado;
    expect(buscar.item(s, 'a1').encaminhamento?.destinoNome).toBe('SENAI Lab de aprendizado');
  });
});
