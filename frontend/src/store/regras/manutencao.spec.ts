import {CategoriaAvaria, Ocorrencia} from '../../types/models';
import {ProtemState} from '../estado';
import {consertarItem, encaminharItem} from './acervo';
import {registrarDevolucao} from './emprestimos';
import {AGORA, buscar, emprestimo, estadoDeTeste} from './estado-de-teste';
import {
  PRAZO_LAUDO_HORAS,
  enviarParaTecnico,
  etapaDaOcorrencia,
  laudoSimulado,
  pendenciasDeManutencao,
  receberLaudos,
} from './manutencao';
import {executarRotinaAutomatica} from './rotina';

/** Item a1 devolvido com avaria: em manutenção, ocorrência aberta e ainda sem técnico. */
function comAvaria(categoria: CategoriaAvaria = 'quebrado'): ProtemState {
  const s = estadoDeTeste({emprestimos: [emprestimo('e', 'a1')]});
  s.itens[0] = {...s.itens[0], status: 'emprestado'};
  return registrarDevolucao(s, 'e', true, 'Tela trincada', 'resp', {categoriaAvaria: categoria}).estado;
}

const horasDepois = (s: ProtemState, horas: number) => new Date(new Date(s.agora).getTime() + horas * 3600_000);

/** Envia ao técnico e deixa o relógio passar do prazo, para o laudo chegar. */
function comLaudo(categoria: CategoriaAvaria = 'quebrado'): ProtemState {
  const base = comAvaria(categoria);
  const enviado = enviarParaTecnico(base, base.ocorrencias[0].id, 'resp').estado;
  return receberLaudos(enviado, horasDepois(enviado, PRAZO_LAUDO_HORAS));
}

const ocorrenciaId = (s: ProtemState) => s.ocorrencias[0].id;

describe('etapas da manutenção', () => {
  it('a ocorrência nasce aguardando envio; depois do envio, com o técnico; depois do laudo, no resultado', () => {
    const s = comAvaria();
    expect(etapaDaOcorrencia(s.ocorrencias[0])).toBe('aguardando_envio');
    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    expect(etapaDaOcorrencia(enviado.ocorrencias[0])).toBe('com_tecnico');
    expect(etapaDaOcorrencia(comLaudo('quebrado').ocorrencias[0])).toBe('laudo_sem_conserto');
    expect(etapaDaOcorrencia(comLaudo('estetica').ocorrencias[0])).toBe('laudo_arrumado');
  });

  it('ocorrência antiga, sem nenhum dos campos novos, conta como aguardando envio', () => {
    const antiga: Ocorrencia = {id: 'o', itemId: 'a1', usuarioId: 'aluna', descricao: 'x', status: 'aberta', criadoEm: AGORA.toISOString()};
    expect(etapaDaOcorrencia(antiga)).toBe('aguardando_envio');
  });
});

describe('enviar para o técnico', () => {
  it('guarda o envio, prevê o laudo para daqui a 24 h e grava na auditoria', () => {
    const s = comAvaria();
    const {estado, resultado} = enviarParaTecnico(s, ocorrenciaId(s), 'resp');
    expect(resultado.sucesso).toBe(true);
    expect(resultado.mensagem).toContain('"Item a1" foi enviado ao técnico');

    const envio = estado.ocorrencias[0].envioAoTecnico!;
    expect(envio).toMatchObject({em: s.agora, porId: 'resp'});
    expect(new Date(envio.laudoPrevistoEm).getTime() - new Date(s.agora).getTime()).toBe(PRAZO_LAUDO_HORAS * 3600_000);
    expect(estado.auditoria[0]).toMatchObject({tipo: 'item_enviado_tecnico', autorId: 'resp', itemId: 'a1', afetadoId: 'aluna'});
    // O item continua em manutenção: só a ocorrência mudou de etapa
    expect(buscar.item(estado, 'a1').status).toBe('manutencao');
  });

  it('não envia duas vezes, nem ocorrência que não existe ou já foi encerrada', () => {
    const s = comAvaria();
    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    const duas = enviarParaTecnico(enviado, ocorrenciaId(s), 'resp');
    expect(duas.resultado).toEqual({sucesso: false, mensagem: 'Este item já foi enviado ao técnico.'});
    expect(duas.estado).toBe(enviado);

    expect(enviarParaTecnico(s, 'nao-existe', 'resp').resultado.sucesso).toBe(false);
    const encerrada = {...s, ocorrencias: s.ocorrencias.map((o) => ({...o, status: 'resolvida' as const}))};
    expect(enviarParaTecnico(encerrada, ocorrenciaId(s), 'resp').resultado.sucesso).toBe(false);
  });
});

