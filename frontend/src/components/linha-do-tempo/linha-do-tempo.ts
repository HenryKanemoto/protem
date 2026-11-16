import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {EstadoEtapa, EtapaDoPedido} from '../../lib/linha-do-tempo';

const TEXTO_DO_ESTADO: Record<EstadoEtapa, string> = {
  feito: 'concluída',
  atual: 'etapa atual',
  pendente: 'ainda não chegou',
  falhou: 'não aconteceu',
};

/**
 * Andamento de um pedido: Pedido → Aprovação → Retirada → Devolução, com a data de cada etapa
 * e a etapa de agora em destaque. Em tela estreita fica na vertical.
 * As etapas vêm de lib/linha-do-tempo.ts (etapasDoPedido).
 */
@Component({
  selector: 'app-linha-do-tempo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: {class: 'block'},
  template: `
    <ol class="grid gap-4 sm:grid-cols-4 sm:gap-0" aria-label="Andamento do pedido">
      @for (etapa of etapas(); track etapa.chave; let ultima = $last) {
        <li class="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-3" [attr.aria-current]="etapa.estado === 'atual' ? 'step' : null">
          @if (!ultima) {
            <!-- Linha até a próxima etapa: vertical no celular, horizontal a partir de sm -->
            <span
              class="absolute bottom-[-1rem] left-[13px] top-8 w-0.5 sm:bottom-auto sm:left-9 sm:right-1 sm:top-[13px] sm:h-0.5 sm:w-auto"
              [class]="etapa.estado === 'feito' ? 'bg-primary' : 'bg-border'"
              aria-hidden="true"
            ></span>
          }
          <span
            class="relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-2"
            [class]="classeDoMarcador(etapa)"
            aria-hidden="true"
          >
            @switch (etapa.estado) {
              @case ('feito') {
                <mat-icon class="icon-xs" svgIcon="check" />
              }
              @case ('falhou') {
                <mat-icon class="icon-xs" svgIcon="close" />
              }
              @case ('atual') {
                <span class="size-2.5 rounded-full" [class]="etapa.alerta ? 'bg-danger' : 'bg-primary'"></span>
              }
            }
          </span>
          <div class="min-w-0">
            <p class="text-sm" [class]="classeDoRotulo(etapa)">
              {{ etapa.rotulo }}<span class="sr-only"> ({{ textoDoEstado(etapa.estado) }})</span>
            </p>
            @if (etapa.detalhe) {
              <p class="text-sm" [class]="etapa.alerta ? 'font-medium text-danger' : 'text-text-muted'">{{ etapa.detalhe }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class LinhaDoTempo {
  readonly etapas = input.required<EtapaDoPedido[]>();

  textoDoEstado(estado: EstadoEtapa): string {
    return TEXTO_DO_ESTADO[estado];
  }

  classeDoMarcador(etapa: EtapaDoPedido): string {
    switch (etapa.estado) {
      case 'feito':
        return 'border-primary bg-primary text-white';
      case 'falhou':
        return 'border-danger-fill bg-danger-fill text-white';
      case 'atual':
        return etapa.alerta ? 'border-danger bg-surface' : 'border-primary bg-brand-soft';
      default:
        return 'border-border-input bg-surface';
    }
  }

  classeDoRotulo(etapa: EtapaDoPedido): string {
    return etapa.estado === 'atual' ? 'font-semibold text-text-heading' : etapa.estado === 'pendente' ? 'font-medium text-text-muted' : 'font-medium';
  }
}
