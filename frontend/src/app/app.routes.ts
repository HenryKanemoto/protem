import {Routes} from '@angular/router';
import {
  cadastroPublicGuard,
  podeSolicitarGuard,
  responsavelGuard,
  solicitanteGuard,
} from '../guards/auth.guard';
import {SolicitanteLayout} from '../layouts/solicitante-layout/solicitante-layout';
import {ResponsavelLayout} from '../layouts/responsavel-layout/responsavel-layout';

export const routes: Routes = [
  // Rotas Públicas / Acesso
  {
    path: '',
    pathMatch: 'full',
    title: 'Protem · Plataforma Web de Empréstimos',
    loadComponent: () => import('../pages/P0Landing').then((m) => m.P0Landing),
  },
  {
    path: 'login',
    title: 'Entrar · Protem · Plataforma Web de Empréstimos',
    loadComponent: () => import('../pages/P1Login').then((m) => m.P1Login),
  },
  {
    path: 'cadastro',
    title: 'Cadastro · Protem',
    canActivate: [cadastroPublicGuard],
    loadComponent: () => import('../pages/P2Cadastro').then((m) => m.P2Cadastro),
  },
  {
    path: 'acessibilidade',
    title: 'Acessibilidade · Protem',
    loadComponent: () => import('../pages/P4Acessibilidade').then((m) => m.P4Acessibilidade),
  },
  {
    path: 'aguardando',
    title: 'Aguardando aprovação · Protem',
    loadComponent: () => import('../pages/P3Aguardando').then((m) => m.P3Aguardando),
  },

  // Rotas de Solicitante (Aluno e Professor) - Protegidas por solicitanteGuard
  {
    path: '',
    component: SolicitanteLayout,
    canActivate: [solicitanteGuard],
    children: [
      {
        path: 'catalogo',
        title: 'Catálogo · Protem',
        loadComponent: () => import('../pages/S1Catalogo').then((m) => m.S1Catalogo),
      },
      {
        path: 'item/:id',
        title: 'Item · Protem',
        loadComponent: () => import('../pages/S2Item').then((m) => m.S2Item),
      },
      {
        path: 'solicitar/:id',
        title: 'Pedir item · Protem',
        canActivate: [podeSolicitarGuard],
        loadComponent: () => import('../pages/S3Solicitar').then((m) => m.S3Solicitar),
      },
      {
        path: 'meus-emprestimos',
        title: 'Meus empréstimos · Protem',
        loadComponent: () => import('../pages/S4MeusEmprestimos').then((m) => m.S4MeusEmprestimos),
      },
      {
        path: 'notificacoes',
        title: 'Avisos · Protem',
        loadComponent: () => import('../pages/S5Notificacoes').then((m) => m.S5Notificacoes),
      },
      {
        path: 'perfil',
        title: 'Perfil · Protem',
        loadComponent: () => import('../pages/S6Perfil').then((m) => m.S6Perfil),
      },
      {
        path: 'codigos',
        title: 'Meus códigos · Protem',
        loadComponent: () => import('../pages/S7MeusCodigos').then((m) => m.S7MeusCodigos),
      },
    ],
  },

  // Rotas do Responsável - Protegidas por responsavelGuard
  {
    path: 'painel',
    component: ResponsavelLayout,
    canActivate: [responsavelGuard],
    children: [
      {
        path: '',
        title: 'Painel · Protem',
        loadComponent: () => import('../pages/R1Painel').then((m) => m.R1Painel),
      },
      {
        path: 'solicitacoes',
        title: 'Solicitações · Protem',
        loadComponent: () => import('../pages/R2Solicitacoes').then((m) => m.R2Solicitacoes),
      },
      {
        path: 'contas',
        title: 'Contas · Protem',
        loadComponent: () => import('../pages/R3Contas').then((m) => m.R3Contas),
      },
      {
        path: 'leitor',
        title: 'Leitor de QR code · Protem',
        loadComponent: () => import('../pages/R4Leitor').then((m) => m.R4Leitor),
      },
      {
        path: 'retirada/:itemId',
        title: 'Retirada · Protem',
        loadComponent: () => import('../pages/R5Retirada').then((m) => m.R5Retirada),
      },
      {
        path: 'devolucao/:itemId',
        title: 'Devolução · Protem',
        loadComponent: () => import('../pages/R6Devolucao').then((m) => m.R6Devolucao),
      },
      {
        path: 'itens',
        title: 'Itens · Protem',
        loadComponent: () => import('../pages/R7Itens').then((m) => m.R7Itens),
      },
      {
        path: 'itens/novo',
        title: 'Novo item · Protem',
        loadComponent: () => import('../pages/R8ItemForm').then((m) => m.R8ItemForm),
      },
      {
        path: 'itens/:id/editar',
        title: 'Editar item · Protem',
        loadComponent: () => import('../pages/R8ItemForm').then((m) => m.R8ItemForm),
      },
      {
        path: 'itens/:id',
        title: 'Ficha do item · Protem',
        loadComponent: () => import('../pages/R9ItemDetalhes').then((m) => m.R9ItemDetalhes),
      },
      {
        path: 'categorias',
        title: 'Categorias · Protem',
        loadComponent: () => import('../pages/R10Categorias').then((m) => m.R10Categorias),
      },
      {
        path: 'categorias/nova',
        title: 'Nova categoria · Protem',
        loadComponent: () => import('../pages/R11CategoriaForm').then((m) => m.R11CategoriaForm),
      },
      {
        path: 'categorias/:id/editar',
        title: 'Editar categoria · Protem',
        loadComponent: () => import('../pages/R11CategoriaForm').then((m) => m.R11CategoriaForm),
      },
      {
        path: 'manutencao',
        title: 'Manutenção · Protem',
        loadComponent: () => import('../pages/R12Manutencao').then((m) => m.R12Manutencao),
      },
      {
        path: 'usuarios',
        title: 'Usuários · Protem',
        loadComponent: () => import('../pages/R13Usuarios').then((m) => m.R13Usuarios),
      },
      {
        path: 'usuarios/:id',
        title: 'Histórico da pessoa · Protem',
        loadComponent: () => import('../pages/R14UsuarioDetalhes').then((m) => m.R14UsuarioDetalhes),
      },
      {
        path: 'relatorios',
        title: 'Relatórios · Protem',
        loadComponent: () => import('../pages/R15Relatorios').then((m) => m.R15Relatorios),
      },
      {
        path: 'configuracoes',
        title: 'Configurações · Protem',
        loadComponent: () => import('../pages/R16Configuracoes').then((m) => m.R16Configuracoes),
      },
      {
        path: 'historico',
        title: 'Histórico · Protem',
        loadComponent: () => import('../pages/R18Historico').then((m) => m.R18Historico),
      },
      {
        path: 'notificacoes',
        title: 'Notificações · Protem',
        loadComponent: () => import('../pages/R17Notificacoes').then((m) => m.R17Notificacoes),
      },
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'login',
  },
];
