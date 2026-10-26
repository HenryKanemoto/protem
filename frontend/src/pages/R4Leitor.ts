import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProtemStore } from '../store/protem.store';
import { MatIconModule } from '@angular/material/icon';
import { Html5Qrcode } from 'html5-qrcode';
import { StatusItem } from '../types/models';

@Component({
  selector: 'app-r4-leitor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './R4Leitor.html',
})
export class R4Leitor {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly codigoDigitado = signal('');
  readonly mensagemAviso = signal<string | null>(null);
  readonly cameraAtiva = signal(false);
  readonly cameraStatusTexto = signal('Ligando a câmera...');
  private readonly campoCodigo = viewChild.required<ElementRef<HTMLInputElement>>('campoCodigo');

  private html5QrCode: Html5Qrcode | null = null;

  /**
   * Atalhos para testar sem câmera: um item de cada situação que o leitor trata
   * (reservado → retirada, emprestado/atrasado → devolução, disponível → aviso).
   * Aparecem como sugestões do campo de código.
   */
  readonly itensExemplo = computed(() => {
    const ordem: StatusItem[] = ['reservado', 'emprestado', 'atrasado', 'disponivel'];
    const rotulos: Partial<Record<StatusItem, string>> = {
      reservado: 'reservado: abre a retirada',
      emprestado: 'emprestado: abre a devolução',
      atrasado: 'atrasado: abre a devolução',
      disponivel: 'disponível: mostra um aviso',
    };
    const efeitos: Partial<Record<StatusItem, string>> = {
      reservado: 'retirada',
      emprestado: 'devolução',
      atrasado: 'devolução com atraso',
      disponivel: 'aviso',
    };
    return ordem
      .map((status) => this.store.itens().find((i) => i.status === status))
      .filter((i) => !!i)
      .map((i) => ({ codigo: i.codigoQr, rotulo: `${i.nome} (${rotulos[i.status]})`, efeito: efeitos[i.status] }));
  });

  constructor() {
    afterNextRender(() => {
      this.iniciarCamera();
    });

    this.destroyRef.onDestroy(() => {
      this.pararCamera();
    });
  }

  private async iniciarCamera() {
    try {
      this.cameraStatusTexto.set('Ligando a câmera...');
      const scanner = new Html5Qrcode('qr-camera-stream');
      this.html5QrCode = scanner;

      const devices = await Html5Qrcode.getCameras().catch(() => []);
      if (!devices || devices.length === 0) {
        this.usarDigitacao('Sem câmera aqui. Digite o código abaixo.');
        return;
      }

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.75),
              height: Math.floor(minEdge * 0.75),
            };
          },
        },
        (decodedText) => {
          this.rotearCodigo(decodedText);
        },
        () => {
          // Frame sem leitura
        }
      );

      this.cameraAtiva.set(true);
      this.cameraStatusTexto.set('Câmera ativa');
    } catch {
      // Sem permissão, câmera em uso ou página fora de HTTPS/localhost: nada de erro técnico
      this.usarDigitacao('Câmera indisponível. Digite o código abaixo.');
    }
  }

  /** Câmera falhou: mensagem curta e o foco vai para o campo de código. */
  private usarDigitacao(mensagem: string) {
    this.cameraAtiva.set(false);
    this.cameraStatusTexto.set(mensagem);
    this.campoCodigo().nativeElement.focus();
  }

  private async pararCamera() {
    if (this.html5QrCode) {
      try {
        if (this.html5QrCode.isScanning) {
          await this.html5QrCode.stop();
        }
        this.html5QrCode.clear();
      } catch {
        // Ignora erros ao parar câmera
      }
      this.html5QrCode = null;
    }
  }

  processarBuscaManual(event: Event) {
    event.preventDefault();
    this.rotearCodigo(this.codigoDigitado());
  }

  /**
   * Regra de Roteamento do Wireframe R4:
   * - item "reservado" -> leva a /painel/retirada/:itemId (R5)
   * - item "emprestado" ou "atrasado" -> leva a /painel/devolucao/:itemId (R6)
   * - qualquer outro estado, ou código inexistente -> mostra um aviso claro
   */
  private rotearCodigo(codigo: string) {
    const trimmed = (codigo || '').trim().toUpperCase();
    if (!trimmed) {
      this.mensagemAviso.set('Digite o código QR ou o patrimônio do item.');
      return;
    }

    const item = this.store.itens().find(
      (i) => i.codigoQr.toUpperCase() === trimmed || i.patrimonio.toUpperCase() === trimmed
    );

    if (!item) {
      this.mensagemAviso.set(`Nenhum item com o código "${codigo}". Confira o patrimônio na etiqueta.`);
      return;
    }

    if (item.status === 'reservado') {
      // Item reservado por pedido aprovado -> Confirmação de Retirada (R5)
      this.pararCamera();
      this.router.navigate(['/painel/retirada', item.id]);
    } else if (item.status === 'emprestado' || item.status === 'atrasado') {
      // Item em posse de usuário -> Registro de Devolução (R6)
      this.pararCamera();
      this.router.navigate(['/painel/devolucao', item.id]);
    } else if (item.status === 'disponivel') {
      this.mensagemAviso.set(`"${item.nome}" está disponível: não há retirada nem devolução para registrar.`);
    } else if (item.status === 'solicitado') {
      this.mensagemAviso.set(`"${item.nome}" tem um pedido em análise. Aprove-o em Solicitações antes da retirada.`);
    } else if (item.status === 'manutencao') {
      this.mensagemAviso.set(`"${item.nome}" está em manutenção e não pode ser retirado.`);
    } else {
      this.mensagemAviso.set(`"${item.nome}" está com a situação "${item.status}".`);
    }
  }
}
