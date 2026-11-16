import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProtemStore } from '../store/protem.store';
import { MatIconModule } from '@angular/material/icon';
import { ItemThumb } from '../components/item-thumb/item-thumb';
import { CodigoOculto } from '../components/codigo-oculto/codigo-oculto';

import { formatDateShort } from '../lib/date-utils';
import { StatusSolicitacao } from '../types/models';

@Component({
  selector: 'app-s7-meus-codigos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb, CodigoOculto],
  templateUrl: './S7MeusCodigos.html',
})

export class S7MeusCodigos {
  readonly store = inject(ProtemStore);
  readonly usuario = computed(() => this.store.usuarioLogado());
  readonly codigos = this.store.meusCodigos;

  /** Pedidos sem código para usar: aguardando, recusados, expirados e já retirados. */
  readonly outrosPedidos = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store
      .solicitacoes()
      .filter((s) => s.solicitanteId === u.id && s.status !== 'aprovada')
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 5);
  });

  readonly semNada = computed(
    () => this.codigos().retiradas.length === 0 && this.codigos().devolucoes.length === 0,
  );

  /** Texto da situação para pedidos sem código válido. */
  situacao(status: StatusSolicitacao): string {
    return {
      pendente: 'Aguardando aprovação',
      aprovada: 'Retire hoje',
      recusada: 'Pedido recusado',
      expirada: 'Expirou sem retirada',
      concluida: 'Já retirado',
    }[status];
  }

  getItem(itemId?: string) {
    if (!itemId) return undefined;
    return this.store.itens().find((i) => i.id === itemId);
  }

  formatarData(iso?: string) {
    if (!iso) return '—';
    return formatDateShort(iso);
  }
}
