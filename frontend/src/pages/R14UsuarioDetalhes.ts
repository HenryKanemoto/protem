import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {StatusBadge} from '../components/status-badge/status-badge';
import {Modal} from '../components/modal/modal';
import {formatDateShort} from '../lib/date-utils';
import {MAX_DIAS_SUSPENSAO} from '../store/regras/contas';
import {Emprestimo} from '../types/models';
import {iniciais, rotuloPerfil} from '../lib/texto-utils';
import {plural} from '../lib/categoria-utils';

type AcaoConta = 'suspender' | 'bloquear' | 'reativar';

@Component({
  selector: 'app-r14-usuario-detalhes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, StatusBadge, Modal],
  templateUrl: './R14UsuarioDetalhes.html',
})
export class R14UsuarioDetalhes {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ProtemStore);

  readonly rotuloPerfil = rotuloPerfil;
  readonly maxDias = MAX_DIAS_SUSPENSAO;

  /** Ação aberta no diálogo de confirmação (null = fechado). */
  readonly acao = signal<AcaoConta | null>(null);
  readonly motivo = signal('');
  readonly dias = signal(7);
  readonly erro = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);

  readonly textosAcao: Record<AcaoConta, {titulo: string; explicacao: string; botao: string; placeholder: string}> = {
    suspender: {
      titulo: 'Suspender conta?',
      explicacao: 'A pessoa não poderá pedir itens até a data final. Empréstimos em andamento continuam valendo.',
      botao: 'Suspender conta',
      placeholder: 'Ex.: uso inadequado do laboratório',
    },
    bloquear: {
      titulo: 'Bloquear conta?',
      explicacao: 'A pessoa não poderá pedir itens até você reativar a conta. Nenhuma devolução desfaz o bloqueio.',
      botao: 'Bloquear conta',
      placeholder: 'Ex.: equipamento danificado de propósito',
    },
    reativar: {
      titulo: 'Reativar conta?',
      explicacao: 'A pessoa volta a poder pedir itens a partir de agora.',
      botao: 'Reativar conta',
      placeholder: 'Ex.: situação resolvida com a coordenação',
    },
  };

  readonly usuarioId = computed(() => this.route.snapshot.paramMap.get('id') || '');

  readonly usuario = computed(() => {
    const id = this.usuarioId();
    return this.store.usuarios().find((u) => u.id === id) || null;
  });

  readonly emprestimosUsuario = computed(() => {
    const id = this.usuarioId();
    return this.store.emprestimos().filter((e) => e.usuarioId === id);
  });

  // Contador 1: total de empréstimos
  readonly totalEmprestimos = computed(() => {
    return this.emprestimosUsuario().length;
  });

  // Contador 2: total de empréstimos com atraso
  readonly totalAtrasos = computed(() => {
    return this.emprestimosUsuario().filter((e) => e.diasAtraso > 0).length;
  });

  // Contador 3: total de ocorrências do usuário
  readonly totalOcorrencias = computed(() => {
    const id = this.usuarioId();
    return this.store.ocorrencias().filter((o) => o.usuarioId === id).length;
  });

  /** Por que a conta está bloqueada ou suspensa, em uma frase, ou null se está ativa. */
  readonly situacaoDaConta = computed(() => {
    const u = this.usuario();
    if (!u || (u.status !== 'bloqueada' && u.status !== 'suspensa')) return null;
    const ate = u.suspensoAte ? ` até ${formatDateShort(u.suspensoAte)}` : '';
    const r = u.restricaoManual;
    if (r) {
      const quem = this.store.usuarios().find((x) => x.id === r.porId)?.nome ?? 'responsável';
      const acao = u.status === 'bloqueada' ? 'Bloqueada' : `Suspensa${ate}`;
      return {texto: `${acao} por ${quem} em ${formatDateShort(r.em)}.`, motivo: r.motivo};
    }
    return u.status === 'bloqueada'
      ? {texto: 'Bloqueada automaticamente por item em atraso.', motivo: 'Volta ao normal quando o item for devolvido.'}
      : {texto: `Suspensa${ate} pela política de atraso.`, motivo: 'Devolveu um item com atraso.'};
  });

  abrirAcao(acao: AcaoConta) {
    this.acao.set(acao);
    this.motivo.set('');
    this.dias.set(7);
    this.erro.set(null);
  }

  confirmarAcao() {
    const u = this.usuario();
    const acao = this.acao();
    if (!u || !acao) return;
    const motivo = this.motivo();
    const res =
      acao === 'suspender'
        ? this.store.suspenderUsuario(u.id, motivo, Number(this.dias()))
        : acao === 'bloquear'
          ? this.store.bloquearUsuario(u.id, motivo)
          : this.store.reativarUsuario(u.id, motivo);
    if (!res.sucesso) {
      this.erro.set(res.mensagem);
      return;
    }
    this.acao.set(null);
    this.feedback.set(res.mensagem);
  }

  getItem(id: string) {
    return this.store.itens().find((i) => i.id === id);
  }

  formatarData(iso?: string): string {
    if (!iso) return '—';
    return formatDateShort(iso);
  }

  getIniciais(nome: string): string {
    return iniciais(nome);
  }

  getSituacaoFinal(emp: Emprestimo): { texto: string; classeCss: string } {
    if (!emp.devolvidoEm) {
      if (emp.diasAtraso > 0) {
        return {
          texto: `Atrasado há ${plural(emp.diasAtraso, 'dia')}`,
          classeCss: 'bg-danger-soft text-danger',
        };
      }
      return {
        texto: 'Em andamento',
        classeCss: 'bg-info-soft text-info',
      };
    }

    // Se devolvido, verifica se gerou ocorrência de defeito
    const teveDefeito = this.store.ocorrencias().some((o) => o.emprestimoId === emp.id);
    if (teveDefeito) {
      return {
        texto: 'Devolvido com defeito',
        classeCss: 'bg-maint-soft text-maint',
      };
    }

    if (emp.diasAtraso > 0) {
      return {
        texto: `Devolvido com ${plural(emp.diasAtraso, 'dia')} de atraso`,
        classeCss: 'bg-warn-soft text-warn',
      };
    }

    return {
      texto: 'Devolvido no prazo',
      classeCss: 'bg-ok-soft text-ok',
    };
  }
}
