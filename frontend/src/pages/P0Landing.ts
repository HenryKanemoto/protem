import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {BrandLogo} from '../components/brand-logo/brand-logo';

interface Pacote {
  nome: string;
  preco: string;
  cobranca: string;
  detalhe: string;
}

/** Página de entrada pública: o que é o Protem, os pacotes e o acesso à plataforma. */
@Component({
  selector: 'app-p0-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandLogo],
  templateUrl: './P0Landing.html',
})
export class P0Landing {
  readonly ano = new Date().getFullYear();

  // Pacotes do pitch (valores de exemplo)
  readonly pacotes: Pacote[] = [
    {nome: 'Pequeno porte', preco: 'R$ 2.400', cobranca: 'pagamento único', detalhe: 'Até 100 itens no acervo e 50 usuários'},
    {nome: 'Médio porte', preco: 'R$ 4.200', cobranca: 'pagamento único', detalhe: 'Até 500 itens no acervo e 300 usuários'},
    {nome: 'Grande porte', preco: 'R$ 7.500', cobranca: 'pagamento único', detalhe: 'Até 2.000 itens no acervo e 1.000 usuários'},
    {nome: 'Mentoria digital', preco: 'R$ 250', cobranca: 'pagamento único', detalhe: '2 sessões online de 45 minutos'},
  ];
}
