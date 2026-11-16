import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {iconeCategoria, plural} from '../lib/categoria-utils';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {ProtemStore} from '../store/protem.store';
import {MatIconModule} from '@angular/material/icon';
import {calculateDiasAtraso, formatDateShort} from '../lib/date-utils';
import {ItemThumb} from '../components/item-thumb/item-thumb';

@Component({
  selector: 'app-r6-devolucao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ItemThumb],
  templateUrl: './R6Devolucao.html',
})
export class R6Devolucao {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProtemStore);

  readonly comDefeito = signal(false);
  readonly descricaoDefeito = signal('');
  readonly erroValidacao = signal<string | null>(null);
  /** Erro da regra de devolução (ex.: o item já tinha sido devolvido em outra aba). */
  readonly erroDevolucao = signal<string | null>(null);

  /** Código de devolução que a pessoa mostra no app, em Meus códigos. */
  readonly codigoDigitado = signal('');
  /** A pessoa não tem o código: devolve sem ele, com motivo. Fica na auditoria. */
  readonly semCodigo = signal(false);
  readonly motivoSemCodigo = signal('');
  readonly erroCodigo = signal<string | null>(null);

  readonly plural = plural;

  readonly itemId = computed(() => this.route.snapshot.paramMap.get('itemId') || '');

  readonly item = computed(() => {
    const id = this.itemId();
    return this.store.itens().find((i) => i.id === id) || null;
  });

  readonly emprestimo = computed(() => {
    const it = this.item();
    if (!it) return null;
    return (
      this.store.emprestimos().find(
        (e) => e.itemId === it.id && !e.devolvidoEm
      ) || null
    );
  });

  getUsuario(id?: string) {
    if (!id) return undefined;
    return this.store.usuarios().find((u) => u.id === id);
  }

  formatarData(iso?: string) {
    if (!iso) return '—';
    return formatDateShort(iso);
  }

  getDiasAtraso(devolucaoPrevista: string): number {
    return calculateDiasAtraso(devolucaoPrevista, this.store.agora());
  }

  executarConfirmacaoDevolucao() {
    const emp = this.emprestimo();
    const resp = this.store.usuarioLogado();
    const it = this.item();
    if (!emp) return;

    this.erroValidacao.set(null);
    this.erroDevolucao.set(null);
    this.erroCodigo.set(null);

    // Empréstimos com código pedem o código ou, sem ele, um motivo
    let confirmacao: {codigo?: string; semCodigoMotivo?: string} = {};
    if (emp.codigoDevolucao) {
      if (this.semCodigo()) {
        if (!this.motivoSemCodigo().trim()) {
          this.erroCodigo.set('Informe por que a devolução será registrada sem o código.');
          return;
        }
        confirmacao = {semCodigoMotivo: this.motivoSemCodigo().trim()};
      } else {
        if (!this.codigoDigitado().trim()) {
          this.erroCodigo.set('Digite o código de devolução que a pessoa mostrar no app.');
          return;
        }
        confirmacao = {codigo: this.codigoDigitado()};
      }
    }

    if (this.comDefeito() && !this.descricaoDefeito().trim()) {
      this.erroValidacao.set('Descreva a avaria para registrar a ocorrência.');
      return;
    }

    const res = this.store.registrarDevolucao(
      emp.id,
      resp?.id || '',
      this.comDefeito(),
      this.comDefeito() ? this.descricaoDefeito().trim() : undefined,
      confirmacao,
    );

    if (!res.sucesso) {
      // Antes a falha era silenciosa: o botão parecia não fazer nada
      this.erroCodigo.set(res.mensagem.includes('ódigo') ? res.mensagem : null);
      this.erroDevolucao.set(res.mensagem.includes('ódigo') ? null : res.mensagem);
      return;
    }
    // Volta ao painel com mensagem de sucesso
    this.router.navigate(['/painel'], {
      state: { sucesso: `Devolução registrada com sucesso para "${it?.nome}". ${res.mensagem}` },
    });
  }

  getIconeCategoria(categoriaId: string): string {
    return iconeCategoria(categoriaId);
  }
}
