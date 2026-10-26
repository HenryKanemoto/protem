import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {formatDateShort, parseDate} from '../lib/date-utils';
import {StatusBadge} from '../components/status-badge/status-badge';
import {BrandLogo} from '../components/brand-logo/brand-logo';
import {plural} from '../lib/categoria-utils';


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
  readonly verTodosNoPrazo = signal(false);
  readonly verTodosAtrasados = signal(false);

  readonly plural = plural;
  /** Quantas linhas cada lista mostra antes do "Ver todos". */
  readonly limite = 5;

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

  readonly totalEmprestimosAtivos = computed(() => {
    return this.store.emprestimos().filter((e) => !e.devolvidoEm).length;
  });

  readonly totalAtrasados = computed(() => {
    return this.store.emprestimos().filter((e) => !e.devolvidoEm && e.diasAtraso > 0).length;
  });

  /** Atrasados, do maior atraso para o menor. */
  readonly listaAtrasados = computed(() =>
    this.store
      .emprestimos()
      .filter((e) => !e.devolvidoEm && e.diasAtraso > 0)
      .sort((a, b) => b.diasAtraso - a.diasAtraso),
  );

  /** Emprestados ainda no prazo, da devolução mais próxima para a mais distante. */
  readonly listaNoPrazo = computed(() =>
    this.store
      .emprestimos()
      .filter((e) => !e.devolvidoEm && e.diasAtraso === 0)
      .sort((a, b) => a.devolucaoPrevista.localeCompare(b.devolucaoPrevista)),
  );

  readonly listaAprovadosHoje = computed(() => {
    return this.store.solicitacoes().filter((s) => s.status === 'aprovada');
  });

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
