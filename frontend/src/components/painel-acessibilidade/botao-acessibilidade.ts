import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {estaPersonalizado} from '../../lib/acessibilidade';
import {Acessibilidade} from '../../services/acessibilidade.service';

/** Botão que abre o painel de acessibilidade. Vai no cabeçalho de cada layout e na tela de entrada. */
@Component({
  selector: 'app-botao-acessibilidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <button
      type="button"
      class="btn-icon relative"
      [class.btn-icon-escuro]="escuro()"
      (click)="acessibilidade.painelAberto.set(true)"
      aria-label="Acessibilidade"
      aria-haspopup="dialog"
    >
      <mat-icon svgIcon="accessibility_new" />
      @if (personalizado()) {
        <!-- Mostra que há ajustes ligados; o aria-label já diz o essencial -->
        <span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-gold" aria-hidden="true"></span>
      }
    </button>
  `,
})
export class BotaoAcessibilidade {
  readonly acessibilidade = inject(Acessibilidade);

  /** true quando o botão fica sobre o navy (cabeçalhos): ícone claro. */
  readonly escuro = input(false);
  readonly personalizado = computed(() => estaPersonalizado(this.acessibilidade.preferencias()));
}
