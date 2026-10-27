import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterOutlet} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {filter, map} from 'rxjs';
import {MatIconModule} from '@angular/material/icon';
import {ProtemStore} from '../../store/protem.store';
import {RelogioFlutuante} from '../../components/relogio-flutuante/relogio-flutuante';
import {BrandLogo} from '../../components/brand-logo/brand-logo';
import {AvisoApi} from '../../components/aviso-api/aviso-api';
import {iniciais} from '../../lib/texto-utils';

interface NavItem {
  rotulo: string;
  rota: string;
  icone: string;
  badge?: () => number;
  /** Outras rotas que acendem este item (telas que não têm entrada própria no menu). */
  tambemEm?: string[];
}

interface NavGrupo {
  titulo: string;
  itens: NavItem[];
}

@Component({
  selector: 'app-responsavel-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, MatIconModule, RelogioFlutuante, BrandLogo, AvisoApi],
  templateUrl: './responsavel-layout.html',
})
export class ResponsavelLayout {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly drawerAberto = signal(false);
  readonly iniciais = computed(() => iniciais(this.store.usuarioLogado()?.nome));

  /** Rota atual, para acender o item do menu (inclusive telas sem entrada própria). */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    {initialValue: this.router.url},
  );

  readonly menu: NavGrupo[] = [
    {
      titulo: 'Operação',
      itens: [
        {rotulo: 'Painel', rota: '/painel', icone: 'space_dashboard'},
        {
          rotulo: 'Solicitações',
          rota: '/painel/solicitacoes',
          icone: 'inbox',
          badge: () => this.store.solicitacoesPendentesCount(),
          tambemEm: ['/painel/retirada'],
        },
        {rotulo: 'Leitor de QR code', rota: '/painel/leitor', icone: 'qr_code_scanner', tambemEm: ['/painel/devolucao']},
      ],
    },
    {
      titulo: 'Acervo',
      itens: [
        {rotulo: 'Itens', rota: '/painel/itens', icone: 'inventory_2'},
        {rotulo: 'Categorias', rota: '/painel/categorias', icone: 'category'},
        {
          rotulo: 'Manutenção',
          rota: '/painel/manutencao',
          icone: 'build',
          badge: () => this.store.ocorrenciasAbertasCount(),
        },
      ],
    },
    {
      titulo: 'Gestão',
      itens: [
        // Aprovação de cadastros (Contas) fica dentro de Usuários
        {
          rotulo: 'Usuários',
          rota: '/painel/usuarios',
          icone: 'group',
          badge: () => this.store.contasPendentesCount(),
          tambemEm: ['/painel/contas'],
        },
        // Histórico: o caminho de cada pedido. Relatórios: visão da instituição e auditoria
        {rotulo: 'Histórico', rota: '/painel/historico', icone: 'history'},
        {rotulo: 'Relatórios', rota: '/painel/relatorios', icone: 'insights'},
        {rotulo: 'Configurações', rota: '/painel/configuracoes', icone: 'tune'},
      ],
    },
  ];

  ativo(item: NavItem): boolean {
    const caminho = this.url().split(/[?#]/)[0];
    const confere = (rota: string) =>
      rota === '/painel' ? caminho === rota : caminho === rota || caminho.startsWith(rota + '/');
    return confere(item.rota) || (item.tambemEm ?? []).some(confere);
  }

  toggleDrawer() {
    this.drawerAberto.update((v) => !v);
  }

  fecharDrawer() {
    this.drawerAberto.set(false);
  }

  sair() {
    this.fecharDrawer();
    this.store.logout();
    this.router.navigate(['/login']);
  }
}
