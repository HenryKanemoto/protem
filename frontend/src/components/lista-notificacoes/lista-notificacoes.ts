import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {formatRelativeTime} from '../../lib/date-utils';
import {Notificacao, TipoNotificacao} from '../../types/models';

const ICONES: Record<TipoNotificacao, {icone: string; classe: string}> = {
  aprovacao: {icone: 'check', classe: 'bg-ok-soft text-ok'},
  recusa: {icone: 'block', classe: 'bg-danger-soft text-danger'},
  expiracao: {icone: 'timer_off', classe: 'bg-warn-soft text-warn'},
  prazo_proximo: {icone: 'event', classe: 'bg-info-soft text-info'},
  atraso: {icone: 'priority_high', classe: 'bg-danger-soft text-danger'},
  lembrete: {icone: 'notifications_active', classe: 'bg-warn-soft text-warn'},
  novo_pedido: {icone: 'add', classe: 'bg-info-soft text-info'},
  nova_conta: {icone: 'person_add', classe: 'bg-maint-soft text-maint'},
  laudo: {icone: 'engineering', classe: 'bg-maint-soft text-maint'},
};

/** Lista de notificações usada pelo solicitante (S5) e pelo responsável (R17). */
@Component({
  selector: 'app-lista-notificacoes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (notificacoes().length > 0) {
      <ul class="card divide-y divide-border overflow-hidden">
        @for (n of notificacoes(); track n.id) {
          @let tipo = icones[n.tipo];
          <li>
            <button
              type="button"
              (click)="abrir.emit(n)"
              class="group flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-bg sm:px-5"
              [class.bg-brand-soft]="!n.lida"
            >
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full {{ tipo.classe }}">
                <mat-icon class="icon-sm" [svgIcon]="tipo.icone" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm leading-snug" [class.font-semibold]="!n.lida">{{ n.mensagem }}</span>
                <span class="mt-1 flex items-center gap-2 text-xs text-text-muted">
                  {{ tempoRelativo(n.criadoEm) }}
                  @if (!n.lida) {
                    <span class="inline-flex items-center gap-1 font-medium text-text">
                      <span class="size-1.5 rounded-full bg-primary"></span>
                      nova
                    </span>
                  }
                </span>
              </span>
              <span class="hidden shrink-0 items-center gap-1 self-center text-xs font-medium text-text-muted group-hover:text-text sm:flex">
                {{ rotuloDestino()(n) }}
                <mat-icon class="icon-sm" svgIcon="arrow_forward" />
              </span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <div class="card empty">
        <mat-icon class="icon-xl" svgIcon="notifications_off" />
        <p class="empty-title">Nenhuma notificação</p>
        <p class="empty-text">{{ textoVazio() }}</p>
      </div>
    }
  `,
})
export class ListaNotificacoes {
  readonly notificacoes = input.required<Notificacao[]>();
  readonly agora = input.required<Date>();
  readonly rotuloDestino = input<(n: Notificacao) => string>(() => 'Abrir');
  readonly textoVazio = input('');

  readonly abrir = output<Notificacao>();

  readonly icones = ICONES;

  tempoRelativo(iso: string): string {
    return formatRelativeTime(iso, this.agora());
  }
}
