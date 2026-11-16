import {rotuloCategoriaAvaria} from '../store/regras/avaria';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {StatusBadge} from '../components/status-badge/status-badge';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {QrCode} from '../components/qr-code/qr-code';
import {formatDateShort} from '../lib/date-utils';
import {iconeCategoria, plural} from '../lib/categoria-utils';
import {Modal} from '../components/modal/modal';
@Component({
  selector: 'app-r9-item-detalhes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, StatusBadge, ItemThumb, QrCode, Modal],
  templateUrl: './R9ItemDetalhes.html',
})
export class R9ItemDetalhes {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProtemStore);

  readonly plural = plural;

  readonly itemId = computed(() => this.route.snapshot.paramMap.get('id') || '');
  readonly modalEtiquetaAberta = signal(false);
  readonly confirmandoRemocao = signal(false);

  readonly item = computed(() => {
    const id = this.itemId();
    return this.store.itens().find((i) => i.id === id) || null;
  });

  readonly categoria = computed(() => {
    const it = this.item();
    if (!it) return null;
    return this.store.categorias().find((c) => c.id === it.categoriaId) || null;
  });

  readonly subcategoria = computed(() => {
    const id = this.item()?.subcategoriaId;
    return id ? this.store.subcategorias().find((s) => s.id === id) || null : null;
  });

  readonly historicoEmprestimos = computed(() => {
    const it = this.item();
    if (!it) return [];
    return this.store.emprestimos().filter((e) => e.itemId === it.id);
  });

  readonly ocorrenciasItem = computed(() => {
    const it = this.item();
    if (!it) return [];
    return this.store.ocorrencias().filter((o) => o.itemId === it.id);
  });

  readonly rotuloCategoria = rotuloCategoriaAvaria;

  /** Só dá para remover item que não está pedido, reservado nem com alguém. */
  readonly podeRemover = computed(() => {
    const status = this.item()?.status;
    return status === 'disponivel' || status === 'manutencao';
  });

  getUsuario(id?: string) {
    if (!id) return undefined;
    return this.store.usuarios().find((u) => u.id === id);
  }

  formatarData(iso?: string) {
    if (!iso) return '—';
    return formatDateShort(iso);
  }

  getStatusComoVoltou(emp: {devolvidoEm?: string; diasAtraso: number; id: string}): {texto: string; classeCss: string} {
    if (!emp.devolvidoEm) {
      return {texto: 'Em andamento', classeCss: 'bg-info-soft text-info'};
    }
    // Verifica se houve ocorrência com defeito para este empréstimo
    const temOcorrencia = this.store.ocorrencias().some((o) => o.emprestimoId === emp.id);
    if (temOcorrencia) {
      return {texto: 'Com defeito', classeCss: 'bg-maint-soft text-maint'};
    }
    if (emp.diasAtraso > 0) {
      return {texto: `${plural(emp.diasAtraso, 'dia')} de atraso`, classeCss: 'bg-danger-soft text-danger'};
    }
    return {texto: 'No prazo', classeCss: 'bg-ok-soft text-ok'};
  }

  abrirModalEtiqueta() {
    this.modalEtiquetaAberta.set(true);
  }

  executarImpressao() {
    window.print();
  }

  removerItem() {
    const it = this.item();
    if (!it || !this.podeRemover()) return;
    this.store.removerItem(it.id);
    this.router.navigate(['/painel/inventario']);
  }

  getIconeCategoria(categoriaId?: string): string {
    return iconeCategoria(categoriaId);
  }
}
