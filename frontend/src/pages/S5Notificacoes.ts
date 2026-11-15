import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {Router} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {Notificacao} from '../types/models';
import {ListaNotificacoes} from '../components/lista-notificacoes/lista-notificacoes';

@Component({
  selector: 'app-s5-notificacoes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ListaNotificacoes],
  template: `
    <div class="page max-w-3xl">
      <header class="page-header">
        <div>
          <h1 class="page-title">Notificações</h1>
          <p class="page-subtitle">Aprovações, recusas, prazos e alertas sobre seus pedidos.</p>
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
        textoVazio="Quando seus pedidos forem aprovados, recusados ou estiverem perto do prazo, você será avisado aqui."
        (abrir)="abrirNotificacao($event)"
      />
    </div>
  `,
})
export class S5Notificacoes {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.store.usuarioLogado());

  readonly notificacoes = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store.notificacoes().filter((n) => n.usuarioId === u.id);
  });

  readonly temNaoLidas = computed(() => this.notificacoes().some((n) => !n.lida));

  readonly rotuloDestino = (n: Notificacao) => this.destino(n).rotulo;

  /**
   * Para onde o aviso leva. Os de pedido vão para /meus-emprestimos (Wireframe S5);
   * os de conta (bloqueio, suspensão, reativação) vão para o perfil ou o catálogo.
   */
  private destino(n: Notificacao): {rota: string; rotulo: string} {
    const rotulos: Record<string, string> = {
      '/meus-emprestimos': 'Meus empréstimos',
      '/catalogo': 'Catálogo',
      '/perfil': 'Perfil',
      '/codigos': 'Meus códigos',
    };
    return rotulos[n.destino]
      ? {rota: n.destino, rotulo: rotulos[n.destino]}
      : {rota: '/meus-emprestimos', rotulo: 'Meus empréstimos'};
  }

  abrirNotificacao(n: Notificacao) {
    if (!n.lida) {
      this.store.marcarNotificacaoComoLida(n.id);
    }
    this.router.navigate([this.destino(n).rota]);
  }

  marcarTodasComoLidas() {
    const u = this.usuario();
    if (u) {
      this.store.marcarTodasNotificacoesComoLidas(u.id);
    }
  }
}
