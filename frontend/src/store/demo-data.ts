import {ProtemState, novoEvento as evento} from './estado';
import {addDays, addHours, calculateDiasAtraso, formatDateShort, parseDate, toDateInputValue} from '../lib/date-utils';
import {
  Categoria,
  Emprestimo,
  EventoAuditoria,
  Item,
  Notificacao,
  Ocorrencia,
  Solicitacao,
  StatusItem,
  Usuario,
} from '../types/models';

/** Perfis do login: começam sem nenhum pedido, para mostrar o fluxo do zero. */
export const PERFIS_DEMO = ['user-camila', 'user-gusta', 'user-enzo'];

/**
 * As 10 personas, com o comportamento que cada uma mostra. Ficam no painel de demonstração
 * e alimentam o histórico, os relatórios e a auditoria. Todos os dados pessoais são
 * inventados: e-mail em example.com (domínio reservado), CPF com dígito verificador
 * errado de propósito e telefone (96) 90000-0XXX.
 */
export const PERSONAS_DEMO: {id: string; resumo: string}[] = [
  {id: 'user-ana', resumo: 'Pontual e exemplar'},
  {id: 'user-bruno', resumo: 'Atrasos recorrentes; bloqueado agora'},
  {id: 'user-carla', resumo: 'Devolveu com avaria'},
  {id: 'user-davi', resumo: 'Pedido recusado com motivo'},
  {id: 'user-elisa', resumo: 'Suspensa por atraso'},
  {id: 'user-fabio', resumo: 'Aprovado e não retirou (expirou)'},
  {id: 'user-gabriela', resumo: 'Muitos pedidos; no limite'},
  {id: 'user-helena', resumo: 'Suspensa pelo responsável'},
  {id: 'user-igor', resumo: 'Retira hoje (código K7PM4X)'},
  {id: 'user-diego', resumo: 'Recém-cadastrado; aguarda aprovação'},
];

const RESPONSAVEL = 'user-enzo';

/**
 * Estado inicial de demonstração. As datas são relativas ao relógio (hoje às 09:00), então
 * os dados nunca ficam defasados e "Reiniciar dados" restaura tudo.
 *
 * - Perfis do login (aluna, professor e responsável) sem histórico.
 * - 10 personas com situações diferentes; juntas cobrem todos os estados de item, pedido
 *   e conta, para nenhuma tela começar vazia.
 * - A auditoria é montada a partir desses registros (veja auditoriaDoSeed), então é
 *   coerente com o histórico.
 *
 * Os 15 itens são os mesmos da migration SeedItensDemonstracao do back-end. No modo api,
 * um navegador sem dados salvos envia este seed ao banco (veja FonteApi).
 */
