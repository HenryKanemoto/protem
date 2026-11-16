import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {PoliticaAtraso, TipoDestino} from '../types/models';
import {ROTULOS_TIPO_DESTINO} from '../store/regras/avaria';

@Component({
  selector: 'app-r16-configuracoes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './R16Configuracoes.html',
})
export class R16Configuracoes {
  readonly store = inject(ProtemStore);

  readonly politicaAtual = computed(() => this.store.configuracao().politicaAtraso);
  readonly politicaSelecionada = signal<PoliticaAtraso>('rigida');
  readonly mensagemSucesso = signal<string | null>(null);

  // Destinos para itens sem conserto (usados em Manutenção > Encaminhar)
  readonly rotulosTipo = ROTULOS_TIPO_DESTINO;
  readonly tiposDestino = Object.keys(ROTULOS_TIPO_DESTINO) as TipoDestino[];
  readonly nomeDestino = signal('');
  readonly tipoDestino = signal<TipoDestino>('recondicionamento');
  readonly descricaoDestino = signal('');
  readonly erroDestino = signal<string | null>(null);

  readonly opcoes: {valor: PoliticaAtraso; titulo: string; descricao: string}[] = [
    {valor: 'simples', titulo: 'Só marcar o atraso', descricao: 'O empréstimo aparece como atrasado no painel. Ninguém é bloqueado.'},
    {valor: 'intermediaria', titulo: 'Bloquear até devolver', descricao: 'A pessoa não faz novos pedidos enquanto estiver com um item atrasado.'},
    {valor: 'rigida', titulo: 'Bloquear e suspender', descricao: 'Bloqueia até devolver e depois suspende pelo mesmo número de dias de atraso.'},
  ];

  constructor() {
    this.politicaSelecionada.set(this.politicaAtual());
  }

  selecionar(pol: PoliticaAtraso) {
    this.politicaSelecionada.set(pol);
  }

  salvar() {
    const novaPolitica = this.politicaSelecionada();
    this.store.alterarPoliticaAtraso(novaPolitica);
    this.mensagemSucesso.set(
      'Política de atraso atualizada.'
    );
  }

  incluirDestino() {
    const res = this.store.salvarDestino({
      nome: this.nomeDestino(),
      tipo: this.tipoDestino(),
      descricao: this.descricaoDestino(),
    });
    if (!res.sucesso) {
      this.erroDestino.set(res.mensagem);
      return;
    }
    this.nomeDestino.set('');
    this.descricaoDestino.set('');
    this.erroDestino.set(null);
    this.mensagemSucesso.set(res.mensagem);
  }

  removerDestino(id: string) {
    const res = this.store.removerDestino(id);
    if (res.sucesso) this.mensagemSucesso.set(res.mensagem);
    else this.erroDestino.set(res.mensagem);
  }
}
