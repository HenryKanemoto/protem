import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {RelogioFlutuante} from '../components/relogio-flutuante/relogio-flutuante';
import {StatusBadge} from '../components/status-badge/status-badge';
import {BrandLogo} from '../components/brand-logo/brand-logo';

@Component({
  selector: 'app-p3-aguardando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, RelogioFlutuante, StatusBadge, BrandLogo],
  templateUrl: './P3Aguardando.html',
})
export class P3Aguardando {
  private readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  // Recupera dados passados pela navegação de P2 caso existam
  private readonly estadoNavegacao = signal<{
    nome?: string;
    email?: string;
    matricula?: string;
    perfil?: string;
  } | null>(null);

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.estadoNavegacao.set(nav.extras.state as {
        nome?: string;
        email?: string;
        matricula?: string;
        perfil?: string;
      });
    } else if (typeof history !== 'undefined' && history.state && history.state.nome) {
      this.estadoNavegacao.set(history.state);
    }
  }

  readonly usuarioAtual = computed(() => this.store.usuarioLogado());

  readonly nomeExibido = computed(() => {
    return (
      this.usuarioAtual()?.nome ||
      this.estadoNavegacao()?.nome ||
      'Diego Alves Barreto'
    );
  });

  readonly emailExibido = computed(() => {
    return (
      this.usuarioAtual()?.email ||
      this.estadoNavegacao()?.email ||
      'diego.barreto@example.com'
    );
  });

  readonly matriculaExibida = computed(() => {
    return (
      this.usuarioAtual()?.matricula ||
      this.estadoNavegacao()?.matricula ||
      'ALU-0110'
    );
  });

  readonly estaAprovada = computed(() => {
    const u = this.usuarioAtual();
    return u ? u.status === 'ativa' : false;
  });

  voltarAoLogin() {
    this.store.logout();
    this.router.navigate(['/login']);
  }

  simularAprovacao() {
    const u = this.usuarioAtual();
    if (u) {
      this.store.aprovarUsuario(u.id);
    } else {
      // Se não havia logado, procura pelo usuário com o e-mail exibido
      const userFound = this.store
        .usuarios()
        .find((usr) => usr.email.toLowerCase() === this.emailExibido().toLowerCase());
      if (userFound) {
        this.store.aprovarUsuario(userFound.id);
        this.store.trocarUsuarioDemo(userFound.id);
      }
    }
  }
}
