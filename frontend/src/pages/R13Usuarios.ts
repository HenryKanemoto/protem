import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProtemStore } from '../store/protem.store';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadge } from '../components/status-badge/status-badge';
import { iniciais, rotuloPerfil } from '../lib/texto-utils';
import { formatDateShort } from '../lib/date-utils';
import { StatusUsuario } from '../types/models';

type FiltroStatus = 'todas' | Exclude<StatusUsuario, 'recusada'>;

@Component({
  selector: 'app-r13-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, StatusBadge, RouterLink],
  templateUrl: './R13Usuarios.html',
})
export class R13Usuarios {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly termoBusca = signal('');
  readonly filtroStatus = signal<FiltroStatus>('todas');

  /** Filtros de situação, sempre visíveis, com quantas contas há em cada um. */
  readonly opcoesStatus = computed(() => {
    const todos = this.store.usuarios();
    const contar = (s: StatusUsuario) => todos.filter((u) => u.status === s).length;
    return [
      {valor: 'todas' as FiltroStatus, rotulo: 'Todas', total: todos.length},
      {valor: 'ativa' as FiltroStatus, rotulo: 'Ativas', total: contar('ativa')},
      {valor: 'bloqueada' as FiltroStatus, rotulo: 'Bloqueadas', total: contar('bloqueada')},
      {valor: 'suspensa' as FiltroStatus, rotulo: 'Suspensas', total: contar('suspensa')},
      {valor: 'pendente' as FiltroStatus, rotulo: 'Pendentes', total: contar('pendente')},
    ];
  });

  readonly rotuloPerfil = rotuloPerfil;

  readonly usuariosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    const status = this.filtroStatus();
    const todos = this.store.usuarios().filter((u) => status === 'todas' || u.status === status);

    if (!termo) {
      return todos;
    }

    return todos.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.matricula.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo)
    );
  });

  abrirUsuario(id: string) {
    this.router.navigate(['/painel/usuarios', id]);
  }

  formatarData(iso: string): string {
    return formatDateShort(iso);
  }

  getIniciais(nome: string): string {
    return iniciais(nome);
  }
}
