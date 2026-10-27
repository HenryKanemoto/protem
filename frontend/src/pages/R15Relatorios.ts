import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {formatDateTime, parseDate} from '../lib/date-utils';
import {plural} from '../lib/categoria-utils';
import {GRUPOS_EVENTO, GrupoEvento, TIPOS_EVENTO} from '../lib/auditoria-utils';
import {PERIODOS, Periodo, inicioDoPeriodo} from '../lib/periodo';

type Aba = 'geral' | 'auditoria';

interface ItemRanking {
  id: string;
  nome: string;
  patrimonio: string;
  categoriaNome: string;
  total: number;
}

@Component({
  selector: 'app-r15-relatorios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './R15Relatorios.html',
})
export class R15Relatorios {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Aba aberta; fica na URL (?aba=auditoria) para o link do Histórico abrir direto nela. */
  readonly aba = signal<Aba>(this.route.snapshot.queryParamMap.get('aba') === 'auditoria' ? 'auditoria' : 'geral');
  readonly periodoSelecionado = signal<Periodo>('30d');

  readonly plural = plural;
  readonly periodos = PERIODOS;
  readonly tiposEvento = TIPOS_EVENTO;

  abrirAba(aba: Aba) {
    this.aba.set(aba);
    this.router.navigate([], {queryParams: {aba: aba === 'geral' ? null : aba}, replaceUrl: true});
  }

  private getFiltroDataMs(): number {
    return inicioDoPeriodo(this.periodoSelecionado(), this.store.agora());
  }

  // ==========================================
  // AUDITORIA: quem fez o quê, com quem e por quê
  // ==========================================

  readonly grupoEvento = signal<GrupoEvento | 'todos'>('todos');
  readonly pessoaAuditoria = signal('');
  readonly buscaAuditoria = signal('');
  readonly limiteAuditoria = signal(30);

  /** Eventos no período, pessoa (quem fez ou quem foi afetado) e busca, antes do filtro de tipo. */
  private readonly eventosNoPeriodo = computed(() => {
    const desde = this.getFiltroDataMs();
    const pessoa = this.pessoaAuditoria();
    const termo = this.buscaAuditoria().trim().toLocaleLowerCase('pt-BR');
    return this.store.auditoria().filter((e) => {
      if (parseDate(e.em).getTime() < desde) return false;
      if (pessoa && e.afetadoId !== pessoa && e.autorId !== pessoa) return false;
      if (!termo) return true;
      const texto = `${this.nomePessoa(e.autorId)} ${this.nomePessoa(e.afetadoId)} ${this.getItem(e.itemId)?.nome ?? ''} ${e.motivo ?? ''} ${TIPOS_EVENTO[e.tipo].rotulo}`;
      return texto.toLocaleLowerCase('pt-BR').includes(termo);
    });
  });

  readonly gruposEvento = computed(() => {
    const eventos = this.eventosNoPeriodo();
    return [
      {valor: 'todos' as const, rotulo: 'Todos', total: eventos.length},
      ...GRUPOS_EVENTO.map((g) => ({...g, total: eventos.filter((e) => TIPOS_EVENTO[e.tipo].grupo === g.valor).length})),
    ];
  });

  readonly eventosFiltrados = computed(() => {
    const grupo = this.grupoEvento();
    return this.eventosNoPeriodo()
      .filter((e) => grupo === 'todos' || TIPOS_EVENTO[e.tipo].grupo === grupo)
      .sort((a, b) => b.em.localeCompare(a.em));
  });

  readonly eventosVisiveis = computed(() => this.eventosFiltrados().slice(0, this.limiteAuditoria()));

  readonly pessoasAuditoria = computed(() =>
    [...this.store.usuarios()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );

  /** Sem autor, a ação foi automática (rotina do relógio ou política de atraso). */
  nomePessoa(id?: string): string {
    if (!id) return 'Sistema';
    return this.getUsuario(id)?.nome ?? 'Pessoa removida';
  }

  formatarDataHora(iso: string) {
    return formatDateTime(iso);
  }

  // Empréstimos filtrados pelo período selecionado
  readonly emprestimosPeriodo = computed(() => {
    const minMs = this.getFiltroDataMs();
    return this.store.emprestimos().filter((e) => {
      const ms = parseDate(e.retiradoEm).getTime();
      return ms >= minMs;
    });
  });

  // Ocorrências filtradas pelo período selecionado
  readonly ocorrenciasPeriodo = computed(() => {
    const minMs = this.getFiltroDataMs();
    return this.store.ocorrencias().filter((o) => {
      const ms = parseDate(o.criadoEm).getTime();
      return ms >= minMs;
    });
  });

  // 1. Ranking dos Itens Mais Emprestados
  readonly rankingMaisEmprestados = computed<ItemRanking[]>(() => {
    const emps = this.emprestimosPeriodo();
    const contagemPorItem = new Map<string, number>();

    emps.forEach((e) => {
      contagemPorItem.set(e.itemId, (contagemPorItem.get(e.itemId) || 0) + 1);
    });

    const resultado: ItemRanking[] = [];
    contagemPorItem.forEach((total, itemId) => {
      const it = this.store.itens().find((i) => i.id === itemId);
      if (it) {
        const cat = this.store.categorias().find((c) => c.id === it.categoriaId);
        resultado.push({
          id: it.id,
          nome: it.nome,
          patrimonio: it.patrimonio,
          categoriaNome: cat?.nome || '—',
          total,
        });
      }
    });

    return resultado.sort((a, b) => b.total - a.total).slice(0, 5);
  });

  readonly maxEmprestimosRanking = computed(() => {
    const r = this.rankingMaisEmprestados();
    return r.length > 0 ? r[0].total : 1;
  });

  getPorcentagemBarra(total: number): number {
    const max = this.maxEmprestimosRanking();
    return Math.max(4, Math.round((total / max) * 100));
  }

  // 2. Atrasos: Agora e No Período
  readonly atrasosAgoraCount = computed(() => {
    return this.store.emprestimos().filter((e) => !e.devolvidoEm && e.diasAtraso > 0).length;
  });

  readonly atrasosNoPeriodoCount = computed(() => {
    return this.emprestimosPeriodo().filter((e) => e.diasAtraso > 0).length;
  });

  readonly listaAtrasos = computed(() => {
    return this.emprestimosPeriodo().filter((e) => e.diasAtraso > 0);
  });

  // 3. Ranking de Itens com Mais Defeitos
  readonly rankingDefeitos = computed<ItemRanking[]>(() => {
    const ocorrs = this.ocorrenciasPeriodo();
    const contagemDefeitos = new Map<string, number>();

    ocorrs.forEach((o) => {
      contagemDefeitos.set(o.itemId, (contagemDefeitos.get(o.itemId) || 0) + 1);
    });

    const resultado: ItemRanking[] = [];
    contagemDefeitos.forEach((total, itemId) => {
      const it = this.store.itens().find((i) => i.id === itemId);
      if (it) {
        const cat = this.store.categorias().find((c) => c.id === it.categoriaId);
        resultado.push({
          id: it.id,
          nome: it.nome,
          patrimonio: it.patrimonio,
          categoriaNome: cat?.nome || '—',
          total,
        });
      }
    });

    return resultado.sort((a, b) => b.total - a.total).slice(0, 5);
  });

  getUsuario(id?: string) {
    if (!id) return undefined;
    return this.store.usuarios().find((u) => u.id === id);
  }

  getItem(id?: string) {
    if (!id) return undefined;
    return this.store.itens().find((i) => i.id === id);
  }

  abrirItem(id: string) {
    this.router.navigate(['/painel/itens', id]);
  }
}
