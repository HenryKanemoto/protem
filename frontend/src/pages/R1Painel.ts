import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {formatDateShort, formatRelativeTime, parseDate} from '../lib/date-utils';
import {StatusBadge} from '../components/status-badge/status-badge';
import {BrandLogo} from '../components/brand-logo/brand-logo';
import {plural} from '../lib/categoria-utils';
import {atrasados, devolucoesDeHoje, emprestadosNoPrazo, maisPedidos, taxaDeAtraso, usoDoAcervo} from '../lib/resumo-painel';

interface LinhaDeAcao {
  id: string;
  titulo: string;
  detalhe: string;
  rota: string[];
  acao: string;
}

interface BlocoDeAcao {
  chave: string;
  titulo: string;
  icone: string;
  /** Atrasos usam o tom de erro; os outros blocos são neutros (cor forte só para estado). */
  alerta: boolean;
  total: number;
  linhas: LinhaDeAcao[];
}

/** Janela dos números do painel (taxa de atraso e mais pedidos). */
const DIAS_DO_RESUMO = 30;

@Component({
  selector: 'app-r1-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, StatusBadge, BrandLogo],
  templateUrl: './R1Painel.html',
})
export class R1Painel {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly mensagemSucesso = signal<string | null>(null);
  /** "Ver todos" de cada lista: o botão já diz quantos itens existem, nada fica escondido sem aviso. */
  readonly verTodos = signal<Record<string, boolean>>({});

  readonly plural = plural;
  readonly diasDoResumo = DIAS_DO_RESUMO;
  /** Quantas linhas cada lista mostra antes do "Ver todos". */
  readonly limite = 3;
  readonly limiteNoPrazo = 5;

  readonly primeiroNome = computed(() => this.store.usuarioLogado()?.nome.split(' ')[0] ?? '');

  readonly dataHoje = computed(() =>
    this.store.agora().toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'}),
  );

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state && (nav.extras.state as { sucesso?: string }).sucesso) {
      this.mensagemSucesso.set((nav.extras.state as { sucesso: string }).sucesso);
    } else if (typeof history !== 'undefined' && history.state && history.state.sucesso) {
      this.mensagemSucesso.set(history.state.sucesso);
    }
  }

  // ---------- O que fazer agora ----------

  readonly pedidosParaAnalisar = computed(() => this.store.solicitacoesPendentesCount());

  /** Há quanto tempo o pedido mais antigo espera análise (RN10: depois de 2 h o solicitante pode lembrar). */
  readonly pedidoMaisAntigo = computed(() => {
    const pendentes = this.store.solicitacoes().filter((s) => s.status === 'pendente');
    if (pendentes.length === 0) return null;
    const antigo = pendentes.reduce((a, b) => (parseDate(a.criadoEm) <= parseDate(b.criadoEm) ? a : b));
    return formatRelativeTime(antigo.criadoEm, this.store.agora());
  });

  readonly listaAtrasados = computed(() => atrasados(this.store.emprestimos()));
  readonly listaDevolucoesHoje = computed(() => devolucoesDeHoje(this.store.emprestimos(), this.store.agora()));
  readonly listaRetiradasHoje = computed(() => this.store.solicitacoes().filter((s) => s.status === 'aprovada'));
  readonly listaNoPrazo = computed(() => emprestadosNoPrazo(this.store.emprestimos(), this.store.agora()));

  readonly nadaAFazer = computed(
    () =>
      this.pedidosParaAnalisar() === 0 &&
      this.listaAtrasados().length === 0 &&
      this.listaDevolucoesHoje().length === 0 &&
      this.listaRetiradasHoje().length === 0,
  );

  /** Os três blocos de ação com lista, do mais urgente para o menos: atrasos, devoluções de hoje, retiradas de hoje. */
  readonly blocos = computed<BlocoDeAcao[]>(() => {
    const nomeDoItem = (id: string) => this.getItem(id)?.nome ?? 'Item removido';
    const nomeDaPessoa = (id: string) => this.getUsuario(id)?.nome ?? 'Pessoa removida';
    return [
      {
        chave: 'atrasados',
        titulo: 'Atrasados',
        icone: 'priority_high',
        alerta: true,
        total: this.listaAtrasados().length,
        linhas: this.listaAtrasados().map((e) => ({
          id: e.id,
          titulo: nomeDoItem(e.itemId),
          detalhe: `${nomeDaPessoa(e.usuarioId)} · ${plural(e.diasAtraso, 'dia')} de atraso`,
          rota: ['/painel/devolucao', e.itemId],
          acao: 'Registrar devolução',
        })),
      },
      {
        chave: 'devolucoes-hoje',
        titulo: 'Devoluções de hoje',
        icone: 'event',
        alerta: false,
        total: this.listaDevolucoesHoje().length,
        linhas: this.listaDevolucoesHoje().map((e) => ({
          id: e.id,
          titulo: nomeDoItem(e.itemId),
          detalhe: `${nomeDaPessoa(e.usuarioId)} · devolve hoje`,
          rota: ['/painel/devolucao', e.itemId],
          acao: 'Registrar devolução',
        })),
      },
      {
        chave: 'retiradas-hoje',
        titulo: 'Retiradas de hoje',
        icone: 'inventory_2',
        alerta: false,
        total: this.listaRetiradasHoje().length,
        linhas: this.listaRetiradasHoje().map((s) => ({
          id: s.id,
          titulo: nomeDoItem(s.itemId),
          detalhe: `${nomeDaPessoa(s.solicitanteId)} · aprovado às ${this.formatarHora(s.avaliadoEm || s.criadoEm)}`,
          rota: ['/painel/retirada', s.itemId],
          acao: 'Registrar retirada',
        })),
      },
    ].filter((b) => b.total > 0);
  });

  // ---------- Número em destaque e gráfico ----------

  readonly uso = computed(() => usoDoAcervo(this.store.itens()));
  readonly taxaAtraso = computed(() => taxaDeAtraso(this.store.emprestimos(), this.store.agora(), DIAS_DO_RESUMO));

  readonly maisPedidos = computed(() =>
    maisPedidos(this.store.solicitacoes(), this.store.itens(), this.store.agora(), DIAS_DO_RESUMO, 5),
  );
  readonly maximoPedidos = computed(() => Math.max(1, ...this.maisPedidos().map((i) => i.pedidos)));

  // ---------- Apoio ----------

  estaAberto(chave: string): boolean {
    return !!this.verTodos()[chave];
  }

  alternar(chave: string) {
    this.verTodos.update((v) => ({...v, [chave]: !v[chave]}));
  }

  getItem(id: string) {
    return this.store.itens().find((i) => i.id === id);
  }

  getUsuario(id: string) {
    return this.store.usuarios().find((u) => u.id === id);
  }

  formatarData(iso: string) {
    return formatDateShort(iso);
  }

  formatarHora(iso: string) {
    const d = parseDate(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  /** Prazo de devolução legível: "devolve hoje", "devolve amanhã" ou a data (pelo relógio do sistema). */
  prazo(devolucaoPrevista: string): string {
    const agora = this.store.agora();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const dias = Math.round((parseDate(devolucaoPrevista).getTime() - hoje) / 86_400_000);
    if (dias === 0) return 'devolve hoje';
    if (dias === 1) return 'devolve amanhã';
    return `devolve em ${this.formatarData(devolucaoPrevista)}`;
  }
}
