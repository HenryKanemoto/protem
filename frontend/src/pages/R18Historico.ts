import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {ProtemStore} from '../store/protem.store';
import {StatusBadge} from '../components/status-badge/status-badge';
import {formatDateShort, parseDate} from '../lib/date-utils';
import {GrupoHistorico, montarHistorico} from '../lib/historico';
import {PERIODOS, Periodo, inicioDoPeriodo} from '../lib/periodo';

/**
 * Histórico: o que aconteceu com cada pedido, do pedido à devolução.
 * Quem fez cada ação fica na auditoria (Relatórios › Auditoria).
 */
@Component({
  selector: 'app-r18-historico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterLink, StatusBadge],
  templateUrl: './R18Historico.html',
})
export class R18Historico {
  readonly store = inject(ProtemStore);

  readonly periodos = PERIODOS;
  readonly periodo = signal<Periodo>('30d');
  readonly busca = signal('');
  readonly pessoaId = signal('');
  readonly grupo = signal<GrupoHistorico | 'todos'>('todos');
  readonly limite = signal(20);

  readonly linhas = computed(() =>
    montarHistorico({
      usuarios: this.store.usuarios(),
      itens: this.store.itens(),
      solicitacoes: this.store.solicitacoes(),
      emprestimos: this.store.emprestimos(),
      ocorrencias: this.store.ocorrencias(),
    }),
  );

  /** Só quem já fez algum pedido aparece no filtro de pessoa. */
  readonly pessoas = computed(() => {
    const ids = new Set(this.linhas().map((l) => l.pessoaId));
    return this.store
      .usuarios()
      .filter((u) => ids.has(u.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  /** Linhas no período, pessoa e busca escolhidos (antes do filtro de situação, para contar cada grupo). */
  private readonly noPeriodo = computed(() => {
    const desde = inicioDoPeriodo(this.periodo(), this.store.agora());
    const pessoa = this.pessoaId();
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    return this.linhas().filter((l) => {
      if (parseDate(l.data).getTime() < desde) return false;
      if (pessoa && l.pessoaId !== pessoa) return false;
      return !termo || `${l.pessoa} ${l.item} ${l.patrimonio}`.toLocaleLowerCase('pt-BR').includes(termo);
    });
  });

  readonly grupos = computed(() => {
    const linhas = this.noPeriodo();
    const contar = (g: GrupoHistorico) => linhas.filter((l) => l.grupos.includes(g)).length;
    return [
      {valor: 'todos' as const, rotulo: 'Todos', total: linhas.length},
      {valor: 'andamento' as const, rotulo: 'Em andamento', total: contar('andamento')},
      {valor: 'devolvidos' as const, rotulo: 'Devolvidos', total: contar('devolvidos')},
      {valor: 'nao_retirados' as const, rotulo: 'Recusados ou expirados', total: contar('nao_retirados')},
      {valor: 'atraso' as const, rotulo: 'Com atraso', total: contar('atraso')},
      {valor: 'avaria' as const, rotulo: 'Com avaria', total: contar('avaria')},
    ];
  });

  readonly filtradas = computed(() => {
    const g = this.grupo();
    return this.noPeriodo().filter((l) => g === 'todos' || l.grupos.includes(g));
  });

  readonly visiveis = computed(() => this.filtradas().slice(0, this.limite()));

  readonly filtrosAtivos = computed(
    () => this.periodo() !== '30d' || !!this.pessoaId() || !!this.busca() || this.grupo() !== 'todos',
  );

  formatarData(iso: string) {
    return formatDateShort(iso);
  }

  limparFiltros() {
    this.periodo.set('30d');
    this.pessoaId.set('');
    this.busca.set('');
    this.grupo.set('todos');
  }
}
