import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {plural} from '../lib/categoria-utils';

@Component({
  selector: 'app-s2-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb],
  templateUrl: './S2Item.html',
})
export class S2Item {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ProtemStore);

  readonly plural = plural;

  readonly itemId = computed(() => this.route.snapshot.paramMap.get('id') || '');

  readonly item = computed(() => {
    const id = this.itemId();
    return this.store.itens().find((i) => i.id === id) || null;
  });

  readonly subcategoria = computed(() => {
    const id = this.item()?.subcategoriaId;
    return id ? this.store.subcategorias().find((s) => s.id === id) || null : null;
  });

  readonly categoria = computed(() => {
    const it = this.item();
    if (!it) return null;
    return this.store.categorias().find((c) => c.id === it.categoriaId) || null;
  });

  /**
   * Verifica se o usuário atual pode solicitar o item desta categoria (RN03 e RN06).
   */
  readonly permissao = computed(() => {
    const it = this.item();
    if (!it) {
      return {pode: false, motivo: 'Item inexistente.', itensAtuais: 0, limiteMax: 1};
    }
    return this.store.verificarPermissaoSolicitacao(it.categoriaId);
  });
}
