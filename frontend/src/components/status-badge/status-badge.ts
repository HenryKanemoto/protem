import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {StatusItem, StatusUsuario} from '../../types/models';

/** Cores dos estados de item (tokens em styles.css); contas reaproveitam a mais próxima. */
type Tom = 'disponivel' | 'solicitado' | 'reservado' | 'emprestado' | 'atrasado' | 'manutencao' | 'neutro';

const STATUS: Record<string, {label: string; tom: Tom}> = {
  // Itens
  disponivel: {label: 'Disponível', tom: 'disponivel'},
  solicitado: {label: 'Solicitado', tom: 'solicitado'},
  reservado: {label: 'Reservado', tom: 'reservado'},
  emprestado: {label: 'Emprestado', tom: 'emprestado'},
  atrasado: {label: 'Atrasado', tom: 'atrasado'},
  manutencao: {label: 'Em manutenção', tom: 'manutencao'},
  // Usuários
  ativa: {label: 'Ativa', tom: 'disponivel'},
  pendente: {label: 'Pendente', tom: 'solicitado'},
  bloqueada: {label: 'Bloqueada', tom: 'atrasado'},
  suspensa: {label: 'Suspensa', tom: 'manutencao'},
  recusada: {label: 'Recusada', tom: 'neutro'},
  // Situação final de um pedido no histórico (lib/historico.ts); "pendente", "emprestado" e "atrasado" vêm de cima
  aguardando_retirada: {label: 'Aguardando retirada', tom: 'reservado'},
  recusado: {label: 'Recusado', tom: 'neutro'},
  expirado: {label: 'Expirado', tom: 'neutro'},
  devolvido: {label: 'Devolvido', tom: 'disponivel'},
  devolvido_atraso: {label: 'Devolvido com atraso', tom: 'atrasado'},
  devolvido_avaria: {label: 'Devolvido com avaria', tom: 'manutencao'},
};

const CLASSES: Record<Tom, string> = {
  disponivel: 'bg-disponivel-bg text-disponivel',
  solicitado: 'bg-solicitado-bg text-solicitado',
  reservado: 'bg-reservado-bg text-reservado',
  emprestado: 'bg-emprestado-bg text-emprestado',
  atrasado: 'bg-atrasado-bg text-atrasado',
  manutencao: 'bg-manutencao-bg text-manutencao',
  neutro: 'bg-bg text-text-muted',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap {{ classes() }}"
    >
      <span class="size-1.5 rounded-full bg-current"></span>
      {{ config().label }}
    </span>
  `,
})
export class StatusBadge {
  readonly status = input.required<StatusItem | StatusUsuario | string>();

  readonly config = computed(() => STATUS[this.status()] ?? {label: this.status(), tom: 'neutro' as Tom});
  readonly classes = computed(() => CLASSES[this.config().tom]);
}
