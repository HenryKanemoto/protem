import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {
  PASSOS_TEXTO,
  PreferenciasAcessibilidade,
  estaPersonalizado,
  mudarTexto,
  rotuloDoTexto,
} from '../../lib/acessibilidade';
import {Acessibilidade} from '../../services/acessibilidade.service';
import {Modal} from '../modal/modal';

type CampoLigaDesliga = Exclude<keyof PreferenciasAcessibilidade, 'tamanhoTexto'>;

interface Opcao {
  campo: CampoLigaDesliga;
  rotulo: string;
  ajuda: string;
  icone: string;
}

const OPCOES: Opcao[] = [
  {campo: 'escuro', rotulo: 'Modo escuro', ajuda: 'Fundo escuro, mais confortável com pouca luz.', icone: 'dark_mode'},
  {campo: 'altoContraste', rotulo: 'Alto contraste', ajuda: 'Texto e bordas mais fortes, para enxergar melhor.', icone: 'contrast'},
  {campo: 'maisEspaco', rotulo: 'Mais espaço no texto', ajuda: 'Aumenta o espaço entre linhas e palavras.', icone: 'format_line_spacing'},
  {campo: 'menosAnimacao', rotulo: 'Menos animação', ajuda: 'Tira movimentos e transições da tela.', icone: 'motion_photos_off'},
  {campo: 'retornoDoLeitor', rotulo: 'Som e vibração no leitor', ajuda: 'Um sinal curto ao ler um QR code.', icone: 'volume_up'},
];

/**
 * Painel com as preferências de acessibilidade. Fica uma vez só, na raiz do app (app.html), e abre
 * pelo botão <app-botao-acessibilidade>. Tudo vale na hora e fica salvo neste navegador, por
 * usuário (veja services/acessibilidade.service.ts).
 */
@Component({
  selector: 'app-painel-acessibilidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, Modal],
  template: `
    @if (aberto()) {
      <app-modal rotulo="titulo-acessibilidade" (fechar)="fechar()">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-acessibilidade" class="modal-title">Acessibilidade</h2>
            <p class="mt-1 text-sm text-text-muted">Vale na hora e fica salvo neste navegador, para o seu usuário.</p>
          </div>
          <button type="button" class="btn-icon -mr-2 -mt-1 shrink-0" (click)="fechar()" aria-label="Fechar">
            <mat-icon svgIcon="close" />
          </button>
        </div>

        <!-- Tamanho do texto -->
        <div class="flex items-center justify-between gap-3 rounded-control border border-border p-3">
          <div class="flex min-w-0 items-center gap-3">
            <mat-icon class="text-text-muted" svgIcon="text_increase" aria-hidden="true" />
            <div>
              <p id="rotulo-tamanho" class="text-sm font-medium">Tamanho do texto</p>
              <p class="text-sm text-text-muted" role="status" aria-live="polite">{{ rotuloTamanho() }}</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2" role="group" aria-labelledby="rotulo-tamanho">
            <button type="button" class="btn btn-secondary btn-sm w-10 !px-0" (click)="mudarTexto(-1)" [disabled]="noMinimo()" aria-label="Diminuir o texto">
              <span aria-hidden="true" class="text-xs font-semibold">A−</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm w-10 !px-0" (click)="mudarTexto(1)" [disabled]="noMaximo()" aria-label="Aumentar o texto">
              <span aria-hidden="true" class="text-base font-semibold">A+</span>
            </button>
          </div>
        </div>

        <!-- Ligar e desligar -->
        <ul class="flex flex-col gap-2">
          @for (opcao of opcoes; track opcao.campo) {
            <li class="flex items-center justify-between gap-3 rounded-control border border-border p-3">
              <div class="flex min-w-0 items-center gap-3">
                <mat-icon class="text-text-muted" [svgIcon]="opcao.icone" aria-hidden="true" />
                <div class="min-w-0">
                  <p [id]="'rotulo-' + opcao.campo" class="text-sm font-medium">{{ opcao.rotulo }}</p>
                  <p [id]="'ajuda-' + opcao.campo" class="text-sm text-text-muted">{{ opcao.ajuda }}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                [class]="preferencias()[opcao.campo] ? 'bg-primary' : 'bg-border-input'"
                [attr.aria-checked]="preferencias()[opcao.campo]"
                [attr.aria-labelledby]="'rotulo-' + opcao.campo"
                [attr.aria-describedby]="'ajuda-' + opcao.campo"
                (click)="alternar(opcao.campo)"
              >
                <span
                  class="absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform"
                  [class.translate-x-5]="preferencias()[opcao.campo]"
                  aria-hidden="true"
                ></span>
              </button>
            </li>
          }
        </ul>

        <div class="flex items-center justify-between gap-3">
          <button type="button" class="btn btn-ghost" (click)="restaurar()" [disabled]="!personalizado()">
            <mat-icon class="icon-sm" svgIcon="restart_alt" aria-hidden="true" />
            Restaurar padrão
          </button>
          <button type="button" class="btn btn-primary" (click)="fechar()">Pronto</button>
        </div>
      </app-modal>
    }
  `,
})
export class PainelAcessibilidade {
  private readonly acessibilidade = inject(Acessibilidade);

  readonly aberto = this.acessibilidade.painelAberto;
  readonly opcoes = OPCOES;
  readonly preferencias = this.acessibilidade.preferencias;
  readonly personalizado = computed(() => estaPersonalizado(this.preferencias()));
  readonly rotuloTamanho = computed(() => {
    const p = this.preferencias();
    return p.tamanhoTexto === 0 ? 'Padrão (100%)' : rotuloDoTexto(p);
  });
  readonly noMinimo = computed(() => this.preferencias().tamanhoTexto === PASSOS_TEXTO[0]);
  readonly noMaximo = computed(() => this.preferencias().tamanhoTexto === PASSOS_TEXTO[PASSOS_TEXTO.length - 1]);

  mudarTexto(direcao: 1 | -1) {
    this.acessibilidade.atualizar({tamanhoTexto: mudarTexto(this.preferencias().tamanhoTexto, direcao)});
  }

  alternar(campo: CampoLigaDesliga) {
    this.acessibilidade.atualizar({[campo]: !this.preferencias()[campo]});
  }

  restaurar() {
    this.acessibilidade.restaurar();
  }

  fechar() {
    this.aberto.set(false);
  }
}
