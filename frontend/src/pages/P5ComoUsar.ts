import {Location} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {BrandLogo} from '../components/brand-logo/brand-logo';
import {BotaoAcessibilidade} from '../components/painel-acessibilidade/botao-acessibilidade';

export type PerfilDeUso = 'solicitante' | 'responsavel';

interface Passo {
  icone: string;
  titulo: string;
  texto: string;
  /** Uma frase de ajuda, em destaque suave. */
  dica?: string;
}

interface Regra {
  icone: string;
  titulo: string;
  texto: string;
}

interface Perfil {
  id: PerfilDeUso;
  icone: string;
  nome: string;
  quem: string;
  passos: Passo[];
  regrasTitulo: string;
  regras: Regra[];
}

const PERFIS: Perfil[] = [
  {
    id: 'solicitante',
    icone: 'school',
    nome: 'Aluno ou professor',
    quem: 'Quem pede itens emprestados',
    passos: [
      {
        icone: 'how_to_reg',
        titulo: 'Crie a sua conta',
        texto: 'Em "Cadastre-se", informe seu nome, e-mail e matrícula. O responsável pelo acervo precisa aprovar a conta antes de você poder pedir.',
        dica: 'Enquanto espera, a tela "Aguardando aprovação" mostra como está. Você pode entrar de novo a qualquer momento.',
      },
      {
        icone: 'search',
        titulo: 'Escolha um item no catálogo',
        texto: 'Use as categorias (e os tipos, quando houver) ou a busca por nome ou patrimônio. O catálogo só mostra o que está disponível agora.',
      },
      {
        icone: 'event_available',
        titulo: 'Faça o pedido',
        texto: 'Escolha até quando precisa do item, dentro do prazo da categoria. O pedido vai para o responsável aprovar.',
        dica: 'Se ninguém analisar em 2 horas, aparece o botão para enviar um lembrete (uma vez por pedido).',
      },
      {
        icone: 'qr_code_scanner',
        titulo: 'Retire no mesmo dia',
        texto: 'Com o pedido aprovado, vá ao responsável no mesmo dia e mostre o seu código de retirada. Ele lê o QR code do item e o prazo começa a contar.',
        dica: 'Seus códigos ficam em "Meus códigos". Pedido aprovado e não retirado expira à noite, e o item volta ao catálogo.',
      },
      {
        icone: 'assignment_return',
        titulo: 'Devolva no prazo',
        texto: 'Na devolução, mostre o código de devolução. Se o item voltou com algum problema, conte: ele vai para manutenção e fica registrado.',
        dica: '"Meus empréstimos" mostra o andamento de cada pedido e o prazo em destaque.',
      },
    ],
    regrasTitulo: 'O que vale saber',
    regras: [
      {icone: 'schedule', titulo: 'Prazo por categoria', texto: 'Cada categoria tem um prazo máximo de empréstimo.'},
      {icone: 'inventory_2', titulo: 'Limite por pessoa', texto: 'Cada categoria também limita quantos itens você pode ter ao mesmo tempo.'},
      {icone: 'warning', titulo: 'Atraso tem consequência', texto: 'Conforme a política da instituição, a conta pode ser bloqueada até a devolução e, depois, suspensa.'},
      {icone: 'info', titulo: 'Sem câmera, sem problema', texto: 'O responsável também pode digitar o código ou o patrimônio do item.'},
    ],
  },
  {
    id: 'responsavel',
    icone: 'admin_panel_settings',
    nome: 'Responsável pelo acervo',
    quem: 'Quem aprova, entrega e recebe',
    passos: [
      {
        icone: 'person',
        titulo: 'Entre com a sua conta',
        texto: 'Contas de responsável já existem no sistema, sem cadastro. Ao entrar, o Painel mostra "O que fazer agora", do mais urgente para o menos.',
      },
      {
        icone: 'how_to_reg',
        titulo: 'Aprove as contas novas',
        texto: 'Em "Usuários", analise os cadastros novos. Quem não for aprovado não consegue pedir; recusar pede um motivo.',
      },
      {
        icone: 'inbox',
        titulo: 'Analise os pedidos',
        texto: 'Em "Pedidos", aba "Empréstimos", aprove ou recuse. Ao aprovar, o item fica reservado para retirada no mesmo dia. Recusar exige motivo, e a pessoa é avisada.',
        dica: 'Pedido aprovado e não retirado expira no fim do dia e o item volta ao catálogo, sozinho.',
      },
      {
        icone: 'qr_code_scanner',
        titulo: 'Registre a retirada',
        texto: 'No "Leitor de QR code", leia o QR do item ou digite o código ou o patrimônio. Um passo de confirmação e o prazo começa a contar.',
        dica: 'A câmera exige HTTPS ou localhost. Se ela falhar, o campo de digitação continua à mão.',
      },
      {
        icone: 'assignment_return',
        titulo: 'Receba a devolução',
        texto: 'Em "Pedidos", aba "Devoluções" (atrasadas primeiro), ou pelo leitor. Confira o código de devolução e diga se o item voltou com avaria.',
        dica: 'Com avaria, o item vai para "Manutenção" e a ocorrência fica no histórico do item e da pessoa.',
      },
      {
        icone: 'inventory_2',
        titulo: 'Cuide do acervo',
        texto: 'No "Inventário" ficam os itens, as fotos e a etiqueta com QR code para imprimir. Em "Categorias" você define prazo, limite e subcategorias. Em "Manutenção", conserte ou encaminhe o item.',
      },
      {
        icone: 'checklist',
        titulo: 'Acompanhe e ajuste',
        texto: '"Histórico" e "Relatórios" mostram o caminho de cada pedido e quem fez o quê. Em "Configurações", escolha a política de atraso: simples, intermediária ou rígida.',
        dica: 'Suspender, bloquear ou reativar alguém fica no detalhe do usuário e pede um motivo.',
      },
    ],
    regrasTitulo: 'O que o Protem faz sozinho',
    regras: [
      {icone: 'schedule', titulo: 'Expira pedidos', texto: 'Pedido aprovado e não retirado no dia expira à noite.'},
      {icone: 'warning', titulo: 'Marca atrasos', texto: 'Aplica a política de atraso escolhida, com bloqueio e suspensão.'},
      {icone: 'notifications_none', titulo: 'Avisa as pessoas', texto: 'Prazo perto do fim, atraso, aprovação e recusa geram avisos.'},
      {icone: 'fact_check', titulo: 'Registra tudo', texto: 'Cada mudança de conta, pedido ou empréstimo vai para a auditoria.'},
    ],
  },
];

