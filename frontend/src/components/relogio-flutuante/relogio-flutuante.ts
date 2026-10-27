import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {Router} from '@angular/router';
import {ProtemStore} from '../../store/protem.store';
import {formatDateTime} from '../../lib/date-utils';
import {rotuloPerfil} from '../../lib/texto-utils';
import {PERFIS_DEMO, PERSONAS_DEMO} from '../../store/demo-data';
import {Usuario} from '../../types/models';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-relogio-flutuante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './relogio-flutuante.html',
})
export class RelogioFlutuante {
  readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  /** No celular, sobe o botão para não ficar em cima da navegação inferior. */
  readonly acimaDaNavegacao = input(false);

  readonly aberto = signal(false);

  readonly dataFormatada = computed(() => formatDateTime(this.store.agora()));

  /** Aluno, professor e responsável do login: começam sem histórico. */
  readonly perfis = computed(() => this.buscar(PERFIS_DEMO).map((u) => ({usuario: u, rotulo: rotuloPerfil(u.perfil)})));

  /** As 10 personas do seed, com o que cada uma mostra. */
  readonly personas = computed(() => {
    const usuarios = this.store.usuarios();
    return PERSONAS_DEMO.flatMap(({id, resumo}) => {
      const usuario = usuarios.find((u) => u.id === id);
      return usuario ? [{usuario, resumo}] : [];
    });
  });

  /** Contas criadas durante a demonstração (cadastro novo), para também dar para entrar com um clique. */
  readonly outras = computed(() => {
    const conhecidas = new Set([...PERFIS_DEMO, ...PERSONAS_DEMO.map((p) => p.id)]);
    return this.store.usuarios().filter((u) => !conhecidas.has(u.id));
  });

  private buscar(ids: string[]): Usuario[] {
    const usuarios = this.store.usuarios();
    return ids.flatMap((id) => usuarios.filter((u) => u.id === id));
  }

  readonly passos = [
    {rotulo: '+1 hora', acao: () => this.store.avancarRelogio(1)},
    {rotulo: '+1 dia', acao: () => this.store.avancarDias(1)},
    {rotulo: '+3 dias', acao: () => this.store.avancarDias(3)},
  ];

  reiniciarDados() {
    this.store.reiniciarDados();
  }

  trocarUsuario(usuarioId: string) {
    this.store.trocarUsuarioDemo(usuarioId);
    const usuario = this.store.usuarios().find((u) => u.id === usuarioId);
    if (!usuario) return;

    const currentUrl = this.router.url;
    // Se o usuário for solicitante e estiver em rota /painel, redirecionar para /catalogo
    if (usuario.perfil !== 'responsavel' && currentUrl.startsWith('/painel')) {
      if (usuario.status === 'pendente') {
        this.router.navigate(['/aguardando']);
      } else {
        this.router.navigate(['/catalogo']);
      }
    } else if (usuario.perfil === 'responsavel' && !currentUrl.startsWith('/painel')) {
      this.router.navigate(['/painel']);
    }
  }
}
