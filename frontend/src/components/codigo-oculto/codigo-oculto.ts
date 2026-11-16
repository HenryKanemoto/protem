import {ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

/** Tempo que o código fica à mostra antes de esconder sozinho. */
export const SEGUNDOS_VISIVEL = 30;

/**
 * Código de retirada ou de devolução. Começa escondido: o olho mostra e esconde, e o botão
 * de copiar funciona mesmo com o código escondido. Esconde de novo sozinho depois de 30 s.
 */
@Component({
  selector: 'app-codigo-oculto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: {class: 'block'},
  template: `
    <p class="text-sm text-text-muted">{{ rotulo() }}</p>
    <div class="mt-1 flex items-center gap-1">
      @if (visivel()) {
        <p class="font-mono text-2xl font-semibold tracking-[0.2em] text-text-heading">{{ codigo() }}</p>
      } @else {
        <p class="font-mono text-2xl font-semibold tracking-[0.2em] text-text-muted" aria-hidden="true">••••••</p>
        <span class="sr-only">Código escondido</span>
      }
      <button
        type="button"
        class="btn-icon"
        [attr.aria-pressed]="visivel()"
        [attr.aria-label]="(visivel() ? 'Esconder ' : 'Mostrar ') + rotulo().toLowerCase()"
        (click)="alternar()"
      >
        <mat-icon class="icon-sm" [svgIcon]="visivel() ? 'visibility_off' : 'visibility'" aria-hidden="true" />
      </button>
      <button type="button" class="btn-icon" [attr.aria-label]="'Copiar ' + rotulo().toLowerCase()" (click)="copiar()">
        <mat-icon class="icon-sm" [svgIcon]="copiado() ? 'check' : 'content_copy'" aria-hidden="true" />
      </button>
    </div>
    <p class="mt-1 min-h-5 text-sm text-text-muted" role="status" aria-live="polite">
      @if (copiado()) {
        Código copiado
      } @else if (falhouCopia()) {
        Não deu para copiar. Mostre o código e anote.
      }
    </p>
  `,
})
export class CodigoOculto {
  readonly codigo = input.required<string>();
  /** Ex.: "Código de retirada". */
  readonly rotulo = input.required<string>();

  readonly visivel = signal(false);
  readonly copiado = signal(false);
  readonly falhouCopia = signal(false);

  private temporizadorEsconder?: ReturnType<typeof setTimeout>;
  private temporizadorCopiado?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizadorEsconder);
      clearTimeout(this.temporizadorCopiado);
    });
  }

  alternar() {
    clearTimeout(this.temporizadorEsconder);
    const mostrar = !this.visivel();
    this.visivel.set(mostrar);
    if (mostrar) {
      this.temporizadorEsconder = setTimeout(() => this.visivel.set(false), SEGUNDOS_VISIVEL * 1000);
    }
  }

  async copiar() {
    const ok = await copiarParaAreaDeTransferencia(this.codigo());
    this.copiado.set(ok);
    this.falhouCopia.set(!ok);
    clearTimeout(this.temporizadorCopiado);
    this.temporizadorCopiado = setTimeout(() => {
      this.copiado.set(false);
      this.falhouCopia.set(false);
    }, 2500);
  }
}

/** Copia o texto. Fora de HTTPS/localhost a API moderna não existe: tenta o jeito antigo. */
export async function copiarParaAreaDeTransferencia(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai no método antigo
  }
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  } catch {
    return false;
  }
}
