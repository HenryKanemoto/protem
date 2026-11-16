import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {Router} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {Notificacao} from '../types/models';
import {ListaNotificacoes} from '../components/lista-notificacoes/lista-notificacoes';

@Component({
  selector: 'app-r17-notificacoes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ListaNotificacoes],
  template: `
    <div class="page max-w-3xl">
      <header class="page-header">
        <div>
          <h1 class="page-title">Notificações</h1>
          <p class="page-subtitle">Novos pedidos, lembretes, contas para aprovar e atrasos.</p>
        </div>
        @if (temNaoLidas()) {
          <button type="button" (click)="marcarTodasComoLidas()" class="btn btn-secondary btn-sm self-start sm:self-auto">
            <mat-icon class="icon-sm" svgIcon="done_all" />
            Marcar todas como lidas
          </button>
        }
      </header>

      <app-lista-notificacoes
        [notificacoes]="notificacoes()"
        [agora]="store.agora()"
        [rotuloDestino]="rotuloDestino"
        textoVazio="Novos pedidos, lembretes de análise e alertas de atraso aparecem aqui."
        (abrir)="abrirNotificacao($event)"
      />
    </div>
  `,
})
export class R17Notificacoes {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.store.usuarioLogado());

  readonly notificacoes = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store.notificacoes().filter((n) => n.usuarioId === u.id);
  });

  readonly temNaoLidas = computed(() => this.notificacoes().some((n) => !n.lida));

  readonly rotuloDestino = (n: Notificacao) => this.getDestinoInfo(n).label;

  getDestinoInfo(n: Notificacao): {rota: string; label: string} {
    switch (n.tipo) {
      case 'novo_pedido':
      case 'lembrete':
        return {rota: '/painel/pedidos', label: 'Pedidos'};
      case 'nova_conta':
        return {rota: '/painel/contas', label: 'Contas'};
      case 'atraso':
        return {rota: '/painel', label: 'Painel'};
      default:
        return {rota: n.destino || '/painel', label: 'Abrir'};
    }
  }

  abrirNotificacao(n: Notificacao) {
    if (!n.lida) {
      this.store.marcarNotificacaoComoLida(n.id);
    }
    this.router.navigate([this.getDestinoInfo(n).rota]);
  }

  marcarTodasComoLidas() {
    const u = this.usuario();
    if (u) {
      this.store.marcarTodasNotificacoesComoLidas(u.id);
    }
  }
}
