import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProtemStore } from '../store/protem.store';
import { MatIconModule } from '@angular/material/icon';
import { Item } from '../types/models';
import { plural } from '../lib/categoria-utils';
import { reduzirImagem } from '../lib/imagem-utils';

@Component({
  selector: 'app-r8-item-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterLink],
  templateUrl: './R8ItemForm.html',
})
export class R8ItemForm {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProtemStore);

  readonly plural = plural;

  readonly itemId = computed(() => this.route.snapshot.paramMap.get('id') || '');
  readonly modoEdicao = computed(() => !!this.itemId());

  readonly nome = signal('');
  readonly descricao = signal('');
  readonly categoriaId = signal('');
  readonly subcategoriaId = signal('');
  /** Subcategorias da categoria escolhida (vazio: o campo some). */
  readonly subcategoriasDisponiveis = computed(() =>
    this.store
      .subcategorias()
      .filter((s) => s.categoriaId === this.categoriaId())
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
  readonly patrimonio = signal('');
  readonly fotoDataUrl = signal<string | null>(null);
  readonly processandoFoto = signal(false);
  readonly erroValidacao = signal<string | null>(null);

  constructor() {
    const id = this.itemId();
    if (id) {
      const item = this.store.itens().find((i) => i.id === id);
      if (item) {
        this.nome.set(item.nome);
        this.descricao.set(item.descricao || '');
        this.categoriaId.set(item.categoriaId);
        this.subcategoriaId.set(item.subcategoriaId ?? '');
        this.patrimonio.set(item.patrimonio);
        this.fotoDataUrl.set(item.foto || null);
      }
    } else {
      // Inicia com a primeira categoria disponível
      const cats = this.store.categorias();
      if (cats.length > 0) {
        this.categoriaId.set(cats[0].id);
      }
      this.patrimonio.set(this.sugerirPatrimonio());
    }
  }

  /** Próximo NX-XXXX livre: maior número já usado + 1 (a contagem de itens pode repetir um existente). */
  private sugerirPatrimonio(): string {
    const maior = this.store
      .itens()
      .map((i) => /^NX-(\d+)$/i.exec(i.patrimonio)?.[1])
      .reduce((max, n) => Math.max(max, n ? Number(n) : 0), 0);
    return `NX-${String(maior + 1).padStart(4, '0')}`;
  }

  /** Código QR no formato NX-<4 letras da categoria>-<3 dígitos>, sem repetir um já existente. */
  private gerarCodigoQr(categoriaId: string): string {
    const cat = this.store.categorias().find((c) => c.id === categoriaId);
    const letras = (cat?.nome ?? '')
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase();
    const prefixo = (letras + 'ITEM').slice(0, 4);
    const existentes = new Set(this.store.itens().map((i) => i.codigoQr.toUpperCase()));
    for (let n = 1; n < 1000; n++) {
      const codigo = `NX-${prefixo}-${String(n).padStart(3, '0')}`;
      if (!existentes.has(codigo)) return codigo;
    }
    return `NX-${prefixo}-${Date.now()}`;
  }

  /** Trocar de categoria limpa a subcategoria, que só vale dentro da categoria dela. */
  escolherCategoria(id: string) {
    this.categoriaId.set(id);
    this.subcategoriaId.set('');
  }

  async onFotoSelecionada(event: Event) {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    this.processandoFoto.set(true);
    try {
      this.fotoDataUrl.set(await reduzirImagem(arquivo));
    } catch {
      this.erroValidacao.set('Não foi possível ler essa imagem. Tente outro arquivo (JPG ou PNG).');
    } finally {
      this.processandoFoto.set(false);
      input.value = '';
    }
  }

  salvar(event: Event) {
    event.preventDefault();
    this.erroValidacao.set(null);

    const nome = this.nome().trim();
    const catId = this.categoriaId();
    const patri = this.patrimonio().trim().toUpperCase();
    const desc = this.descricao().trim();

    if (!nome) {
      this.erroValidacao.set('Informe o nome do equipamento.');
      return;
    }
    if (!patri) {
      this.erroValidacao.set('Informe o patrimônio.');
      return;
    }

    const idAtual = this.itemId();

    // Validação de unicidade do patrimônio (o backend também confere)
    const patriDuplicado = this.store.itens().find(
      (i) => i.patrimonio.toUpperCase() === patri && i.id !== idAtual
    );
    if (patriDuplicado) {
      this.erroValidacao.set(`O patrimônio "${patri}" já pertence a "${patriDuplicado.nome}". Use um código único.`);
      return;
    }

    const itemExistente = this.store.itens().find((i) => i.id === idAtual);
    const idFinal = idAtual || 'item-' + Date.now();

    const subcategoriaId = this.subcategoriasDisponiveis().some((s) => s.id === this.subcategoriaId())
      ? this.subcategoriaId()
      : undefined;
    const itemParaSalvar: Item = {
      ...itemExistente,
      id: idFinal,
      nome,
      categoriaId: catId,
      subcategoriaId,
      patrimonio: patri,
      // Editando: preserva o código QR existente
      codigoQr: itemExistente?.codigoQr || this.gerarCodigoQr(catId),
      descricao: desc,
      foto: this.fotoDataUrl() || undefined,
      status: itemExistente?.status || 'disponivel',
    };

    this.store.salvarItem(itemParaSalvar);

    // Conforme Wireframe R8: Salvar -> R9
    this.router.navigate(['/painel/inventario', idFinal]);
  }

  cancelar() {
    // Conforme Wireframe R8: Cancelar -> R7
    this.router.navigate(['/painel/inventario']);
  }
}
