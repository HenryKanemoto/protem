import {ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {formatDateShort} from '../lib/date-utils';
import {EtapaManutencao, Item, Ocorrencia} from '../types/models';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {Modal} from '../components/modal/modal';
import {rotuloCategoriaAvaria} from '../store/regras/avaria';
import {ROTULOS_RESULTADO_LAUDO, etapaDaOcorrencia} from '../store/regras/manutencao';

interface ItemManutencaoLinha {
  item: Item;
  ocorrencia?: Ocorrencia;
  /** Sem ocorrência aberta não há técnico no caminho: as duas saídas ficam liberadas. */
  etapa: EtapaManutencao | null;
  devolvidoPorNome: string;
  dataRegistro: string;
}

@Component({
  selector: 'app-r12-manutencao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb, Modal],
  templateUrl: './R12Manutencao.html',
})
export class R12Manutencao {
  readonly store = inject(ProtemStore);
  private readonly injector = inject(Injector);

  readonly mensagemSucesso = signal<string | null>(null);
  readonly mensagemErro = signal<string | null>(null);
  readonly rotuloLaudo = ROTULOS_RESULTADO_LAUDO;
  readonly rotuloCategoria = rotuloCategoriaAvaria;

  /** Item que está sendo encaminhado (diálogo aberto), com o destino e o motivo digitados. */
  readonly encaminhando = signal<ItemManutencaoLinha | null>(null);
  readonly destinoEscolhido = signal('');
  readonly motivoEncaminhamento = signal('');
  readonly erroEncaminhamento = signal<string | null>(null);

  readonly itensEmManutencao = computed<ItemManutencaoLinha[]>(() => {
    const todosItens = this.store.itens();
    const todasOcorrencias = this.store.ocorrencias();
    const todosUsuarios = this.store.usuarios();
    const agoraDate = this.store.agora();

    const itensManut = todosItens.filter((i) => i.status === 'manutencao');

    return itensManut.map((item) => {
      const ocorr = todasOcorrencias.find((o) => o.itemId === item.id && o.status === 'aberta');
      let devolvidoPor = '—';
      let dataRegistro = agoraDate.toISOString();

      if (ocorr) {
        dataRegistro = ocorr.criadoEm;
        const user = todosUsuarios.find((u) => u.id === ocorr.usuarioId);
        if (user) {
          devolvidoPor = `${user.nome} (${user.perfil})`;
        }
      }

      return {
        item,
        ocorrencia: ocorr,
        etapa: ocorr ? etapaDaOcorrencia(ocorr) : null,
        devolvidoPorNome: devolvidoPor,
        dataRegistro,
      };
    });
  });

  formatarData(iso: string): string {
    return formatDateShort(iso);
  }

  /** Consertar só vale com o laudo "arrumado" (ou sem ocorrência, que não passa pelo técnico). */
  podeConsertar(linha: ItemManutencaoLinha): boolean {
    return linha.etapa === null || linha.etapa === 'laudo_arrumado';
  }

  /** Encaminhar só vale depois de qualquer laudo (ou sem ocorrência). */
  podeEncaminhar(linha: ItemManutencaoLinha): boolean {
    return linha.etapa === null || linha.etapa === 'laudo_arrumado' || linha.etapa === 'laudo_sem_conserto';
  }

  /** Texto curto, sempre visível, do que fazer agora (o toque não tem tooltip). */
  dicaDaEtapa(linha: ItemManutencaoLinha): string {
    switch (linha.etapa) {
      case 'aguardando_envio':
        return 'Envie ao técnico para liberar Consertado e Encaminhar.';
      case 'com_tecnico':
        return `Laudo previsto para ${this.formatarData(linha.ocorrencia?.envioAoTecnico?.laudoPrevistoEm ?? '')}. Na demonstração, avance o relógio.`;
      case 'laudo_sem_conserto':
        return 'Sem conserto: só dá para encaminhar.';
      case 'laudo_arrumado':
        return 'Arrumado: marque como consertado ou, se preferir, encaminhe.';
      default:
        return '';
    }
  }

  enviarAoTecnico(linha: ItemManutencaoLinha) {
    if (!linha.ocorrencia) return;
    this.mensagemErro.set(null);
    const res = this.store.enviarParaTecnico(linha.ocorrencia.id, this.store.usuarioLogado()?.id ?? '');
    if (res.sucesso) this.mensagemSucesso.set(res.mensagem);
    else this.mensagemErro.set(res.mensagem);
  }

  abrirEncaminhamento(linha: ItemManutencaoLinha) {
    this.destinoEscolhido.set('');
    // Com laudo, o parecer do técnico já é um bom ponto de partida para o motivo (a pessoa pode editar)
    this.motivoEncaminhamento.set(linha.ocorrencia?.laudo?.parecer ?? '');
    this.erroEncaminhamento.set(null);
    this.encaminhando.set(linha);
  }

  confirmarEncaminhamento() {
    const linha = this.encaminhando();
    if (!linha) return;
    const res = this.store.encaminharItem(
      linha.item.id,
      this.store.usuarioLogado()?.id ?? '',
      this.destinoEscolhido(),
      this.motivoEncaminhamento(),
    );
    if (!res.sucesso) {
      this.erroEncaminhamento.set(res.mensagem);
      // Leva o foco ao campo com problema: o corpo do diálogo rola até ele em tela baixa
      const campo = /motivo/i.test(res.mensagem) ? '#motivoEncaminhamento' : 'input[name="destino"]';
      // Só depois de a mensagem aparecer no rodapé, que muda a altura do corpo
      afterNextRender(
        () => {
          const el = document.querySelector<HTMLElement>(campo);
          el?.focus({preventScroll: true});
          el?.scrollIntoView({block: 'center'});
        },
        {injector: this.injector},
      );
      return;
    }
    this.encaminhando.set(null);
    this.mensagemSucesso.set(res.mensagem);
  }

  marcarConsertado(linha: ItemManutencaoLinha) {
    this.mensagemErro.set(null);
    if (linha.ocorrencia) {
      const res = this.store.consertarItem(linha.ocorrencia.id, this.store.usuarioLogado()?.id ?? '');
      if (res.sucesso) this.mensagemSucesso.set(res.mensagem);
      else this.mensagemErro.set(res.mensagem);
      return;
    }
    this.store.salvarItem({...linha.item, status: 'disponivel'});
    this.mensagemSucesso.set(
      `"${linha.item.nome}" (${linha.item.patrimonio}) foi consertado e voltou ao catálogo como disponível.`
    );
  }
}
