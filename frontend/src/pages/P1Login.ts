import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {RelogioFlutuante} from '../components/relogio-flutuante/relogio-flutuante';
import {Usuario} from '../types/models';
import {BrandLogo} from '../components/brand-logo/brand-logo';

@Component({
  selector: 'app-p1-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, RelogioFlutuante, BrandLogo],
  templateUrl: './P1Login.html',
})
export class P1Login {
  private readonly store = inject(ProtemStore);
  private readonly router = inject(Router);

  readonly identificador = signal('');
  readonly senha = signal('');
  readonly mostrarSenha = signal(false);
  readonly mensagemErro = signal<string | null>(null);

  readonly ano = new Date().getFullYear();

  readonly demos = [
    {perfil: 'aluno' as const, rotulo: 'Aluno', nome: 'Camila Cristina'},
    {perfil: 'professor' as const, rotulo: 'Professor', nome: 'Gustavo Machado'},
    {perfil: 'responsavel' as const, rotulo: 'Responsável', nome: 'Enzo Capiel'},
  ];

  // Decoração do painel lateral
  readonly etiquetas = [
    {codigo: 'NX-0001', nome: 'Projetor Epson', recuo: 40},
    {codigo: 'NX-0006', nome: 'Kit Arduino', recuo: 0},
    {codigo: 'NX-0013', nome: 'Microscópio', recuo: 64},
  ];

  alternarVisibilidadeSenha() {
    this.mostrarSenha.update((v) => !v);
  }

  preencherEEntrar(perfil: 'aluno' | 'professor' | 'responsavel') {
    if (perfil === 'aluno') {
      this.identificador.set('camila@example.com');
      this.senha.set('123456');
    } else if (perfil === 'professor') {
      this.identificador.set('gustavo@example.com');
      this.senha.set('123456');
    } else {
      this.identificador.set('enzo@example.com');
      this.senha.set('123456');
    }
    this.mensagemErro.set(null);
    this.executarLogin();
  }

  submeterLogin(event: Event) {
    event.preventDefault();
    this.executarLogin();
  }

  private executarLogin() {
    const idVal = this.identificador().trim();
    const passVal = this.senha().trim();

    if (!idVal) {
      this.mensagemErro.set('Por favor, informe seu e-mail ou matrícula.');
      return;
    }

    if (!passVal) {
      this.mensagemErro.set('Por favor, informe sua senha.');
      return;
    }

    const resultado = this.store.login(idVal, passVal);

    if (resultado.sucesso && resultado.usuario) {
      this.redirecionarAposLogin(resultado.usuario);
    } else {
      this.mensagemErro.set(resultado.mensagem || 'E-mail, matrícula ou senha incorretos.');
    }
  }

  /**
   * Regras de Redirecionamento pós-login:
   * - Solicitante ativo -> /catalogo
   * - Responsável -> /painel
   * - Conta pendente -> /aguardando (RN08)
   * - Conta bloqueada ou suspensa -> /perfil (não pode solicitar)
   */
  private redirecionarAposLogin(usuario: Usuario) {
    if (usuario.perfil === 'responsavel') {
      this.router.navigate(['/painel']);
      return;
    }

    if (usuario.status === 'pendente') {
      this.router.navigate(['/aguardando']);
      return;
    }

    if (usuario.status === 'bloqueada' || usuario.status === 'suspensa') {
      this.router.navigate(['/perfil']);
      return;
    }

    // Solicitante ativo
    this.router.navigate(['/catalogo']);
  }
}
