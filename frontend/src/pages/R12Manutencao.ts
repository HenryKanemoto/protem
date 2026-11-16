import {ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {formatDateShort} from '../lib/date-utils';
import {Item, Ocorrencia} from '../types/models';
import {ItemThumb} from '../components/item-thumb/item-thumb';
import {Modal} from '../components/modal/modal';
import {rotuloCategoriaAvaria} from '../store/regras/avaria';

interface ItemManutencaoLinha {
  item: Item;
  ocorrencia?: Ocorrencia;
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
        devolvidoPorNome: devolvidoPor,
        dataRegistro,
      };
    });
  });

  formatarData(iso: string): string {
    return formatDateShort(iso);
  }

  abrirEncaminhamento(linha: ItemManutencaoLinha) {
    this.destinoEscolhido.set('');
    this.motivoEncaminhamento.set('');
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
    if (linha.ocorrencia) {
      this.store.resolverOcorrencia(linha.ocorrencia.id, true, this.store.usuarioLogado()?.id);
    } else {
      this.store.salvarItem({
        ...linha.item,
        status: 'disponivel',
      });
    }

    this.mensagemSucesso.set(
      `"${linha.item.nome}" (${linha.item.patrimonio}) foi consertado e voltou ao catálogo como disponível.`
    );
  }
}