function perfilDaUrl(valor: string | null): PerfilDeUso {
  return valor === 'responsavel' ? 'responsavel' : 'solicitante';
}

/**
 * "Como usar": passo a passo público, sem login, para quem pede (aluno e professor) e para o
 * responsável pelo acervo. Os dois perfis são abas (setas, Home e End trocam de aba) e o perfil
 * escolhido fica na URL (?perfil=responsavel), para dar para mandar o link já na aba certa.
 */
@Component({
  selector: 'app-p5-como-usar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, BrandLogo, BotaoAcessibilidade],
  templateUrl: './P5ComoUsar.html',
})
export class P5ComoUsar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly localizacao = inject(Location);

  readonly perfis = PERFIS;
  readonly escolhido = signal<PerfilDeUso>(perfilDaUrl(this.route.snapshot.queryParamMap.get('perfil')));
  readonly perfil = computed(() => PERFIS.find((p) => p.id === this.escolhido()) ?? PERFIS[0]);

  escolher(id: PerfilDeUso, focar = false) {
    this.escolhido.set(id);
    this.router.navigate([], {queryParams: {perfil: id === 'solicitante' ? null : id}, replaceUrl: true});
    if (focar) setTimeout(() => document.getElementById('aba-' + id)?.focus());
  }

  /** Teclado das abas (padrão WAI-ARIA): setas, Home e End. */
  teclas(evento: KeyboardEvent) {
    const atual = PERFIS.findIndex((p) => p.id === this.escolhido());
    let novo = atual;
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        novo = (atual + 1) % PERFIS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        novo = (atual - 1 + PERFIS.length) % PERFIS.length;
        break;
      case 'Home':
        novo = 0;
        break;
      case 'End':
        novo = PERFIS.length - 1;
        break;
      default:
        return;
    }
    evento.preventDefault();
    this.escolher(PERFIS[novo].id, true);
  }

  voltar() {
    this.localizacao.back();
  }
}
