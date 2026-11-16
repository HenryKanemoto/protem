import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {iconeCategoria, plural} from '../lib/categoria-utils';
import {RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-r10-categorias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './R10Categorias.html',
})
export class R10Categorias {
  readonly store = inject(ProtemStore);

  readonly plural = plural;

  contarItens(catId: string): number {
    return this.store.itens().filter((i) => i.categoriaId === catId).length;
  }

  nomesSubcategorias(catId: string): string {
    return this.store
      .subcategorias()
      .filter((s) => s.categoriaId === catId)
      .map((s) => s.nome)
      .join(', ');
  }

  getIconeCategoria(categoriaId: string): string {
    return iconeCategoria(categoriaId);
  }
}
