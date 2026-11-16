import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {Solicitacao} from '../types/models';
import {differenceInHours, formatDateShort, parseDate} from '../lib/date-utils';
import {plural} from '../lib/categoria-utils';
import {atrasados, devolucoesDeHoje, emprestadosNoPrazo} from '../lib/resumo-painel';
import {Modal} from '../components/modal/modal';

export type AbaPedidos = 'emprestimos' | 'devolucoes';

@Component({
  selector: 'app-r2-pedidos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, Modal],
  templateUrl: './R2Pedidos.html',
})
export class R2Pedidos {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly plural = plural;

  /** Aba aberta; fica na URL (?aba=devolucoes) para os links do painel e dos avisos abrirem direto nela. */
  readonly aba = signal<AbaPedidos>(this.route.snapshot.queryParamMap.get('aba') === 'devolucoes' ? 'devolucoes' : 'emprestimos');

  abrirAba(aba: AbaPedidos) {
    this.aba.set(aba);
    this.router.navigate([], {queryParams: {aba: aba === 'emprestimos' ? null : aba}, replaceUrl: true});
  }

  // Devoluções: tudo que está com alguém agora, do mais urgente para o menos
  readonly devolucoesAtrasadas = computed(() => atrasados(this.store.emprestimos()));
  readonly devolucoesDeHoje = computed(() => devolucoesDeHoje(this.store.emprestimos(), this.store.agora()));
  readonly devolucoesNoPrazo = computed(() => emprestadosNoPrazo(this.store.emprestimos(), this.store.agora()));
  readonly totalDevolucoes = computed(
    () => this.devolucoesAtrasadas().length + this.devolucoesDeHoje().length + this.devolucoesNoPrazo().length,
  );

  readonly feedbackMensagem = signal<string | null>(null);
  readonly solicitacaoParaRecusar = signal<Solicitacao | null>(null);
  readonly erroRecusa = signal<string | null>(null);

  readonly solicitacoesPendentes = computed(() => {
    return this.store.solicitacoes().filter((s) => s.status === 'pendente');
  });

  readonly pedidosAprovadosHoje = computed(() => {
    return this.store.solicitacoes().filter((s) => s.status === 'aprovada');
  });

  /** "devolve hoje", "devolve amanhã" ou a data, pelo relógio do sistema. */
  prazo(devolucaoPrevista: string): string {
    const agora = this.store.agora();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const dias = Math.round((parseDate(devolucaoPrevista).getTime() - hoje) / 86_400_000);
    if (dias === 0) return 'devolve hoje';
    if (dias === 1) return 'devolve amanhã';
    return `devolve em ${this.formatarData(devolucaoPrevista)}`;
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

  getTempoDecorrido(criadoEm: string): string {
    const agora = this.store.agora();
    const criado = parseDate(criadoEm);
    const diffH = Math.floor(differenceInHours(agora, criado));
    if (diffH <= 0) {
      const diffMin = Math.max(1, Math.floor((agora.getTime() - criado.getTime()) / (1000 * 60)));
      return `${diffMin} min`;
    }
    return `${diffH} h`;
  }

  aprovarPedido(solicitacaoId: string) {
    const respId = this.store.usuarioLogado()?.id ?? '';
    const res = this.store.aprovarPedido(solicitacaoId, respId);
    if (res.sucesso) {
      this.feedbackMensagem.set('Pedido aprovado! O item foi marcado como reservado e aguarda retirada hoje.');
    }
  }

  abrirModalRecusa(solic: Solicitacao) {
    this.erroRecusa.set(null);
    this.solicitacaoParaRecusar.set(solic);
  }

  confirmarRecusa(solicitacaoId: string, motivo: string) {
    const respId = this.store.usuarioLogado()?.id ?? '';
    const res = this.store.recusarPedido(solicitacaoId, respId, motivo);
    if (!res.sucesso) {
      this.erroRecusa.set(res.mensagem);
      return;
    }
    this.solicitacaoParaRecusar.set(null);
    this.feedbackMensagem.set('Pedido recusado. O item retornou como disponível para o catálogo.');
  }
}