describe('laudo do técnico', () => {
  it('quebrado volta "sem conserto"; as outras categorias voltam "arrumado"', () => {
    expect(laudoSimulado(comAvaria('quebrado').ocorrencias[0]).resultado).toBe('sem_conserto');
    for (const categoria of ['estetica', 'funcional_leve', 'incompleto'] as const) {
      expect(laudoSimulado(comAvaria(categoria).ocorrencias[0]).resultado).toBe('arrumado');
    }
  });

  it('o parecer depende do estado do item e é sempre o mesmo para a mesma ocorrência', () => {
    const quebrado = comAvaria('quebrado').ocorrencias[0];
    expect(laudoSimulado(quebrado).parecer).toBe(laudoSimulado(quebrado).parecer);
    expect(laudoSimulado(quebrado).parecer).toMatch(/conserto|recuperar/i);
    expect(laudoSimulado(comAvaria('incompleto').ocorrencias[0]).parecer).toMatch(/repostos/);
    expect(laudoSimulado(comAvaria('estetica').ocorrencias[0]).parecer).toMatch(/visuais/);
  });

  it('antes do prazo nada acontece', () => {
    const s = comAvaria();
    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    const cedo = receberLaudos(enviado, horasDepois(enviado, PRAZO_LAUDO_HORAS - 1));
    expect(cedo).toBe(enviado);
  });

  it('no prazo, grava o laudo, avisa os responsáveis e registra o evento com a hora em que chegou', () => {
    const s = comLaudo('quebrado');
    const o = s.ocorrencias[0];
    expect(o.laudo).toMatchObject({resultado: 'sem_conserto', em: o.envioAoTecnico!.laudoPrevistoEm});

    const aviso = s.notificacoes.find((n) => n.tipo === 'laudo')!;
    expect(aviso.usuarioId).toBe('resp');
    expect(aviso.destino).toBe('/painel/manutencao');
    expect(aviso.mensagem).toContain('"Item a1"');
    expect(aviso.mensagem).toContain('não tem conserto');
    // Quem devolveu a peça não é avisado: o laudo é assunto do responsável
    expect(s.notificacoes.filter((n) => n.tipo === 'laudo').every((n) => n.usuarioId === 'resp')).toBe(true);

    const evento = s.auditoria.find((e) => e.tipo === 'laudo_tecnico')!;
    expect(evento).toMatchObject({itemId: 'a1', afetadoId: 'aluna', motivo: o.laudo!.parecer, em: o.laudo!.em});
    expect(evento.autorId).toBeUndefined();
    expect(evento.detalhe).toBe('Laudo do técnico: sem conserto');
  });

  it('o laudo "arrumado" avisa que o item está arrumado', () => {
    const s = comLaudo('funcional_leve');
    expect(s.notificacoes.find((n) => n.tipo === 'laudo')!.mensagem).toContain('está arrumado');
  });

  it('com o relógio pulando dias, o laudo é recuperado com a data em que chegaria', () => {
    const s = comAvaria();
    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    const depois = executarRotinaAutomatica(enviado, horasDepois(enviado, 24 * 5));
    const o = depois.ocorrencias[0];
    expect(o.laudo?.em).toBe(o.envioAoTecnico!.laudoPrevistoEm);
    // O evento do laudo fica depois do envio na linha do tempo (a lista é do mais recente para o mais antigo)
    const tipos = depois.auditoria.map((e) => e.tipo);
    expect(tipos.indexOf('laudo_tecnico')).toBeLessThan(tipos.indexOf('item_enviado_tecnico'));
  });

  it('é recebido uma vez só, mesmo que a rotina rode de novo', () => {
    const s = comLaudo();
    const de_novo = receberLaudos(s, horasDepois(s, 24 * 10));
    expect(de_novo).toBe(s);
    expect(s.auditoria.filter((e) => e.tipo === 'laudo_tecnico')).toHaveLength(1);
    expect(s.notificacoes.filter((n) => n.tipo === 'laudo')).toHaveLength(1);
  });

  it('a rotina automática recebe o laudo ao avançar o relógio', () => {
    const s = comAvaria('estetica');
    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    expect(executarRotinaAutomatica(enviado, horasDepois(enviado, 1)).ocorrencias[0].laudo).toBeUndefined();
    expect(executarRotinaAutomatica(enviado, horasDepois(enviado, 25)).ocorrencias[0].laudo?.resultado).toBe('arrumado');
  });
});

