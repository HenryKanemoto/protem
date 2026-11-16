import {DOCUMENT} from '@angular/common';
import {Injectable, effect, inject, signal, untracked} from '@angular/core';
import {
  PREFERENCIAS_PADRAO,
  PreferenciasAcessibilidade,
  atributosDe,
  chaveDe,
  lerPreferencias,
} from '../lib/acessibilidade';
import {ProtemStore} from '../store/protem.store';

/**
 * Preferências de acessibilidade da pessoa que está usando o app.
 *
 * - Ficam no navegador, por usuário (`protem:a11y:v1:<id>`), fora do estado principal.
 *   Quem ainda não escolheu nada herda a última escolha feita neste aparelho (`protem:a11y:v1`),
 *   que também vale para a tela de entrada.
 * - Cada mudança é aplicada na hora no <html> (data-tema, data-contraste, data-movimento,
 *   data-espaco e o tamanho da fonte); as cores de cada tema estão em styles.css.
 */
@Injectable({providedIn: 'root'})
export class Acessibilidade {
  private readonly store = inject(ProtemStore);
  private readonly documento = inject(DOCUMENT);

  private readonly _preferencias = signal<PreferenciasAcessibilidade>(this.inicial());
  readonly preferencias = this._preferencias.asReadonly();

  /**
   * O painel abre pela tela inteira, fora dos cabeçalhos (que têm a sua própria pilha de camadas
   * e deixariam o diálogo atrás do menu e do botão de demonstração). Os botões só ligam este sinal.
   */
  readonly painelAberto = signal(false);

  constructor() {
    // Troca de usuário: carrega o que essa pessoa escolheu (se escolheu algo)
    effect(() => {
      const id = this.store.usuarioLogado()?.id ?? null;
      untracked(() => {
        const guardado = id ? this.ler(chaveDe(id)) : null;
        if (guardado) this._preferencias.set(lerPreferencias(guardado, this._preferencias()));
      });
    });

    effect(() => this.aplicar(this._preferencias()));
  }

  atualizar(mudanca: Partial<PreferenciasAcessibilidade>) {
    const novas = {...this._preferencias(), ...mudanca};
    this._preferencias.set(novas);
    const texto = JSON.stringify(novas);
    const id = this.store.usuarioLogado()?.id ?? null;
    if (id) this.gravar(chaveDe(id), texto);
    this.gravar(chaveDe(null), texto);
  }

  restaurar() {
    this.atualizar({...PREFERENCIAS_PADRAO});
  }

  private inicial(): PreferenciasAcessibilidade {
    const guardado = this.ler(chaveDe(null));
    if (guardado) return lerPreferencias(guardado);
    // Primeira visita: respeita o "reduzir movimento" do sistema operacional
    const reduzir = this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    return {...PREFERENCIAS_PADRAO, menosAnimacao: reduzir};
  }

  private aplicar(preferencias: PreferenciasAcessibilidade) {
    const html = this.documento.documentElement;
    const atributos = atributosDe(preferencias);
    const definir = (nome: string, valor: string | null) => (valor ? html.setAttribute(nome, valor) : html.removeAttribute(nome));
    definir('data-tema', atributos.tema);
    definir('data-contraste', atributos.contraste);
    definir('data-movimento', atributos.movimento);
    definir('data-espaco', atributos.espaco);
    html.style.fontSize = atributos.tamanhoFonte ?? '';
  }

  private ler(chave: string): string | null {
    try {
      return this.documento.defaultView?.localStorage.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }

  private gravar(chave: string, texto: string) {
    try {
      this.documento.defaultView?.localStorage.setItem(chave, texto);
    } catch {
      // Sem armazenamento (janela privada, cota cheia): a escolha vale só até recarregar
    }
  }
}