export function getInitialDemoState(): ProtemState {
  // Relógio simulado começa hoje às 09:00
  const agora = new Date();
  agora.setHours(9, 0, 0, 0);

  /** Data e hora relativas a hoje (dias negativos = passado), em ISO. */
  const em = (dias: number, horas = 9, minutos = 0) => {
    const d = addDays(agora, dias);
    d.setHours(horas, minutos, 0, 0);
    return d.toISOString();
  };
  /** Dia do calendário relativo a hoje, no formato da data de devolução (AAAA-MM-DD). */
  const dia = (dias: number) => toDateInputValue(addDays(agora, dias));
  const agoraIso = agora.toISOString();
  const ha20Minutos = addHours(agora, -1 / 3).toISOString();
  const ha3Horas = addHours(agora, -3).toISOString();

  const usuarios: Usuario[] = [
    // Perfis do login
    usuario('user-enzo', 'Enzo Capiel', 'enzo@example.com', 'RESP-001', 'responsavel', em(-90)),
    usuario('user-gusta', 'Gustavo Machado', 'gustavo@example.com', 'PROF-001', 'professor', em(-60)),
    usuario('user-camila', 'Camila Cristina', 'camila@example.com', 'ALU-0001', 'aluno', em(-60)),
    // Personas
    persona('user-ana', 'Ana Beatriz Moura', 'ALU-0101', em(-60), 'Técnico em Informática', '482.917.305-31', '(96) 90000-0101'),
    {
      ...persona('user-bruno', 'Bruno Teixeira Lima', 'ALU-0102', em(-55), 'Técnico em Mecânica', '731.064.829-68', '(96) 90000-0102'),
      status: 'bloqueada', // Notebook Dell #2 atrasado (política rígida)
    },
    persona('user-carla', 'Carla Nogueira Prado', 'ALU-0103', em(-50), 'Técnico em Eletrônica', '206.358.471-35', '(96) 90000-0103'),
    persona('user-davi', 'Davi Ramos Quintela', 'ALU-0104', em(-45), 'Técnico em Química', '915.472.063-33', '(96) 90000-0104'),
    {
      ...persona('user-elisa', 'Elisa Rocha Fontes', 'ALU-0105', em(-50), 'Técnico em Mecânica', '364.829.150-88', '(96) 90000-0105'),
      // Devolveu o multímetro ontem com 3 dias de atraso: suspensa por 3 dias a partir da devolução
      status: 'suspensa',
      suspensoAte: em(2, 16),
    },
    persona('user-fabio', 'Fábio Mendes Arruda', 'ALU-0106', em(-40), 'Técnico em Automação Industrial', '587.203.946-10', '(96) 90000-0106'),
    persona('user-gabriela', 'Gabriela Sato Ribeiro', 'ALU-0107', em(-58), 'Técnico em Eletrônica', '129.650.384-79', '(96) 90000-0107'),
    {
      ...persona('user-helena', 'Helena Duarte Campos', 'ALU-0108', em(-48), 'Técnico em Química', '843.017.265-62', '(96) 90000-0108'),
      status: 'suspensa',
      suspensoAte: em(3, 14),
      restricaoManual: {
        motivo: 'Usou o laboratório de eletrônica fora do horário, sem autorização',
        porId: RESPONSAVEL,
        em: em(-2, 14),
      },
    },
    persona('user-igor', 'Igor Pacheco Leal', 'ALU-0109', em(-35), 'Técnico em Informática', '650.384.917-93', '(96) 90000-0109'),
    // Acabou de se cadastrar e espera aprovação (RN08)
    {
      ...persona('user-diego', 'Diego Alves Barreto', 'ALU-0110', ha20Minutos, 'Técnico em Eletrônica', '278.146.530-80', '(96) 90000-0110'),
      status: 'pendente',
    },
  ];

  const categorias: Categoria[] = [
    {
      id: 'cat-projetores',
      nome: 'Projetores',
      prazoMaxDias: 1,
      limitePorPessoa: 1,
      descricao: 'Projetores multimídia para apresentações e salas de aula.',
    },
    {
      id: 'cat-notebooks',
      nome: 'Notebooks',
      prazoMaxDias: 2,
      limitePorPessoa: 1,
      descricao: 'Computadores portáteis para atividades pedagógicas e acadêmicas.',
    },
    {
      id: 'cat-eletronica',
      nome: 'Kits de eletrônica',
      prazoMaxDias: 7,
      limitePorPessoa: 3,
      descricao: 'Plataformas de prototipagem Arduino, Raspberry Pi e componentes.',
    },
    {
      id: 'cat-ferramentas',
      nome: 'Ferramentas',
      prazoMaxDias: 2,
      limitePorPessoa: 2,
      descricao: 'Maletas manuais, parafusadeiras e equipamentos de bancada.',
    },
    {
      id: 'cat-laboratorio',
      nome: 'Instrumentos de laboratório',
      prazoMaxDias: 2,
      limitePorPessoa: 2,
      descricao: 'Microscópios, balanças de precisão e sensores laboratoriais.',
    },
  ];

  // Situação de hoje dos itens que não estão no catálogo; os demais estão disponíveis
  const situacaoHoje: Partial<Record<string, StatusItem>> = {
    'item-02': 'reservado', // Igor retira hoje
    'item-03': 'emprestado', // Com a Ana, devolução amanhã
    'item-04': 'atrasado', // Com o Bruno, venceu há 2 dias
    'item-06': 'solicitado', // Pedido da Gabriela há 3 h (já libera o lembrete)
    'item-08': 'solicitado', // Pedido da Gabriela há 20 min
    'item-09': 'emprestado', // Com a Gabriela
    'item-11': 'manutencao', // A Carla devolveu com avaria
  };

  // 15 itens com patrimônio NX-000X e QR legível NX-XXXX-00X
  const itens: Item[] = [
    ['item-01', 'cat-projetores', 'Projetor Epson PowerLite W42', 'Projetor WXGA 3600 lumens com entrada HDMI e VGA.', 'NX-0001', 'NX-PROJ-001'],
    ['item-02', 'cat-projetores', 'Projetor BenQ MW560', 'Projetor 4000 lumens de alto contraste para auditório.', 'NX-0002', 'NX-PROJ-002'],
    ['item-03', 'cat-notebooks', 'Notebook Dell Latitude 3420 #1', 'Intel Core i5 11ª Gen, 16GB RAM, SSD 256GB, tela 14".', 'NX-0003', 'NX-NOTE-001'],
    ['item-04', 'cat-notebooks', 'Notebook Dell Latitude 3420 #2', 'Intel Core i5 11ª Gen, 16GB RAM, SSD 256GB, tela 14".', 'NX-0004', 'NX-NOTE-002'],
    ['item-05', 'cat-notebooks', 'Notebook Lenovo ThinkPad E14', 'AMD Ryzen 5, 16GB RAM, SSD 512GB, teclado retroiluminado.', 'NX-0005', 'NX-NOTE-003'],
    ['item-06', 'cat-eletronica', 'Kit Arduino Iniciante #1', 'Placa Uno R3 com cabos, protoboard, LEDs e sensores.', 'NX-0006', 'NX-ELET-001'],
    ['item-07', 'cat-eletronica', 'Kit Arduino Iniciante #2', 'Placa Uno R3 com kit avançado de servos e displays.', 'NX-0007', 'NX-ELET-002'],
    ['item-08', 'cat-eletronica', 'Kit Raspberry Pi 4 Model B', 'Mini PC 4GB RAM com cartão microSD 64GB e fonte oficial.', 'NX-0008', 'NX-ELET-003'],
    ['item-09', 'cat-eletronica', 'Kit Sensores e Robótica', 'Chassi 2WD com motores DC, ponte H e sensor ultrassônico.', 'NX-0009', 'NX-ELET-004'],
    ['item-10', 'cat-ferramentas', 'Maleta de Ferramentas Gedore', '65 peças com chaves combinadas, alicates e soquetes.', 'NX-0010', 'NX-FERR-001'],
    ['item-11', 'cat-ferramentas', 'Parafusadeira Bosch 12V', 'Parafusadeira/Furadeira sem fio com bateria e carregador.', 'NX-0011', 'NX-FERR-002'],
    ['item-12', 'cat-ferramentas', 'Multímetro Digital Minipa', 'True RMS com pontas de prova e medição de capacitância.', 'NX-0012', 'NX-FERR-003'],
    ['item-13', 'cat-laboratorio', 'Microscópio Biológico Binocular', 'Aumento até 1000x, iluminação LED e objetivas acromáticas.', 'NX-0013', 'NX-LAB-001'],
    ['item-14', 'cat-laboratorio', 'Balança Analítica de Precisão', 'Capacidade 220g com precisão de 0,0001g (4 casas decimais).', 'NX-0014', 'NX-LAB-002'],
    ['item-15', 'cat-laboratorio', 'Medidor de pH de Bancada', 'pHmetro microprocessado com eletrodo de vidro e soluções tampão.', 'NX-0015', 'NX-LAB-003'],
  ].map(([id, categoriaId, nome, descricao, patrimonio, codigoQr]) => ({
    id,
    categoriaId,
    nome,
    descricao,
    patrimonio,
    codigoQr,
    status: situacaoHoje[id] ?? 'disponivel',
  }));

  const solicitacoes: Solicitacao[] = [];
  const emprestimos: Emprestimo[] = [];
  const ocorrencias: Ocorrencia[] = [];

  /**
   * Um pedido que foi aprovado e retirado 30 min depois, devolvido ou ainda em andamento.
   * Pedido às `hora`, aprovação 20 min depois, retirada 1 h depois. Dias relativos a hoje.
   */
  const emprestou = (
    n: string,
    pessoa: string,
    itemId: string,
    o: {pedido: number; hora?: number; prazo: number; devolvido?: [number, number]; avaria?: string},
  ) => {
    const hora = o.hora ?? 9;
    const solId = `solic-${n}`;
    const empId = `emp-${n}`;
    solicitacoes.push({
      id: solId,
      solicitanteId: pessoa,
      itemId,
      avaliadoPor: RESPONSAVEL,
      devolucaoDesejada: dia(o.prazo),
      status: 'concluida',
      criadoEm: em(o.pedido, hora),
      avaliadoEm: em(o.pedido, hora, 20),
    });
    const devolvidoEm = o.devolvido ? em(o.devolvido[0], o.devolvido[1]) : undefined;
    const fim = devolvidoEm ? parseDate(devolvidoEm) : agora;
    emprestimos.push({
      id: empId,
      solicitacaoId: solId,
      itemId,
      usuarioId: pessoa,
      registradoPor: RESPONSAVEL,
      retiradoEm: em(o.pedido, hora + 1),
      devolucaoPrevista: dia(o.prazo),
      ...(devolvidoEm ? {devolvidoEm} : {}),
      diasAtraso: calculateDiasAtraso(dia(o.prazo), fim),
    });
    if (o.avaria && devolvidoEm) {
      ocorrencias.push({
        id: `ocorr-${n}`,
        emprestimoId: empId,
        itemId,
        usuarioId: pessoa,
        descricao: o.avaria,
        status: 'aberta',
        criadoEm: devolvidoEm,
      });
    }
  };

  // Ana: pontual e exemplar
  emprestou('a1', 'user-ana', 'item-13', {pedido: -40, prazo: -39, devolvido: [-39, 15]});
  emprestou('a2', 'user-ana', 'item-07', {pedido: -30, prazo: -25, devolvido: [-26, 16]});
  emprestou('a3', 'user-ana', 'item-01', {pedido: -20, hora: 8, prazo: -19, devolvido: [-20, 17]});
  emprestou('a4', 'user-ana', 'item-14', {pedido: -12, prazo: -11, devolvido: [-11, 11]});
  emprestou('a5', 'user-ana', 'item-03', {pedido: -1, prazo: 1}); // em andamento, devolve amanhã

  // Bruno: atrasa sempre; hoje está com um notebook atrasado e a conta bloqueada
  emprestou('b1', 'user-bruno', 'item-12', {pedido: -35, prazo: -33, devolvido: [-32, 14]});
  emprestou('b2', 'user-bruno', 'item-10', {pedido: -20, prazo: -18, devolvido: [-16, 10]});
  emprestou('b3', 'user-bruno', 'item-04', {pedido: -4, hora: 10, prazo: -2});

  // Carla: devolveu a parafusadeira ontem, no prazo, com avaria
  emprestou('c1', 'user-carla', 'item-05', {pedido: -25, prazo: -23, devolvido: [-23, 16]});
  emprestou('c2', 'user-carla', 'item-11', {
    pedido: -3,
    hora: 8,
    prazo: -1,
    devolvido: [-1, 16],
    avaria: 'Mandril travado ao fixar broca de 8 mm; motor esquentando.',
  });

  // Davi: um empréstimo tranquilo e um pedido recusado
  emprestou('d1', 'user-davi', 'item-15', {pedido: -18, prazo: -17, devolvido: [-17, 12]});
  solicitacoes.push({
    id: 'solic-d2',
    solicitanteId: 'user-davi',
    itemId: 'item-05',
    avaliadoPor: RESPONSAVEL,
    devolucaoDesejada: dia(-1),
    status: 'recusada',
    criadoEm: em(-3, 10),
    avaliadoEm: em(-3, 11),
    motivoRecusa: 'Notebook reservado para a aula de robótica desta semana',
  });

  // Elisa: devolveu o multímetro ontem com 3 dias de atraso (suspensa pela política rígida)
  emprestou('e1', 'user-elisa', 'item-07', {pedido: -22, prazo: -18, devolvido: [-18, 10]});
  emprestou('e2', 'user-elisa', 'item-12', {pedido: -6, hora: 8, prazo: -4, devolvido: [-1, 16]});

  // Fábio: pedidos aprovados que expiraram porque ele não foi retirar (RN04)
  emprestou('f1', 'user-fabio', 'item-10', {pedido: -28, prazo: -27, devolvido: [-27, 15]});
  solicitacoes.push(expirada('solic-f2', 'user-fabio', 'item-01', dia(-7), em(-8, 9), em(-8, 9, 30)));
  solicitacoes.push(expirada('solic-f3', 'user-fabio', 'item-13', dia(-1), em(-2, 13), em(-2, 13, 20)));

  // Gabriela: pede muito; está no limite de kits de eletrônica (1 emprestado + 2 pendentes)
  emprestou('g1', 'user-gabriela', 'item-08', {pedido: -45, prazo: -40, devolvido: [-41, 15]});
  emprestou('g2', 'user-gabriela', 'item-06', {pedido: -33, prazo: -28, devolvido: [-29, 15]});
  emprestou('g3', 'user-gabriela', 'item-09', {pedido: -15, prazo: -9, devolvido: [-10, 15]});
  solicitacoes.push({
    id: 'solic-g4',
    solicitanteId: 'user-gabriela',
    itemId: 'item-14',
    avaliadoPor: RESPONSAVEL,
    devolucaoDesejada: dia(-8),
    status: 'recusada',
    criadoEm: em(-9, 10),
    avaliadoEm: em(-9, 10, 40),
    motivoRecusa: 'Balança reservada para a prova prática de Química',
  });
  emprestou('g5', 'user-gabriela', 'item-09', {pedido: -2, hora: 10, prazo: 4});
  solicitacoes.push(
    {id: 'solic-g6', solicitanteId: 'user-gabriela', itemId: 'item-06', devolucaoDesejada: dia(7), status: 'pendente', criadoEm: ha3Horas},
    {id: 'solic-g7', solicitanteId: 'user-gabriela', itemId: 'item-08', devolucaoDesejada: dia(3), status: 'pendente', criadoEm: ha20Minutos},
  );

  // Helena: empréstimos em dia, mas suspensa pelo responsável há 2 dias (por 5 dias)
  emprestou('h1', 'user-helena', 'item-15', {pedido: -14, prazo: -13, devolvido: [-13, 10]});
  emprestou('h2', 'user-helena', 'item-07', {pedido: -10, prazo: -5, devolvido: [-6, 14]});

  // Igor: pedido aprovado hoje, retira com o código K7PM4X
  emprestou('i1', 'user-igor', 'item-05', {pedido: -12, prazo: -10, devolvido: [-11, 10]});
  solicitacoes.push({
    id: 'solic-i2',
    solicitanteId: 'user-igor',
    itemId: 'item-02',
    avaliadoPor: RESPONSAVEL,
    devolucaoDesejada: dia(1),
    status: 'aprovada',
    criadoEm: em(0, 8, 10),
    avaliadoEm: em(0, 8, 30),
    codigoRetirada: 'K7PM4X',
  });

  // Avisos de atraso e de prazo próximo são gerados pela rotina automática ao carregar
  const notificacoes: Notificacao[] = [
    aviso('user-enzo', 'novo_pedido', 'Gabriela Sato Ribeiro solicitou o empréstimo de: Kit Raspberry Pi 4 Model B.', ha20Minutos, '/painel/solicitacoes'),
    aviso('user-enzo', 'nova_conta', 'Nova conta de aluno: Diego Alves Barreto aguarda aprovação.', ha20Minutos, '/painel/contas'),
    aviso('user-enzo', 'novo_pedido', 'Gabriela Sato Ribeiro solicitou o empréstimo de: Kit Arduino Iniciante #1.', ha3Horas, '/painel/solicitacoes', true),
    aviso(
      'user-igor',
      'aprovacao',
      'Seu pedido para "Projetor BenQ MW560" foi APROVADO! Realize a retirada hoje no setor responsável com o código K7PM4X.',
      em(0, 8, 30),
      '/meus-emprestimos',
    ),
    aviso(
      'user-davi',
      'recusa',
      'Seu pedido para "Notebook Lenovo ThinkPad E14" não foi aprovado. Motivo: Notebook reservado para a aula de robótica desta semana',
      em(-3, 11),
      '/meus-emprestimos',
      true,
    ),
    aviso(
      'user-carla',
      'aprovacao',
      'A devolução de "Parafusadeira Bosch 12V" foi confirmada pelo responsável. O item foi encaminhado para manutenção com registro de ocorrência.',
      em(-1, 16),
      '/meus-emprestimos',
    ),
    aviso(
      'user-elisa',
      'aprovacao',
      `A devolução de "Multímetro Digital Minipa" foi confirmada pelo responsável. Pela política rígida, a conta foi suspensa até ${formatDateShort(em(2, 16))}.`,
      em(-1, 16),
      '/meus-emprestimos',
    ),
    aviso(
      'user-helena',
      'recusa',
      `Sua conta foi suspensa por 5 dias, até ${formatDateShort(em(3, 14))}. Motivo: Usou o laboratório de eletrônica fora do horário, sem autorização`,
      em(-2, 14),
      '/perfil',
    ),
    aviso('user-fabio', 'expiracao', 'Seu pedido aprovado expirou porque a retirada não foi realizada no mesmo dia.', em(-1, 0), '/meus-emprestimos'),
  ].map((n, i) => ({...n, id: `notif-${String(i + 1).padStart(2, '0')}`}));

  const estado: ProtemState = {
    agora: agoraIso,
    usuarioLogadoId: '',
    configuracao: {
      politicaAtraso: 'rigida',
    },
    usuarios,
    categorias,
    itens,
    solicitacoes: ordenarPorData(solicitacoes, (s) => s.criadoEm),
    emprestimos: ordenarPorData(emprestimos, (e) => e.retiradoEm),
    ocorrencias,
    notificacoes,
    auditoria: [],
  };
  return {
    ...estado,
    auditoria: auditoriaDoSeed(estado, [
      // A única ação manual que não sai dos pedidos e empréstimos
      evento('conta_suspensa', em(-2, 14), 'user-helena', {
        autorId: RESPONSAVEL,
        motivo: 'Usou o laboratório de eletrônica fora do horário, sem autorização',
        detalhe: `5 dias, até ${formatDateShort(em(3, 14))}`,
      }),
    ]),
  };
}