describe('marcar como consertado', () => {
  it('bloqueia antes de enviar ao técnico', () => {
    const s = comAvaria();
    const {estado, resultado} = consertarItem(s, ocorrenciaId(s), 'resp');
    expect(resultado).toEqual({sucesso: false, mensagem: 'Envie o item ao técnico antes de marcar como consertado.'});
    expect(estado).toBe(s);
  });

  it('bloqueia enquanto o item está com o técnico', () => {
    const base = comAvaria();
    const s = enviarParaTecnico(base, ocorrenciaId(base), 'resp').estado;
    const {estado, resultado} = consertarItem(s, ocorrenciaId(s), 'resp');
    expect(resultado).toEqual({sucesso: false, mensagem: 'Espere o laudo do técnico para marcar como consertado.'});
    expect(estado).toBe(s);
  });

  it('bloqueia com o laudo "sem conserto": só resta encaminhar', () => {
    const s = comLaudo('quebrado');
    const {estado, resultado} = consertarItem(s, ocorrenciaId(s), 'resp');
    expect(resultado).toEqual({sucesso: false, mensagem: 'O técnico avaliou que não há conserto. Encaminhe o item.'});
    expect(estado).toBe(s);
    expect(buscar.item(s, 'a1').status).toBe('manutencao');
  });

  it('com o laudo "arrumado", fecha a ocorrência, devolve o item ao catálogo e guarda o parecer na auditoria', () => {
    const s = comLaudo('funcional_leve');
    const {estado, resultado} = consertarItem(s, ocorrenciaId(s), 'resp');
    expect(resultado.sucesso).toBe(true);
    expect(buscar.item(estado, 'a1').status).toBe('disponivel');
    expect(estado.ocorrencias[0]).toMatchObject({status: 'resolvida', desfecho: 'consertado'});
    expect(estado.auditoria[0]).toMatchObject({tipo: 'item_consertado', autorId: 'resp', motivo: s.ocorrencias[0].laudo!.parecer});
  });
});

describe('encaminhar depois do laudo', () => {
  const DESTINO = 'dest-unifap-crc';

  it('só encaminha depois do laudo: antes do envio e com o técnico pedem a etapa certa', () => {
    const s = comAvaria();
    const cedo = encaminharItem(s, 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(cedo.resultado).toEqual({sucesso: false, mensagem: 'Envie o item ao técnico antes de encaminhar.'});
    expect(cedo.estado).toBe(s);

    const enviado = enviarParaTecnico(s, ocorrenciaId(s), 'resp').estado;
    const aguardando = encaminharItem(enviado, 'a1', 'resp', DESTINO, 'Sem conserto');
    expect(aguardando.resultado).toEqual({sucesso: false, mensagem: 'Espere o laudo do técnico antes de encaminhar.'});
    expect(buscar.item(aguardando.estado, 'a1').status).toBe('manutencao');
  });

  it.each(['quebrado', 'estetica'] as const)('com o laudo (%s), o encaminhamento vale', (categoria) => {
    const {estado, resultado} = encaminharItem(comLaudo(categoria), 'a1', 'resp', DESTINO, 'Decisão do responsável');
    expect(resultado.sucesso).toBe(true);
    expect(buscar.item(estado, 'a1').status).toBe('encaminhado');
  });
});

describe('o que espera o responsável', () => {
  it('conta item a enviar e laudo a decidir; item com o técnico não conta', () => {
    const aEnviar = comAvaria();
    expect(pendenciasDeManutencao(aEnviar.ocorrencias)).toBe(1);

    const comTecnico = enviarParaTecnico(aEnviar, ocorrenciaId(aEnviar), 'resp').estado;
    expect(pendenciasDeManutencao(comTecnico.ocorrencias)).toBe(0);

    expect(pendenciasDeManutencao(comLaudo().ocorrencias)).toBe(1);
  });

  it('ocorrência encerrada não conta', () => {
    const s = comLaudo('estetica');
    const depois = consertarItem(s, ocorrenciaId(s), 'resp').estado;
    expect(pendenciasDeManutencao(depois.ocorrencias)).toBe(0);
  });
});
