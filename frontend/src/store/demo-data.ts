import {ProtemState} from './estado';
import {addDays, addHours, toDateInputValue} from '../lib/date-utils';
import {Categoria, Emprestimo, Item, Notificacao, Ocorrencia, Solicitacao, Usuario} from '../types/models';

/**
 * Estado inicial de demonstração, com dados fictícios e uma situação de cada tipo
 * para nenhuma tela começar vazia:
 * - contas: responsável, professor e aluna ativos; aluno bloqueado (atraso), aluna
 *   suspensa (devolveu atrasado) e aluno com cadastro pendente;
 * - pedidos: dois pendentes (um já libera o lembrete da RN10), um aprovado esperando
 *   retirada hoje, um recusado, um expirado e o histórico dos concluídos;
 * - empréstimos: um ativo com prazo amanhã, um atrasado e quatro devolvidos;
 * - um item em manutenção, com ocorrência aberta.
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
    usuario('user-enzo', 'Enzo Capiel', 'enzo@escola.edu.br', 'RESP-001', 'responsavel', em(-30)),
    usuario('user-gusta', 'Gustavo Machado', 'gustavo@escola.edu.br', 'PROF-001', 'professor',  em(-30)),
    usuario('user-camila',
            'Camila Cristina',
            'camila@escola.edu.br',
            'ALU-0001',
            'aluno',
            em(-30)),
    // Bloqueado pela política rígida: está com o Notebook Dell #2 atrasado
    {...usuario('user-bruno', 'Bruno Lima', 'bruno.lima@escola.edu.br', 'ALU-0002', 'aluno',  em(-20)), status: 'bloqueada'},
    // Devolveu a parafusadeira ontem com 3 dias de atraso: suspensa por 3 dias a partir da devolução
    {
      ...usuario('user-elisa', 'Elisa Rocha', 'elisa.rocha@escola.edu.br', 'ALU-0003', 'aluno',  em(-20)),
      status: 'suspensa',
      suspensoAte: em(2, 16),
    },
    // Acabou de se cadastrar e espera aprovação (RN08)
    {...usuario('user-diego', 'Diego Alves', 'diego.alves@escola.edu.br', 'ALU-0004', 'aluno',  ha20Minutos), status: 'pendente'},
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

  // 15 itens com patrimônio NX-000X e QR legível NX-XXXX-00X
  const itens: Item[] = [
    {
      id: 'item-01',
      categoriaId: 'cat-projetores',
      nome: 'Projetor Epson PowerLite W42',
      descricao: 'Projetor WXGA 3600 lumens com entrada HDMI e VGA.',
      patrimonio: 'NX-0001',
      codigoQr: 'NX-PROJ-001',
      status: 'disponivel',
    },
    {
      id: 'item-02',
      categoriaId: 'cat-projetores',
      nome: 'Projetor BenQ MW560',
      descricao: 'Projetor 4000 lumens de alto contraste para auditório.',
      patrimonio: 'NX-0002',
      codigoQr: 'NX-PROJ-002',
      status: 'reservado', // Pedido do Gustavo aprovado hoje, aguardando retirada
    },
    {
      id: 'item-03',
      categoriaId: 'cat-notebooks',
      nome: 'Notebook Dell Latitude 3420 #1',
      descricao: 'Intel Core i5 11ª Gen, 16GB RAM, SSD 256GB, tela 14".',
      patrimonio: 'NX-0003',
      codigoQr: 'NX-NOTE-001',
      status: 'emprestado', // Com a Camila, devolução amanhã
    },
    {
      id: 'item-04',
      categoriaId: 'cat-notebooks',
      nome: 'Notebook Dell Latitude 3420 #2',
      descricao: 'Intel Core i5 11ª Gen, 16GB RAM, SSD 256GB, tela 14".',
      patrimonio: 'NX-0004',
      codigoQr: 'NX-NOTE-002',
      status: 'atrasado', // Com o Bruno, venceu há 2 dias
    },
    {
      id: 'item-05',
      categoriaId: 'cat-notebooks',
      nome: 'Notebook Lenovo ThinkPad E14',
      descricao: 'AMD Ryzen 5, 16GB RAM, SSD 512GB, teclado retroiluminado.',
      patrimonio: 'NX-0005',
      codigoQr: 'NX-NOTE-003',
      status: 'disponivel',
    },
    {
      id: 'item-06',
      categoriaId: 'cat-eletronica',
      nome: 'Kit Arduino Iniciante #1',
      descricao: 'Placa Uno R3 com cabos, protoboard, LEDs e sensores.',
      patrimonio: 'NX-0006',
      codigoQr: 'NX-ELET-001',
      status: 'solicitado', // Pedido do Gustavo há 3 h (já libera o lembrete)
    },
    {
      id: 'item-07',
      categoriaId: 'cat-eletronica',
      nome: 'Kit Arduino Iniciante #2',
      descricao: 'Placa Uno R3 com kit avançado de servos e displays.',
      patrimonio: 'NX-0007',
      codigoQr: 'NX-ELET-002',
      status: 'disponivel',
    },
    {
      id: 'item-08',
      categoriaId: 'cat-eletronica',
      nome: 'Kit Raspberry Pi 4 Model B',
      descricao: 'Mini PC 4GB RAM com cartão microSD 64GB e fonte oficial.',
      patrimonio: 'NX-0008',
      codigoQr: 'NX-ELET-003',
      status: 'solicitado', // Pedido da Camila há 20 min
    },
    {
      id: 'item-09',
      categoriaId: 'cat-eletronica',
      nome: 'Kit Sensores e Robótica',
      descricao: 'Chassi 2WD com motores DC, ponte H e sensor ultrassônico.',
      patrimonio: 'NX-0009',
      codigoQr: 'NX-ELET-004',
      status: 'disponivel',
    },
    {
      id: 'item-10',
      categoriaId: 'cat-ferramentas',
      nome: 'Maleta de Ferramentas Gedore',
      descricao: '65 peças com chaves combinadas, alicates e soquetes.',
      patrimonio: 'NX-0010',
      codigoQr: 'NX-FERR-001',
      status: 'disponivel',
    },
    {
      id: 'item-11',
      categoriaId: 'cat-ferramentas',
      nome: 'Parafusadeira Bosch 12V',
      descricao: 'Parafusadeira/Furadeira sem fio com bateria e carregador.',
      patrimonio: 'NX-0011',
      codigoQr: 'NX-FERR-002',
      status: 'manutencao', // Voltou com avaria (ocorrência aberta)
    },
    {
      id: 'item-12',
      categoriaId: 'cat-ferramentas',
      nome: 'Multímetro Digital Minipa',
      descricao: 'True RMS com pontas de prova e medição de capacitância.',
      patrimonio: 'NX-0012',
      codigoQr: 'NX-FERR-003',
      status: 'disponivel',
    },
    {
      id: 'item-13',
      categoriaId: 'cat-laboratorio',
      nome: 'Microscópio Biológico Binocular',
      descricao: 'Aumento até 1000x, iluminação LED e objetivas acromáticas.',
      patrimonio: 'NX-0013',
      codigoQr: 'NX-LAB-001',
      status: 'disponivel',
    },
    {
      id: 'item-14',
      categoriaId: 'cat-laboratorio',
      nome: 'Balança Analítica de Precisão',
      descricao: 'Capacidade 220g com precisão de 0,0001g (4 casas decimais).',
      patrimonio: 'NX-0014',
      codigoQr: 'NX-LAB-002',
      status: 'disponivel',
    },
    {
      id: 'item-15',
      categoriaId: 'cat-laboratorio',
      nome: 'Medidor de pH de Bancada',
      descricao: 'pHmetro microprocessado com eletrodo de vidro e soluções tampão.',
      patrimonio: 'NX-0015',
      codigoQr: 'NX-LAB-003',
      status: 'disponivel',
    },
  ];

  const solicitacoes: Solicitacao[] = [
    // Em aberto
    {
      id: 'solic-01',
      solicitanteId: 'user-gusta',
      itemId: 'item-02',
      avaliadoPor: 'user-enzo',
      devolucaoDesejada: dia(1),
      status: 'aprovada',
      criadoEm: em(0, 8, 10),
      avaliadoEm: em(0, 8, 30),
      codigoRetirada: 'K7PM4X',
    },
    {
      id: 'solic-02',
      solicitanteId: 'user-gusta',
      itemId: 'item-06',
      devolucaoDesejada: dia(7),
      status: 'pendente',
      criadoEm: ha3Horas,
    },
    {
      id: 'solic-03',
      solicitanteId: 'user-camila',
      itemId: 'item-08',
      devolucaoDesejada: dia(3),
      status: 'pendente',
      criadoEm: ha20Minutos,
    },
    // Histórico
    concluida('solic-04', 'user-camila', 'item-03', dia(1), em(-1, 9, 15), em(-1, 9, 40)),
    concluida('solic-05', 'user-bruno', 'item-04', dia(-2), em(-4, 10), em(-4, 10, 30)),
    concluida('solic-06', 'user-gusta', 'item-13', dia(-8), em(-10, 8), em(-10, 8, 20)),
    concluida('solic-07', 'user-camila', 'item-10', dia(-5), em(-7, 14), em(-7, 14, 30)),
    concluida('solic-08', 'user-elisa', 'item-11', dia(-4), em(-6, 8), em(-6, 8, 15)),
    concluida('solic-09', 'user-bruno', 'item-12', dia(-11), em(-12, 13), em(-12, 13, 10)),
    {
      id: 'solic-10',
      solicitanteId: 'user-camila',
      itemId: 'item-05',
      avaliadoPor: 'user-enzo',
      devolucaoDesejada: dia(-1),
      status: 'recusada',
      criadoEm: em(-3, 10),
      avaliadoEm: em(-3, 11),
    },
    {
      id: 'solic-11',
      solicitanteId: 'user-bruno',
      itemId: 'item-01',
      avaliadoPor: 'user-enzo',
      devolucaoDesejada: dia(-7),
      status: 'expirada',
      criadoEm: em(-8, 9),
      avaliadoEm: em(-8, 9, 30),
    },
  ];

  const emprestimos: Emprestimo[] = [
    // Ativo: prazo amanhã (a rotina gera o aviso de prazo próximo)
    emprestimo('emp-01', 'solic-04', 'item-03', 'user-camila', em(-1, 10), dia(1)),
    // Atrasado: venceu há 2 dias
    {...emprestimo('emp-02', 'solic-05', 'item-04', 'user-bruno', em(-4, 11), dia(-2)), diasAtraso: 2},
    // Devolvidos
    {...emprestimo('emp-03', 'solic-06', 'item-13', 'user-gusta', em(-10, 9), dia(-8)), devolvidoEm: em(-8, 15)},
    {...emprestimo('emp-04', 'solic-07', 'item-10', 'user-camila', em(-7, 15), dia(-5)), devolvidoEm: em(-5, 10)},
    {...emprestimo('emp-05', 'solic-09', 'item-12', 'user-bruno', em(-12, 14), dia(-11)), devolvidoEm: em(-11, 16)},
    // Devolvido ontem com 3 dias de atraso e avaria: gerou a ocorrência e a suspensão da Elisa
    {
      ...emprestimo('emp-06', 'solic-08', 'item-11', 'user-elisa', em(-6, 9), dia(-4)),
      devolvidoEm: em(-1, 16),
      diasAtraso: 3,
    },
  ];

  const ocorrencias: Ocorrencia[] = [
    {
      id: 'ocorr-01',
      emprestimoId: 'emp-06',
      itemId: 'item-11',
      usuarioId: 'user-elisa',
      descricao: 'Mandril travado ao fixar broca de 8 mm; motor esquentando.',
      status: 'aberta',
      criadoEm: em(-1, 16),
    },
  ];

  // Avisos de atraso e de prazo próximo são gerados pela rotina automática ao carregar
  const notificacoes: Notificacao[] = [
    aviso('notif-01', 'user-enzo', 'novo_pedido', 'Camila Cristina solicitou o empréstimo de: Kit Raspberry Pi 4 Model B.', ha20Minutos, '/painel/solicitacoes'),
    aviso('notif-02', 'user-enzo', 'nova_conta', 'Nova conta de aluno: Diego Alves aguarda aprovação.', ha20Minutos, '/painel/contas'),
    {
      ...aviso('notif-03', 'user-enzo', 'novo_pedido', 'Gustavo Machado solicitou o empréstimo de: Kit Arduino Iniciante #1.', ha3Horas, '/painel/solicitacoes'),
      lida: true,
    },
    aviso(
      'notif-04',
      'user-gusta',
      'aprovacao',
      'Seu pedido para "Projetor BenQ MW560" foi APROVADO! Realize a retirada hoje no setor responsável.',
      em(0, 8, 30),
      '/meus-emprestimos',
    ),
    {
      ...aviso(
        'notif-05',
        'user-camila',
        'recusa',
        'Seu pedido para "Notebook Lenovo ThinkPad E14" não foi aprovado. Motivo: reservado para a aula de robótica.',
        em(-3, 11),
        '/meus-emprestimos',
      ),
      lida: true,
    },
    aviso(
      'notif-06',
      'user-elisa',
      'aprovacao',
      'A devolução de "Parafusadeira Bosch 12V" foi confirmada pelo responsável. O item foi encaminhado para manutenção com registro de ocorrência.',
      em(-1, 16),
      '/meus-emprestimos',
    ),
    {
      ...aviso(
        'notif-07',
        'user-bruno',
        'expiracao',
        'Seu pedido aprovado expirou porque a retirada não foi realizada no mesmo dia.',
        em(-7, 0),
        '/meus-emprestimos',
      ),
      lida: true,
    },
  ];

  return {
    agora: agoraIso,
    usuarioLogadoId: '',
    configuracao: {
      politicaAtraso: 'rigida',
    },
    usuarios,
    categorias,
    itens,
    solicitacoes,
    emprestimos,
    ocorrencias,
    notificacoes,
    auditoria: [],
  };
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

function concluida(
  id: string,
  solicitanteId: string,
  itemId: string,
  devolucaoDesejada: string,
  criadoEm: string,
  avaliadoEm: string,
): Solicitacao {
  return {id, solicitanteId, itemId, avaliadoPor: 'user-enzo', devolucaoDesejada, status: 'concluida', criadoEm, avaliadoEm};
}

function emprestimo(
  id: string,
  solicitacaoId: string,
  itemId: string,
  usuarioId: string,
  retiradoEm: string,
  devolucaoPrevista: string,
): Emprestimo {
  return {id, solicitacaoId, itemId, usuarioId, registradoPor: 'user-enzo', retiradoEm, devolucaoPrevista, diasAtraso: 0};
}

function aviso(
  id: string,
  usuarioId: string,
  tipo: Notificacao['tipo'],
  mensagem: string,
  criadoEm: string,
  destino: string,
): Notificacao {
  return {id, usuarioId, tipo, mensagem, lida: false, criadoEm, destino};
}
