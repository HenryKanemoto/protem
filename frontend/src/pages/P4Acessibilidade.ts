import {Location} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';
import {BrandLogo} from '../components/brand-logo/brand-logo';
import {Acessibilidade} from '../services/acessibilidade.service';

interface Recurso {
  icone: string;
  titulo: string;
  texto: string;
}

/**
 * Página pública que lista, em linguagem simples, o que o Protem faz pela acessibilidade, o padrão
 * usado como referência (WCAG 2.1, nível AA) e o que ainda falta. Fica no ar sem login.
 */
@Component({
  selector: 'app-p4-acessibilidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, BrandLogo],
  templateUrl: './P4Acessibilidade.html',
})
export class P4Acessibilidade {
  private readonly acessibilidade = inject(Acessibilidade);
  private readonly localizacao = inject(Location);

  /** O que a pessoa escolhe no painel de acessibilidade. */
  readonly ajustes: Recurso[] = [
    {icone: 'text_increase', titulo: 'Tamanho do texto', texto: 'De 87,5% a 150%. As telas se reorganizam, sem rolagem para os lados.'},
    {icone: 'dark_mode', titulo: 'Modo escuro', texto: 'Fundo escuro, mais confortável com pouca luz.'},
    {icone: 'contrast', titulo: 'Alto contraste', texto: 'Texto e bordas mais fortes, em modo claro ou escuro.'},
    {icone: 'format_line_spacing', titulo: 'Mais espaço no texto', texto: 'Aumenta o espaço entre linhas e palavras.'},
    {icone: 'motion_photos_off', titulo: 'Menos animação', texto: 'Tira movimentos e transições. Também segue o "reduzir movimento" do sistema.'},
    {icone: 'volume_up', titulo: 'Retorno no leitor de QR', texto: 'Som curto, vibração e aviso falado ao ler um código.'},
  ];

  /** O que já vem pronto, sem a pessoa precisar ligar nada. */
  readonly jaFazemos = [
    'Contraste de cores no mínimo AA (4,5:1 no texto e 3:1 em ícones e bordas), conferido por um script do projeto nos quatro temas.',
    'Foco do teclado sempre visível, com anel mais grosso no alto contraste.',
    'Botões só com ícone têm nome para leitor de tela; ícones decorativos ficam escondidos dele.',
    'Estado de item e de pedido sempre escrito, nunca só pela cor.',
    'Fonte Atkinson Hyperlegible, criada para leitura fácil (letras que não se confundem, como I, l e 1).',
    'QR code com alternativa: dá para digitar o código ou o patrimônio, e o leitor explica o que acontece em cada caso.',
    'Ícones e fontes ficam dentro do próprio app: nada deixa de aparecer por causa da rede.',
  ];

  /** Honestidade: o que ainda não existe. */
  readonly aindaNao = [
    'Tradução em Libras (como o VLibras) e leitura em voz alta das telas.',
    'Teste com leitores de tela (NVDA, VoiceOver) e avaliação por especialistas em acessibilidade. A conformidade é uma referência de projeto, não uma certificação.',
  ];

  abrirPainel() {
    this.acessibilidade.painelAberto.set(true);
  }

  voltar() {
    this.localizacao.back();
  }
}
