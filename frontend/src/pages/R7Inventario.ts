import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {iconeCategoria} from '../lib/categoria-utils';
import {Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {StatusBadge} from '../components/status-badge/status-badge';
import {ItemThumb} from '../components/item-thumb/item-thumb';

@Component({
  selector: 'app-r7-inventario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, StatusBadge, ItemThumb],
  templateUrl: './R7Inventario.html',
})
export class R7Inventario {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly termoBusca = signal('');
  readonly categoriaSelecionada = signal('todas');
  readonly subcategoriaSelecionada = signal('todas');
  readonly situacaoSelecionada = signal('todas');
  readonly filtrosAbertos = signal(false);
  /** Quantos filtros (além da busca) estão em uso, para mostrar no botão. */
  readonly filtrosAtivos = computed(
    () => Number(this.categoriaSelecionada() !== 'todas') +
      Number(this.subcategoriaSelecionada() !== 'todas') +
      Number(this.situacaoSelecionada() !== 'todas'),
  );

  readonly situacoes = [
    {valor: 'disponivel', rotulo: 'Disponível'},
    {valor: 'solicitado', rotulo: 'Solicitado'},
    {valor: 'reservado', rotulo: 'Reservado'},
    {valor: 'emprestado', rotulo: 'Emprestado'},
    {valor: 'atrasado', rotulo: 'Atrasado'},
    {valor: 'manutencao', rotulo: 'Manutenção'},
    {valor: 'encaminhado', rotulo: 'Encaminhado'},
  ];

  /** Subcategorias da categoria escolhida no filtro (sem categoria escolhida, não há o que filtrar). */
  readonly subcategoriasDoFiltro = computed(() =>
    this.store
      .subcategorias()
      .filter((s) => s.categoriaId === this.categoriaSelecionada())
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );

  escolherCategoria(id: string) {
    this.categoriaSelecionada.set(id);
    this.subcategoriaSelecionada.set('todas');
  }

  readonly itensFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    const catId = this.categoriaSelecionada();
    const subId = this.subcategoriaSelecionada();
    const situacao = this.situacaoSelecionada();

    return this.store.itens().filter((item) => {
      // Filtro de texto por nome ou patrimônio
      if (termo) {
        const nomeMatch = item.nome.toLowerCase().includes(termo);
        const patriMatch = item.patrimonio.toLowerCase().includes(termo);
        const qrMatch = item.codigoQr.toLowerCase().includes(termo);
        const subMatch = this.getSubcategoria(item.subcategoriaId)?.nome.toLowerCase().includes(termo) ?? false;
        if (!nomeMatch && !patriMatch && !qrMatch && !subMatch) {
          return false;
        }
      }

      // Filtro por categoria
      if (catId !== 'todas' && item.categoriaId !== catId) {
        return false;
      }

      // Filtro por subcategoria
      if (subId !== 'todas' && item.subcategoriaId !== subId) {
        return false;
      }

      // Filtro por situação
      if (situacao !== 'todas' && item.status !== situacao) {
        return false;
      }

      return true;
    });
  });

  getCategoria(id: string) {
    return this.store.categorias().find((c) => c.id === id);
  }

  getSubcategoria(id?: string) {
    return id ? this.store.subcategorias().find((s) => s.id === id) : undefined;
  }

  abrirItem(id: string) {
    // Redireciona para R9 Detalhes do item
    this.router.navigate(['/painel/inventario', id]);
  }

  getIconeCategoria(categoriaId: string): string {
    return iconeCategoria(categoriaId);
  }
}