/**
 * Monta a auditoria a partir dos registros do seed, com os mesmos eventos que as regras
 * gravariam: cadastro e aprovação de cada conta, pedidos, aprovações, recusas, expirações,
 * retiradas, devoluções e, na política rígida, bloqueio no atraso, suspensão na devolução
 * atrasada e reativação quando a suspensão termina. Só entra o que já aconteceu.
 */
function auditoriaDoSeed(s: ProtemState, extras: EventoAuditoria[]): EventoAuditoria[] {
  const agora = parseDate(s.agora).getTime();
  const nomeItem = (id: string) => s.itens.find((i) => i.id === id)?.nome ?? 'o item';
  const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
  /** Meia-noite do dia seguinte ao informado (fim do dia da aprovação ou do prazo). */
  const fimDoDia = (iso: string) => {
    const d = parseDate(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  };
  const eventos: EventoAuditoria[] = [...extras];

  for (const u of s.usuarios) {
    if (u.perfil === 'responsavel') continue;
    eventos.push(evento('conta_cadastrada', u.criadoEm, u.id, {autorId: u.id}));
    if (u.status !== 'pendente') {
      eventos.push(evento('conta_aprovada', addHours(parseDate(u.criadoEm), 2).toISOString(), u.id, {autorId: RESPONSAVEL}));
    }
  }

  for (const sol of s.solicitacoes) {
    const base = {itemId: sol.itemId};
    eventos.push(evento('pedido_criado', sol.criadoEm, sol.solicitanteId, {...base, autorId: sol.solicitanteId}));
    if (!sol.avaliadoEm) continue;
    if (sol.status === 'recusada') {
      eventos.push(evento('pedido_recusado', sol.avaliadoEm, sol.solicitanteId, {...base, autorId: sol.avaliadoPor, motivo: sol.motivoRecusa}));
      continue;
    }
    eventos.push(evento('pedido_aprovado', sol.avaliadoEm, sol.solicitanteId, {...base, autorId: sol.avaliadoPor}));
    if (sol.status === 'expirada') {
      eventos.push(evento('pedido_expirado', fimDoDia(sol.avaliadoEm), sol.solicitanteId, {...base, motivo: 'Não foi retirado no dia da aprovação'}));
    }
  }

  for (const e of s.emprestimos) {
    const base = {itemId: e.itemId};
    eventos.push(
      evento('retirada', e.retiradoEm, e.usuarioId, {
        ...base,
        autorId: e.registradoPor,
        detalhe: `Devolução prevista para ${formatDateShort(e.devolucaoPrevista)}`,
      }),
    );
    if (e.diasAtraso > 0) {
      eventos.push(evento('conta_bloqueada', fimDoDia(e.devolucaoPrevista), e.usuarioId, {...base, motivo: 'Atraso na devolução (política rígida)'}));
    }
    if (!e.devolvidoEm) continue;

    const avaria = s.ocorrencias.find((o) => o.emprestimoId === e.id);
    eventos.push(
      evento(avaria ? 'devolucao_avaria' : 'devolucao', e.devolvidoEm, e.usuarioId, {
        ...base,
        autorId: RESPONSAVEL,
        motivo: avaria?.descricao,
        detalhe: e.diasAtraso > 0 ? `${dias(e.diasAtraso)} de atraso` : 'No prazo',
      }),
    );
    if (e.diasAtraso > 0) {
      const fim = addDays(parseDate(e.devolvidoEm), e.diasAtraso);
      eventos.push(
        evento('conta_suspensa', e.devolvidoEm, e.usuarioId, {
          motivo: `Devolveu "${nomeItem(e.itemId)}" com ${e.diasAtraso} dia(s) de atraso (política rígida)`,
          detalhe: `${dias(e.diasAtraso)}, até ${formatDateShort(fim)}`,
        }),
        evento('conta_reativada', fim.toISOString(), e.usuarioId, {motivo: 'Fim do período de suspensão'}),
      );
    }
  }

  return eventos
    .filter((e) => parseDate(e.em).getTime() <= agora)
    .sort((a, b) => b.em.localeCompare(a.em))
    .map((e, i, todos) => ({...e, id: `aud-seed-${String(todos.length - i).padStart(3, '0')}`}));
}

function usuario(
  id: string,
  nome: string,
  email: string,
  matricula: string,
  perfil: Usuario['perfil'],
  criadoEm: string,
): Usuario {
  return {id, nome, email, matricula, senha: '123456', perfil, status: 'ativa', criadoEm};
}

/** Aluno fictício: e-mail nome.sobrenome@example.com a partir do primeiro e do último nome. */
function persona(
  id: string,
  nome: string,
  matricula: string,
  criadoEm: string,
  curso: string,
  cpf: string,
  telefone: string,
): Usuario {
  const partes = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(' ');
  const email = `${partes[0]}.${partes[partes.length - 1]}@example.com`;
  return {...usuario(id, nome, email, matricula, 'aluno', criadoEm), curso, cpf, telefone};
}

function expirada(
  id: string,
  solicitanteId: string,
  itemId: string,
  devolucaoDesejada: string,
  criadoEm: string,
  avaliadoEm: string,
): Solicitacao {
  return {id, solicitanteId, itemId, avaliadoPor: RESPONSAVEL, devolucaoDesejada, status: 'expirada', criadoEm, avaliadoEm};
}

function aviso(
  usuarioId: string,
  tipo: Notificacao['tipo'],
  mensagem: string,
  criadoEm: string,
  destino: string,
  lida = false,
): Omit<Notificacao, 'id'> {
  return {usuarioId, tipo, mensagem, lida, criadoEm, destino};
}

/** Mais recente primeiro, como as regras gravam. */
function ordenarPorData<T>(lista: T[], data: (x: T) => string): T[] {
  return [...lista].sort((a, b) => data(b).localeCompare(data(a)));
}
