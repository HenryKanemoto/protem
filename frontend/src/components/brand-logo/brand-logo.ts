import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** Arquivos oficiais da marca (public/brand/protem_logos), servidos pelo próprio app. */
const ARQUIVOS = {
  horizontal: 'brand/protem_logos/protem_3_prazo_horizontal.svg',
  icone: 'brand/protem_logos/protem_3_prazo_icone.svg',
};

/**
 * Logotipo do Protem, em um único lugar para trocar depois.
 *
 * - variante "horizontal" (ícone + nome) e "icone": usam os SVGs oficiais de public/brand.
 *   Ficam nas telas de entrada (login e landing), em tamanho grande. O nome do arquivo
 *   horizontal é navy, então essa variante é só para fundo claro.
 * - variante "padrao": ícone desenhado inline com o nome em texto, para o menu e os
 *   cabeçalhos em navy ([escuro]="true" deixa o nome em branco).
 */
@Component({
  selector: 'app-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {class: 'inline-flex items-center gap-2.5'},
  template: `
    @switch (variante()) {
      @case ('horizontal') {
        <span class="logo-claro flex flex-col gap-2">
          <img [src]="arquivos.horizontal" alt="Protem" [style.height.px]="tamanho()" class="block w-auto max-w-full" />
          @if (comSubtitulo()) {
            <span class="text-sm text-text-muted">Plataforma Web de Empréstimos</span>
          }
        </span>
      }
      @case ('icone') {
        <img [src]="arquivos.icone" alt="Protem" [style.width.px]="tamanho()" [style.height.px]="tamanho()" class="block shrink-0" />
      }
      @default {
        <svg
          viewBox="0 0 512 512"
          [attr.width]="tamanho()"
          [attr.height]="tamanho()"
          aria-hidden="true"
          class="shrink-0"
        >
          <rect width="512" height="512" rx="116" class="fill-brand-soft" />
          <path
            d="M171,400 L171,108 L242,108 A100,100 0 0 1 242,308 L171,308"
            fill="none"
            class="stroke-brand-blue"
            stroke-width="54"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M256,160 L256,208 L292,208"
            fill="none"
            class="stroke-brand-gold"
            stroke-width="17"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        @if (comNome()) {
          <span class="flex flex-col gap-1">
            <span
              class="font-display text-lg font-semibold leading-none tracking-tight"
              [class]="escuro() ? 'text-white' : 'text-text-heading'"
            >
              Protem
            </span>
            @if (comSubtitulo()) {
              <span class="text-xs leading-none" [class]="escuro() ? 'text-white/65' : 'text-text-muted'">
                Plataforma Web de Empréstimos
              </span>
            }
          </span>
        }
      }
    }
  `,
})
export class BrandLogo {
  readonly variante = input<'padrao' | 'horizontal' | 'icone'>('padrao');
  /** Altura em px (na variante horizontal, a largura acompanha a proporção do arquivo). */
  readonly tamanho = input(32);
  readonly comNome = input(true);
  readonly comSubtitulo = input(false);
  /** Texto em branco, para usar sobre o navy (menu lateral e cabeçalhos). */
  readonly escuro = input(false);

  readonly arquivos = ARQUIVOS;
}
