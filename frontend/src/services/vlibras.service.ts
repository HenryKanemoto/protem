import {DOCUMENT} from '@angular/common';
import {Injectable, effect, inject, signal, untracked} from '@angular/core';
import {Acessibilidade} from './acessibilidade.service';

/** desligado: nada foi pedido · carregando: esperando o serviço · ligado: o botão do VLibras está na tela · bloqueado: a rede não deixou. */
export type EstadoVlibras = 'desligado' | 'carregando' | 'ligado' | 'bloqueado';

/** Endereço oficial do widget (gov.br). É o único lugar de fora que o Protem chama, e só se a pessoa ligar. */
export const CAMINHO_VLIBRAS = 'https://vlibras.gov.br/app';
const LIMITE_MS = 12_000;

interface WidgetVlibras {
  Widget: new (caminho: string) => unknown;
}

/**
 * VLibras (tradução do texto da tela para Libras), opcional e sob demanda.
 *
 * O widget é do governo e roda nos servidores dele: não dá para hospedá-lo no Protem. Por isso ele
 * nunca é carregado sozinho. Ao ligar o interruptor no painel de acessibilidade, o serviço:
 * 1. carrega o script do VLibras; 2. confere que os arquivos do serviço também chegam
 * (firewall pode liberar um e bloquear o outro); 3. só então cria o botão do widget.
 * Se algo falhar ou demorar mais que o limite, o estado vira "bloqueado", o interruptor volta a
 * desligado e o painel mostra uma mensagem simples. O resto do app não é afetado.
 *
 * O widget cria os elementos dele no <body>, sem forma de desmontá-los. Para "desligar" sem
 * recarregar a página, o <html> ganha data-vlibras="off" e o styles.css esconde os elementos.
 */
@Injectable({providedIn: 'root'})
export class Vlibras {
  private readonly acessibilidade = inject(Acessibilidade);
  private readonly documento = inject(DOCUMENT);

  private readonly _estado = signal<EstadoVlibras>('desligado');
  readonly estado = this._estado.asReadonly();

  private scriptCarregado = false;
  private widgetCriado = false;
  /** Pedidos mais novos invalidam os antigos (liga, desliga e liga de novo enquanto carrega). */
  private pedido = 0;

  constructor() {
    effect(() => {
      const quer = this.acessibilidade.preferencias().vlibras;
      untracked(() => (quer ? void this.ligar() : this.desligar()));
    });
  }

  /** Some a mensagem de "bloqueado" (o painel chama ao fechar). */
  limparAviso() {
    if (this._estado() === 'bloqueado') this._estado.set('desligado');
  }

  private async ligar() {
    const meu = ++this.pedido;
    if (this.widgetCriado && this.scriptCarregado) {
      this.mostrar(true);
      this._estado.set('ligado');
      return;
    }
    this._estado.set('carregando');
    const ok = await this.preparar();
    if (meu !== this.pedido) return; // a pessoa mudou de ideia no meio do caminho
    if (ok) {
      this.mostrar(true);
      this._estado.set('ligado');
    } else {
      this._estado.set('bloqueado');
      this.mostrar(false);
      // Volta o interruptor: assim o app não tenta de novo, e demora de novo, a cada abertura
      this.acessibilidade.atualizar({vlibras: false});
    }
  }

  private desligar() {
    this.pedido++;
    this.mostrar(false);
    if (this._estado() !== 'bloqueado') this._estado.set('desligado');
  }

  private mostrar(visivel: boolean) {
    const html = this.documento.documentElement;
    if (visivel) html.removeAttribute('data-vlibras');
    else html.setAttribute('data-vlibras', 'off');
  }

  private async preparar(): Promise<boolean> {
    if (!this.scriptCarregado) {
      this.scriptCarregado = await this.carregarScript();
      if (!this.scriptCarregado) return false;
    }
    if (!(await this.servicoResponde())) return false;
    if (!this.widgetCriado) {
      const janela = this.documento.defaultView as (Window & {VLibras?: WidgetVlibras}) | null;
      const Widget = janela?.VLibras?.Widget;
      if (!Widget) return false;
      try {
        new Widget(CAMINHO_VLIBRAS);
        this.widgetCriado = true;
      } catch {
        return false;
      }
    }
    return true;
  }

  private carregarScript(): Promise<boolean> {
    return new Promise((resolve) => {
      const script = this.documento.createElement('script');
      script.src = `${CAMINHO_VLIBRAS}/vlibras-plugin.js`;
      script.async = true;
      const terminar = (ok: boolean) => {
        clearTimeout(limite);
        if (!ok) script.remove();
        resolve(ok);
      };
      const limite = setTimeout(() => terminar(false), LIMITE_MS);
      script.onload = () => terminar(true);
      script.onerror = () => terminar(false);
      this.documento.head.appendChild(script);
    });
  }

  /** Pede o ícone do botão ao serviço: se ele chega, os arquivos do widget também devem chegar. */
  private servicoResponde(): Promise<boolean> {
    return new Promise((resolve) => {
      const imagem = new Image();
      const limite = setTimeout(() => resolve(false), LIMITE_MS);
      imagem.onload = () => (clearTimeout(limite), resolve(true));
      imagem.onerror = () => (clearTimeout(limite), resolve(false));
      imagem.src = `${CAMINHO_VLIBRAS}/assets/images/vlibras-access.svg`;
    });
  }
}
