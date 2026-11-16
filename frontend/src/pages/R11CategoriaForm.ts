import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProtemStore } from '../store/protem.store';
import { Categoria } from '../types/models';

@Component({
  selector: 'app-r11-categoria-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterLink],
  templateUrl: './R11CategoriaForm.html',
})
export class R11CategoriaForm {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProtemStore);

  readonly catId = computed(() => this.route.snapshot.paramMap.get('id') || '');
  readonly modoEdicao = computed(() => !!this.catId());

  readonly nome = signal('');
  readonly descricao = signal('');
  readonly prazoMaxDias = signal('1');
  readonly limitePorPessoa = signal('1');
  readonly erroValidacao = signal<string | null>(null);
  readonly erroCategoria = signal<string | null>(null);

  // Subcategorias (só na edição: precisam da categoria já salva)
  readonly subcategoriasDaCategoria = computed(() =>
    this.store
      .subcategorias()
      .filter((s) => s.categoriaId === this.catId())
      .map((s) => ({...s, itens: this.store.itens().filter((i) => i.subcategoriaId === s.id).length}))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
  readonly novaSubcategoria = signal('');
  readonly editandoSubId = signal<string | null>(null);
  readonly nomeEdicaoSub = signal('');
  /** Erro do campo de incluir; remover e renomear têm o seu, acima da lista. */
  readonly erroSub = signal<string | null>(null);
  readonly erroLista = signal<string | null>(null);
  readonly avisoSub = signal<string | null>(null);

  constructor() {
    const id = this.catId();
    if (id) {
      const cat = this.store.categorias().find((c) => c.id === id);
      if (cat) {
        this.nome.set(cat.nome);
        this.descricao.set(cat.descricao || '');
        this.prazoMaxDias.set(String(cat.prazoMaxDias));
        this.limitePorPessoa.set(String(cat.limitePorPessoa));
      }
    }
  }

  salvar(event: Event) {
    event.preventDefault();
    this.erroValidacao.set(null);

    const nome = this.nome().trim();
    const prazoStr = this.prazoMaxDias();
    const limiteStr = this.limitePorPessoa();

    if (!nome) {
      this.erroValidacao.set('Por favor, informe o nome da categoria.');
      return;
    }

    const prazo = parseInt(prazoStr, 10);
    if (isNaN(prazo) || prazo <= 0 || !Number.isInteger(Number(prazoStr))) {
      this.erroValidacao.set('O prazo máximo em dias deve ser um número inteiro maior que zero.');
      return;
    }

    const limite = parseInt(limiteStr, 10);
    if (isNaN(limite) || limite <= 0 || !Number.isInteger(Number(limiteStr))) {
      this.erroValidacao.set('O limite por pessoa deve ser um número inteiro maior que zero.');
      return;
    }

    const idFinal = this.catId() || 'cat-' + Date.now();
    const catSalva: Categoria = {
      id: idFinal,
      nome,
      prazoMaxDias: prazo,
      limitePorPessoa: limite,
      descricao: this.descricao().trim() || undefined,
    };

    this.store.salvarCategoria(catSalva);

    // Salvar e Cancelar voltam a R10
    this.router.navigate(['/painel/categorias']);
  }

  incluirSubcategoria(event?: Event) {
    event?.preventDefault();
    this.avisoSub.set(null);
    this.erroLista.set(null);
    const r = this.store.salvarSubcategoria({id: 'sub-' + Date.now(), categoriaId: this.catId(), nome: this.novaSubcategoria()});
    if (!r.sucesso) {
      this.erroSub.set(r.mensagem);
      return;
    }
    this.erroSub.set(null);
    this.novaSubcategoria.set('');
    this.avisoSub.set('Subcategoria incluída.');
  }

  comecarRenomear(id: string, nome: string) {
    this.editandoSubId.set(id);
    this.nomeEdicaoSub.set(nome);
    this.erroLista.set(null);
    this.avisoSub.set(null);
  }

  salvarRenomear(id: string, event?: Event) {
    event?.preventDefault();
    const atual = this.store.subcategorias().find((s) => s.id === id);
    if (!atual) return;
    const r = this.store.salvarSubcategoria({...atual, nome: this.nomeEdicaoSub()});
    if (!r.sucesso) {
      this.erroLista.set(r.mensagem);
      return;
    }
    this.erroLista.set(null);
    this.editandoSubId.set(null);
    this.avisoSub.set('Subcategoria renomeada.');
  }

  removerSubcategoria(id: string) {
    this.avisoSub.set(null);
    const r = this.store.removerSubcategoria(id);
    if (!r.sucesso) {
      this.erroLista.set(r.mensagem);
      return;
    }
    this.erroLista.set(null);
    this.avisoSub.set('Subcategoria removida.');
  }

  removerCategoria(id: string) {
    if (!window.confirm(`Remover a categoria "${this.nome()}" e suas subcategorias? Esta ação não pode ser desfeita.`)) return;

    this.erroCategoria.set(null);
    const r = this.store.removerCategoria(id);
    if (!r.sucesso) {
      this.erroCategoria.set(r.mensagem);
      return;
    }
    this.router.navigate(['/painel/categorias']);
  }

  cancelar() {
    // Salvar e Cancelar voltam a R10
    this.router.navigate(['/painel/categorias']);
  }
}
