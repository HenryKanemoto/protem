import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {Usuario} from '../types/models';

/**
 * Conta que ainda não pode usar o sistema: pendente (RN08) ou com o cadastro recusado.
 * As duas vão para /aguardando, que explica a situação.
 */
function aguardandoOuRecusada(usuario: Usuario): boolean {
  return usuario.status === 'pendente' || usuario.status === 'recusada';
}

/**
 * Guard para rotas de Solicitante (/catalogo, /item/:id, /solicitar/:id, /meus-emprestimos, /notificacoes, /perfil).
 * Permite apenas perfis 'aluno' ou 'professor'.
 * Se for 'responsavel', redireciona para /painel.
 * Se a conta estiver pendente ou recusada, redireciona para /aguardando.
 * Se não logado, redireciona para /login.
 */
export const solicitanteGuard: CanActivateFn = () => {
  const store = inject(ProtemStore);
  const router = inject(Router);
  const usuario = store.usuarioLogado();

  if (!usuario) {
    return router.parseUrl('/login');
  }

  if (aguardandoOuRecusada(usuario)) {
    return router.parseUrl('/aguardando');
  }

  if (usuario.perfil === 'responsavel') {
    return router.parseUrl('/painel');
  }

  return true;
};

/**
 * Guard específico para a rota /solicitar/:id:
 * Usuário com status 'bloqueada' ou 'suspensa' NÃO pode solicitar; deve ir para /perfil.
 */
export const podeSolicitarGuard: CanActivateFn = () => {
  const store = inject(ProtemStore);
  const router = inject(Router);
  const usuario = store.usuarioLogado();

  if (!usuario) {
    return router.parseUrl('/login');
  }

  if (aguardandoOuRecusada(usuario)) {
    return router.parseUrl('/aguardando');
  }

  if (usuario.status === 'bloqueada' || usuario.status === 'suspensa') {
    return router.parseUrl('/perfil');
  }

  return true;
};

/**
 * Guard para rotas do Responsável (/painel e sub-rotas).
 * Permite apenas perfil 'responsavel'.
 * Se a conta estiver pendente ou recusada, redireciona para /aguardando.
 * Se for solicitante, redireciona para /catalogo (ou /perfil se bloqueado/suspenso).
 * Se não logado, redireciona para /login.
 */
export const responsavelGuard: CanActivateFn = () => {
  const store = inject(ProtemStore);
  const router = inject(Router);
  const usuario = store.usuarioLogado();

  if (!usuario) {
    return router.parseUrl('/login');
  }

  if (aguardandoOuRecusada(usuario)) {
    return router.parseUrl('/aguardando');
  }

  if (usuario.perfil !== 'responsavel') {
    if (usuario.status === 'bloqueada' || usuario.status === 'suspensa') {
      return router.parseUrl('/perfil');
    }
    return router.parseUrl('/catalogo');
  }

  return true;
};

/**
 * Guard para rotas públicas (como /cadastro):
 * Se a conta atual estiver pendente ou recusada, redireciona para /aguardando.
 */
export const cadastroPublicGuard: CanActivateFn = () => {
  const store = inject(ProtemStore);
  const router = inject(Router);
  const usuario = store.usuarioLogado();

  if (usuario && aguardandoOuRecusada(usuario)) {
    return router.parseUrl('/aguardando');
  }

  return true;
};
