import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {ICONES} from './icones';
import {Acessibilidade} from '../services/acessibilidade.service';
import {Vlibras} from '../services/vlibras.service';
import {PainelAcessibilidade} from '../components/painel-acessibilidade/painel-acessibilidade';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, PainelAcessibilidade],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // Aplica as preferências de acessibilidade (tema, contraste, tamanho do texto) em qualquer tela
    inject(Acessibilidade);
    // VLibras: só carrega se a pessoa ligar (e se já tinha ligado neste aparelho)
    inject(Vlibras);

    // Ícones em SVG embutidos no app (<mat-icon svgIcon="...">): nada de fonte de ícones
    // nem CDN, então nunca aparecem como texto, mesmo sem internet
    const registro = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const [nome, svg] of Object.entries(ICONES)) {
      registro.addSvgIconLiteral(nome, sanitizer.bypassSecurityTrustHtml(svg));
    }
  }
}
