import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {Solicitacao} from '../types/models';
import {differenceInHours, formatDateShort, parseDate} from '../lib/date-utils';
import {Modal} from '../components/modal/modal';
@Component({
  selector: 'app-r2-solicitacoes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, Modal],
  templateUrl: './R2Solicitacoes.html',
})
export class R2Solicitacoes {
  readonly store = inject(ProtemStore);

  readonly feedbackMensagem = signal<string | null>(null);
  readonly solicitacaoParaRecusar = signal<Solicitacao | null>(null);
  readonly erroRecusa = signal<string | null>(null);

  readonly solicitacoesPendentes = computed(() => {
    return this.store.solicitacoes().filter((s) => s.status === 'pendente');
  });

  readonly pedidosAprovadosHoje = computed(() => {
    return this.store.solicitacoes().filter((s) => s.status === 'aprovada');
  });

  getItem(id: string) {
    return this.store.itens().find((i) => i.id === id);
  }

  getUsuario(id: string) {
    return this.store.usuarios().find((u) => u.id === id);
  }

  formatarData(iso: string) {
    return formatDateShort(iso);
  }

  formatarHora(iso: string) {
    const d = parseDate(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  getTempoDecorrido(criadoEm: string): string {
    const agora = this.store.agora();
    const criado = parseDate(criadoEm);
    const diffH = Math.floor(differenceInHours(agora, criado));
    if (diffH <= 0) {
      const diffMin = Math.max(1, Math.floor((agora.getTime() - criado.getTime()) / (1000 * 60)));
      return `${diffMin} min`;
    }
    return `${diffH} h`;
  }

  aprovarPedido(solicitacaoId: string) {
    const respId = this.store.usuarioLogado()?.id || 'user-marta';
    const res = this.store.aprovarPedido(solicitacaoId, respId);
    if (res.sucesso) {
      this.feedbackMensagem.set('Pedido aprovado! O item foi marcado como reservado e aguarda retirada hoje.');
    }
  }

  abrirModalRecusa(solic: Solicitacao) {
    this.erroRecusa.set(null);
    this.solicitacaoParaRecusar.set(solic);
  }

  confirmarRecusa(solicitacaoId: string, motivo: string) {
    const respId = this.store.usuarioLogado()?.id || 'user-marta';
    const res = this.store.recusarPedido(solicitacaoId, respId, motivo);
    if (!res.sucesso) {
      this.erroRecusa.set(res.mensagem);
      return;
    }
    this.solicitacaoParaRecusar.set(null);
    this.feedbackMensagem.set('Pedido recusado. O item retornou como disponível para o catálogo.');
  }
}
