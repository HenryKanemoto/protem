import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {BrandLogo} from '../components/brand-logo/brand-logo';
import {iconeCategoria, plural} from '../lib/categoria-utils';
import {formatDateShort} from '../lib/date-utils';

@Component({
  selector: 'app-s1-catalogo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb, BrandLogo],
  templateUrl: './S1Catalogo.html',
})
export class S1Catalogo {
  readonly store = inject(ProtemStore);

  readonly termoBusca = signal('');
  readonly categoriaSelecionada = signal<string>('todas');
  readonly subcategoriaSelecionada = signal<string>('todas');

  readonly usuario = computed(() => this.store.usuarioLogado());

  readonly plural = plural;

  /** Chips de categoria com a quantidade de itens disponíveis em cada uma. */
  readonly filtros = computed(() => {
    const disponiveis = this.store.itensCatalogo();
    return [
      {id: 'todas', nome: 'Todas', total: disponiveis.length},
      ...this.store.categorias().map((cat) => ({
        id: cat.id,
        nome: cat.nome,
        total: disponiveis.filter((i) => i.categoriaId === cat.id).length,
      })),
    ];
  });

  /** Subcategorias da categoria escolhida, com os itens disponíveis em cada uma (só as que têm algo a mostrar ou estão escolhidas). */
  readonly subfiltros = computed(() => {
    const catId = this.categoriaSelecionada();
    if (catId === 'todas') return [];
    const daCategoria = this.store.itensCatalogo().filter((i) => i.categoriaId === catId);
    const subs = this.store
      .subcategorias()
      .filter((s) => s.categoriaId === catId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((s) => ({id: s.id, nome: s.nome, total: daCategoria.filter((i) => i.subcategoriaId === s.id).length}));
    if (subs.length === 0) return [];
    return [{id: 'todas', nome: 'Todas', total: daCategoria.length}, ...subs];
  });

  escolherCategoria(id: string) {
    this.categoriaSelecionada.set(id);
    this.subcategoriaSelecionada.set('todas');
  }

  /**
   * RN09: Somente itens com status "disponivel" aparecem no catálogo.
   */
  readonly itensFiltrados = computed(() => {
    // store.itensCatalogo() já filtra por status === 'disponivel'
    let lista = this.store.itensCatalogo();

    const catId = this.categoriaSelecionada();
    if (catId !== 'todas') {
      lista = lista.filter((i) => i.categoriaId === catId);
    }

    const subId = this.subcategoriaSelecionada();
    if (subId !== 'todas') {
      lista = lista.filter((i) => i.subcategoriaId === subId);
    }

    const busca = this.termoBusca().trim().toLowerCase();
    if (busca) {
      lista = lista.filter(
        (i) =>
          i.nome.toLowerCase().includes(busca) ||
          i.descricao.toLowerCase().includes(busca) ||
          i.patrimonio.toLowerCase().includes(busca) ||
          (this.getSubcategoria(i.subcategoriaId)?.nome.toLowerCase().includes(busca) ?? false),
      );
    }

    return lista;
  });

  getCategoria(categoriaId: string) {
    return this.store.categorias().find((c) => c.id === categoriaId);
  }

  getSubcategoria(id?: string) {
    return id ? this.store.subcategorias().find((s) => s.id === id) : undefined;
  }

  getIconeCategoria(categoriaId: string): string {
    return iconeCategoria(categoriaId);
  }

  limparFiltros() {
    this.termoBusca.set('');
    this.categoriaSelecionada.set('todas');
    this.subcategoriaSelecionada.set('todas');
  }

  formatarData(iso?: string) {
    return iso ? formatDateShort(iso) : '';
  }
}
