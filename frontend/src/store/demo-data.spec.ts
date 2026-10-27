import {addDays, parseDate} from '../lib/date-utils';
import {PERFIS_DEMO, PERSONAS_DEMO, getInitialDemoState} from './demo-data';
import {executarRotinaAutomatica} from './regras/rotina';

/** CPF válido pelos dígitos verificadores (o seed precisa usar só CPFs inválidos). */
function cpfValido(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  const dv = (base: string) => {
    const soma = [...base].reduce((t, d, i) => t + Number(d) * (base.length + 1 - i), 0);
    return ((soma * 10) % 11) % 10;
  };
  return n.length === 11 && dv(n.slice(0, 9)) === Number(n[9]) && dv(n.slice(0, 10)) === Number(n[10]);
}

describe('seed de demonstração', () => {
  const seed = getInitialDemoState();
  const depoisDaRotina = executarRotinaAutomatica(seed, parseDate(seed.agora));

  it('já está coerente com as regras: a rotina ao carregar não muda itens, pedidos, contas nem a auditoria', () => {
    expect(depoisDaRotina.itens).toEqual(seed.itens);
    expect(depoisDaRotina.solicitacoes).toEqual(seed.solicitacoes);
    expect(depoisDaRotina.usuarios).toEqual(seed.usuarios);
    expect(depoisDaRotina.emprestimos).toEqual(seed.emprestimos);
    expect(depoisDaRotina.auditoria).toEqual(seed.auditoria);
  });

  it('a rotina gera os avisos de atraso e de prazo próximo', () => {
    const novos = depoisDaRotina.notificacoes.slice(0, depoisDaRotina.notificacoes.length - seed.notificacoes.length);
    expect(novos.map((n) => `${n.usuarioId}:${n.tipo}`).sort()).toEqual([
      'user-ana:prazo_proximo',
      'user-bruno:atraso',
      'user-enzo:atraso',
    ]);
  });

  it('tem uma situação de cada tipo para nenhuma tela ficar vazia', () => {
    expect(new Set(seed.usuarios.map((u) => u.perfil))).toEqual(new Set(['aluno', 'professor', 'responsavel']));
    expect(new Set(seed.usuarios.map((u) => u.status))).toEqual(new Set(['ativa', 'bloqueada', 'suspensa', 'pendente']));
    expect(new Set(seed.itens.map((i) => i.status))).toEqual(
      new Set(['disponivel', 'solicitado', 'reservado', 'emprestado', 'atrasado', 'manutencao']),
    );
    expect(new Set(seed.solicitacoes.map((s) => s.status))).toEqual(
      new Set(['pendente', 'aprovada', 'recusada', 'expirada', 'concluida']),
    );
    expect(seed.ocorrencias.some((o) => o.status === 'aberta')).toBe(true);
    expect(seed.emprestimos.some((e) => e.devolvidoEm)).toBe(true);
  });

  it('os perfis do login começam sem pedidos, empréstimos nem avisos', () => {
    const aluno = PERFIS_DEMO.filter((id) => id !== 'user-enzo');
    for (const id of aluno) {
      expect(seed.solicitacoes.some((s) => s.solicitanteId === id), id).toBe(false);
      expect(seed.emprestimos.some((e) => e.usuarioId === id), id).toBe(false);
      expect(seed.notificacoes.some((n) => n.usuarioId === id), id).toBe(false);
      expect(seed.usuarios.find((u) => u.id === id)?.status, id).toBe('ativa');
    }
  });

  it('as 10 personas existem e cada uma tem histórico ou uma situação própria', () => {
    expect(PERSONAS_DEMO).toHaveLength(10);
    for (const {id} of PERSONAS_DEMO) {
      const u = seed.usuarios.find((x) => x.id === id);
      expect(u, id).toBeTruthy();
      expect(seed.auditoria.some((e) => e.afetadoId === id), id).toBe(true);
    }
    const helena = seed.usuarios.find((u) => u.id === 'user-helena')!;
    expect(helena).toMatchObject({status: 'suspensa', restricaoManual: {porId: 'user-enzo'}});
    expect(seed.solicitacoes.filter((s) => s.status === 'recusada').every((s) => s.motivoRecusa)).toBe(true);
  });

  it('cada item fora do catálogo tem o pedido ou empréstimo correspondente', () => {
    const ativo = (itemId: string) => seed.emprestimos.find((e) => e.itemId === itemId && !e.devolvidoEm);
    const pedido = (itemId: string, status: string) =>
      seed.solicitacoes.find((s) => s.itemId === itemId && s.status === status);

    for (const item of seed.itens) {
      if (item.status === 'solicitado') expect(pedido(item.id, 'pendente'), item.id).toBeTruthy();
      if (item.status === 'reservado') expect(pedido(item.id, 'aprovada'), item.id).toBeTruthy();
      if (item.status === 'emprestado' || item.status === 'atrasado') expect(ativo(item.id), item.id).toBeTruthy();
      if (item.status === 'manutencao') expect(seed.ocorrencias.find((o) => o.itemId === item.id), item.id).toBeTruthy();
      if (item.status === 'disponivel') expect(ativo(item.id), item.id).toBeFalsy();
    }
  });

  it('um item nunca está com duas pessoas ao mesmo tempo', () => {
    const fim = (e: (typeof seed.emprestimos)[number]) => parseDate(e.devolvidoEm ?? seed.agora).getTime();
    for (const a of seed.emprestimos) {
      for (const b of seed.emprestimos) {
        if (a === b || a.itemId !== b.itemId) continue;
        const sobrepoe = parseDate(a.retiradoEm).getTime() < fim(b) && parseDate(b.retiradoEm).getTime() < fim(a);
        expect(sobrepoe, `${a.id} e ${b.id}`).toBe(false);
      }
    }
  });

  it('RN02: toda data de devolução respeita o prazo da categoria a partir do pedido', () => {
    for (const s of seed.solicitacoes) {
      const item = seed.itens.find((i) => i.id === s.itemId)!;
      const categoria = seed.categorias.find((c) => c.id === item.categoriaId)!;
      const limite = addDays(parseDate(s.criadoEm), categoria.prazoMaxDias);
      limite.setHours(23, 59, 59);
      expect(parseDate(s.devolucaoDesejada).getTime(), s.id).toBeLessThanOrEqual(limite.getTime());
    }
  });

  it('RN03: ninguém passa do limite por categoria', () => {
    const ativos = ['solicitado', 'reservado', 'emprestado', 'atrasado'];
    for (const u of seed.usuarios) {
      for (const c of seed.categorias) {
        const itensDaPessoa = seed.itens.filter((i) => {
          if (i.categoriaId !== c.id || !ativos.includes(i.status)) return false;
          const comEla = seed.emprestimos.some((e) => e.itemId === i.id && e.usuarioId === u.id && !e.devolvidoEm);
          const pedido = seed.solicitacoes.some(
            (s) => s.itemId === i.id && s.solicitanteId === u.id && (s.status === 'pendente' || s.status === 'aprovada'),
          );
          return comEla || pedido;
        });
        expect(itensDaPessoa.length, `${u.id} em ${c.id}`).toBeLessThanOrEqual(c.limitePorPessoa);
      }
    }
  });

  it('usa só dados pessoais fictícios: e-mail em example.com, CPF inválido e telefone 90000', () => {
    expect(seed.usuarios.every((u) => u.email.endsWith('@example.com'))).toBe(true);
    const comDados = seed.usuarios.filter((u) => u.cpf);
    expect(comDados).toHaveLength(10);
    expect(comDados.every((u) => !cpfValido(u.cpf!))).toBe(true);
    expect(comDados.every((u) => /^\(96\) 90000-0\d{3}$/.test(u.telefone!))).toBe(true);
  });

  it('a auditoria só tem o que já aconteceu, do mais recente para o mais antigo, com ids únicos', () => {
    const agora = parseDate(seed.agora).getTime();
    expect(seed.auditoria.every((e) => parseDate(e.em).getTime() <= agora)).toBe(true);
    const datas = seed.auditoria.map((e) => e.em);
    expect(datas).toEqual([...datas].sort().reverse());
    expect(new Set(seed.auditoria.map((e) => e.id)).size).toBe(seed.auditoria.length);
    // Pelo menos um evento de cada tipo, para os filtros da auditoria terem o que mostrar
    expect(new Set(seed.auditoria.map((e) => e.tipo)).size).toBe(12);
  });

  it('todo pedido aprovado já tem código de retirada', () => {
    const aprovados = seed.solicitacoes.filter((s) => s.status === 'aprovada');
    expect(aprovados.length).toBeGreaterThan(0);
    expect(aprovados.every((s) => /^[A-Z2-9]{6}$/.test(s.codigoRetirada ?? ''))).toBe(true);
  });
});
