import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {BrandLogo} from '../components/brand-logo/brand-logo';

interface PassoDoFluxo {
  icone: string;
  titulo: string;
  texto: string;
}

interface Pacote {
  nome: string;
  preco: string;
  cobranca: string;
  detalhe: string;
}

/** Página de entrada pública: o que é o Protem, como funciona, os pacotes e o acesso à plataforma. */
@Component({
  selector: 'app-p0-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, BrandLogo],
  templateUrl: './P0Landing.html',
})
export class P0Landing {
  readonly ano = new Date().getFullYear();

  /** O caminho de um pedido (Pedido, Aprovação, Retirada, Devolução). */
  readonly fluxo: PassoDoFluxo[] = [
    {icone: 'search', titulo: 'Pedido', texto: 'Escolha um item no catálogo e diga até quando precisa dele.'},
    {icone: 'task_alt', titulo: 'Aprovação', texto: 'O responsável pelo acervo analisa o pedido. Aprovado, o item fica reservado para você.'},
    {icone: 'qr_code_scanner', titulo: 'Retirada', texto: 'Retire no mesmo dia, mostrando o seu código ou o QR code do item. O prazo começa a contar aí.'},
    {icone: 'assignment_return', titulo: 'Devolução', texto: 'Devolva no prazo. Atraso pode bloquear a conta; item com avaria vai para manutenção.'},
  ];

  /** Passos que já entraram na tela. Os passos só ficam escondidos se o observador estiver ativo. */
  readonly visiveis = signal<ReadonlySet<number>>(new Set());
  readonly animar = signal(false);

  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const lista = this.lista()?.nativeElement;
      // Sem observador ou com "menos animação": tudo aparece já, sem esconder nada
      if (!lista || typeof IntersectionObserver === 'undefined' || this.semMovimento()) return;
      this.animar.set(true);
      const observador = new IntersectionObserver(
        (entradas) => {
          const novos = entradas.filter((e) => e.isIntersecting);
          if (!novos.length) return;
          this.visiveis.update((atual) => {
            const proximo = new Set(atual);
            for (const e of novos) {
              proximo.add(Number((e.target as HTMLElement).dataset['indice']));
              observador.unobserve(e.target);
            }
            return proximo;
          });
        },
        {threshold: 0.3, rootMargin: '0px 0px -8% 0px'},
      );
      Array.from(lista.children).forEach((item) => observador.observe(item));
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  /** Leva a pessoa até a seção e põe o foco no título, para quem usa teclado ou leitor de tela. */
  irParaComoFunciona() {
    const titulo = this.titulo()?.nativeElement;
    if (!titulo) return;
    titulo.scrollIntoView({behavior: this.semMovimento() ? 'auto' : 'smooth', block: 'start'});
    titulo.focus({preventScroll: true});
  }

  private semMovimento(): boolean {
    return (
      document.documentElement.dataset['movimento'] === 'reduzido' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // Pacotes do pitch (valores de exemplo)
  readonly pacotes: Pacote[] = [
    {nome: 'Pequeno porte', preco: 'R$ 2.400', cobranca: 'pagamento único', detalhe: 'Até 100 itens no acervo e 50 usuários'},
    {nome: 'Médio porte', preco: 'R$ 4.200', cobranca: 'pagamento único', detalhe: 'Até 500 itens no acervo e 300 usuários'},
    {nome: 'Grande porte', preco: 'R$ 7.500', cobranca: 'pagamento único', detalhe: 'Até 2.000 itens no acervo e 1.000 usuários'},
    {nome: 'Mentoria digital', preco: 'R$ 250', cobranca: 'pagamento único', detalhe: '2 sessões online de 45 minutos'},
  ];
}
