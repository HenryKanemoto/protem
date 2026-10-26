import {ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {Item} from '../types/models';
import {iconeCategoria, plural} from '../lib/categoria-utils';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {
  differenceInHours,
  formatDateShort,
  parseDate,
} from '../lib/date-utils';

/** Seções da página. Os links antigos com ?aba= rolam até a seção certa. */
const SECAO_POR_ABA: Record<string, string> = {ativos: 'com-voce', pendentes: 'pedidos', historico: 'historico'};

interface ItemHistorico {
  tipo: 'emprestimo' | 'solicitacao';
  id: string;
  itemId: string;
  item?: Item;
  situacaoFinal: 'devolvido' | 'devolvido_defeito' | 'recusado' | 'expirado';
  rotuloSituacao: string;
  dataEvento: string;
  detalhe?: string;
}

@Component({
  selector: 'app-s4-meus-emprestimos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb],
  templateUrl: './S4MeusEmprestimos.html',
})
export class S4MeusEmprestimos {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProtemStore);

  readonly mensagemSucesso = signal<string | null>(null);
  /** O histórico mostra os mais recentes; o botão diz quantos existem. */
  readonly verTodoHistorico = signal(false);
  readonly limiteHistorico = 5;

  readonly plural = plural;

  readonly situacoes: Record<ItemHistorico['situacaoFinal'], {icone: string; classe: string}> = {
    devolvido: {icone: 'done_all', classe: 'bg-ok-soft text-ok'},
    devolvido_defeito: {icone: 'build', classe: 'bg-maint-soft text-maint'},
    recusado: {icone: 'block', classe: 'bg-danger-soft text-danger'},
    expirado: {icone: 'timer_off', classe: 'bg-warn-soft text-warn'},
  };

  constructor() {
    // Links antigos com ?aba=pendentes | ativos | historico: rola até a seção correspondente
    const secao = SECAO_POR_ABA[this.route.snapshot.queryParamMap.get('aba') ?? ''];
    if (secao) {
      afterNextRender(() => document.getElementById(secao)?.scrollIntoView({block: 'start'}));
    }

    // Ler mensagem de sucesso enviada via navigation state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state && (nav.extras.state as { sucesso?: string }).sucesso) {
      this.mensagemSucesso.set((nav.extras.state as { sucesso: string }).sucesso);
    } else if (typeof history !== 'undefined' && history.state && history.state.sucesso) {
      this.mensagemSucesso.set(history.state.sucesso);
    }
  }

  readonly usuario = computed(() => this.store.usuarioLogado());

  // 1. Pedidos Aprovados (Aguardando retirada hoje - RN04)
  readonly pedidosAprovados = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store
      .solicitacoes()
      .filter((s) => s.solicitanteId === u.id && s.status === 'aprovada');
  });

  // 2. Pedidos Aguardando Análise
  readonly pedidosAguardandoAnalise = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store
      .solicitacoes()
      .filter((s) => s.solicitanteId === u.id && s.status === 'pendente');
  });

  readonly totalPendentes = computed(() => {
    return this.pedidosAprovados().length + this.pedidosAguardandoAnalise().length;
  });

  // 3. Empréstimos Ativos
  readonly listaEmprestimosAtivos = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return this.store
      .emprestimos()
      .filter((e) => e.usuarioId === u.id && !e.devolvidoEm);
  });

  readonly totalAtivos = computed(() => this.listaEmprestimosAtivos().length);

  // 4. Histórico Encerrado
  readonly listaHistorico = computed<ItemHistorico[]>(() => {
    const u = this.usuario();
    if (!u) return [];

    const lista: ItemHistorico[] = [];

    // Empréstimos devolvidos
    const dev = this.store
      .emprestimos()
      .filter((e) => e.usuarioId === u.id && !!e.devolvidoEm);

    dev.forEach((emp) => {
      const item = this.getItem(emp.itemId);
      const temOcorrencia = this.store
        .ocorrencias()
        .some((o) => o.emprestimoId === emp.id || (o.itemId === emp.itemId && o.usuarioId === u.id));

      lista.push({
        tipo: 'emprestimo',
        id: emp.id,
        itemId: emp.itemId,
        item,
        situacaoFinal: temOcorrencia ? 'devolvido_defeito' : 'devolvido',
        rotuloSituacao: temOcorrencia ? 'Devolvido com defeito' : 'Devolvido',
        dataEvento: emp.devolvidoEm || emp.retiradoEm,
        detalhe: emp.diasAtraso > 0 ? `Devolvido com ${emp.diasAtraso} dia(s) de atraso` : undefined,
      });
    });

    // Solicitações recusadas ou expiradas
    const solicEncerradas = this.store
      .solicitacoes()
      .filter((s) => s.solicitanteId === u.id && (s.status === 'recusada' || s.status === 'expirada'));

    solicEncerradas.forEach((sol) => {
      const item = this.getItem(sol.itemId);
      lista.push({
        tipo: 'solicitacao',
        id: sol.id,
        itemId: sol.itemId,
        item,
        situacaoFinal: sol.status === 'recusada' ? 'recusado' : 'expirado',
        rotuloSituacao: sol.status === 'recusada' ? 'Recusado' : 'Expirado',
        dataEvento: sol.avaliadoEm || sol.criadoEm,
        detalhe: sol.status === 'expirada' ? 'Não retirado no dia da aprovação' : undefined,
      });
    });

    // Ordenar pelo evento mais recente primeiro
    return lista.sort((a, b) => new Date(b.dataEvento).getTime() - new Date(a.dataEvento).getTime());
  });

  getItem(itemId?: string) {
    if (!itemId) return undefined;
    return this.store.itens().find((i) => i.id === itemId);
  }

  formatarData(iso?: string) {
    if (!iso) return '—';
    return formatDateShort(iso);
  }

  formatarHora(iso?: string) {
    if (!iso) return '—';
    const d = parseDate(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  getTempoDecorrido(criadoEm: string): string {
    const agora = this.store.agora();
    const criado = parseDate(criadoEm);
    const diffH = Math.floor(differenceInHours(agora, criado));
    if (diffH <= 0) {
      const diffMin = Math.max(1, Math.floor((agora.getTime() - criado.getTime()) / (1000 * 60)));
      return `pedido há ${diffMin} min`;
    }
    return `pedido há ${diffH} h`;
  }

  getHorasRestantesParaLembrete(criadoEm: string): string {
    const agora = this.store.agora();
    const criado = parseDate(criadoEm);
    const diffH = differenceInHours(agora, criado);
    const rest = 2 - diffH;
    if (rest <= 0) return 'agora';
    const minutos = Math.ceil(rest * 60);
    if (minutos < 60) return `${minutos} min`;
    return `${Math.ceil(rest)} h`;
  }

  /** Dias de calendário até a devolução, em texto: "Vence hoje", "Vence amanhã", "Faltam 3 dias". */
  getDiasRestantes(devolucaoPrevista: string): string {
    const agora = this.store.agora();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const diffDias = Math.round((parseDate(devolucaoPrevista).getTime() - hoje) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return `Venceu há ${plural(-diffDias, 'dia')}`;
    if (diffDias === 0) return 'Vence hoje';
    if (diffDias === 1) return 'Vence amanhã';
    return `Faltam ${plural(diffDias, 'dia')}`;
  }

  lembrarResponsavel(solicitacaoId: string) {
    const res = this.store.enviarLembrete(solicitacaoId);
    if (res.sucesso) {
      this.mensagemSucesso.set('Lembrete enviado ao responsável com sucesso!');
    }
  }

  getIconeCategoria(categoriaId?: string): string {
    return iconeCategoria(categoriaId);
  }
}
