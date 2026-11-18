import {
  PREFERENCIAS_PADRAO,
  atributosDe,
  chaveDe,
  estaPersonalizado,
  lerPreferencias,
  mudarTexto,
  planoDeRetorno,
  rotuloDoTexto,
  sanearPreferencias,
} from './acessibilidade';

describe('acessibilidade: preferências', () => {
  describe('ler o que está salvo no navegador', () => {
    it('sem nada salvo, usa o padrão', () => {
      expect(lerPreferencias(null)).toEqual(PREFERENCIAS_PADRAO);
    });

    it('texto corrompido não gera erro e cai no padrão', () => {
      expect(lerPreferencias('{isso não é json')).toEqual(PREFERENCIAS_PADRAO);
      expect(lerPreferencias('null')).toEqual(PREFERENCIAS_PADRAO);
      expect(lerPreferencias('[1,2]')).toEqual(PREFERENCIAS_PADRAO);
    });

    it('lê preferências válidas', () => {
      const salvo = {tamanhoTexto: 2, escuro: true, altoContraste: true, menosAnimacao: true, maisEspaco: true, retornoDoLeitor: false, vlibras: true};
      expect(lerPreferencias(JSON.stringify(salvo))).toEqual(salvo);
    });

    it('campo com tipo errado ou fora da faixa volta ao padrão, os outros continuam', () => {
      const p = sanearPreferencias({tamanhoTexto: 9, escuro: 'sim', altoContraste: true, retornoDoLeitor: 0});
      expect(p).toEqual({...PREFERENCIAS_PADRAO, altoContraste: true});
    });

    it('o que falta no dado salvo vem da base (herança da última escolha)', () => {
      const base = {...PREFERENCIAS_PADRAO, escuro: true, tamanhoTexto: 1 as const};
      expect(lerPreferencias(JSON.stringify({maisEspaco: true}), base)).toEqual({...base, maisEspaco: true});
    });
  });

  it('cada pessoa tem a sua chave; sem pessoa, a geral', () => {
    expect(chaveDe('u-1')).toBe('protem:a11y:v1:u-1');
    expect(chaveDe(null)).toBe('protem:a11y:v1');
    expect(chaveDe(undefined)).toBe('protem:a11y:v1');
  });

  describe('tamanho do texto', () => {
    it('A+ e A− andam um passo e param nas pontas', () => {
      expect(mudarTexto(0, 1)).toBe(1);
      expect(mudarTexto(0, -1)).toBe(-1);
      expect(mudarTexto(-1, -1)).toBe(-1);
      expect(mudarTexto(3, 1)).toBe(3);
    });

    it('mostra a porcentagem', () => {
      expect(rotuloDoTexto({...PREFERENCIAS_PADRAO, tamanhoTexto: 1})).toBe('112,5%');
      expect(rotuloDoTexto({...PREFERENCIAS_PADRAO, tamanhoTexto: 3})).toBe('150%');
    });
  });

  describe('o que vai no documento', () => {
    it('padrão não põe atributo nenhum', () => {
      expect(atributosDe(PREFERENCIAS_PADRAO)).toEqual({tema: null, contraste: null, movimento: null, espaco: null, tamanhoFonte: null});
    });

    it('cada opção ligada vira um atributo', () => {
      const a = atributosDe({tamanhoTexto: 2, escuro: true, altoContraste: true, menosAnimacao: true, maisEspaco: true, retornoDoLeitor: true, vlibras: false});
      expect(a).toEqual({tema: 'escuro', contraste: 'alto', movimento: 'reduzido', espaco: 'amplo', tamanhoFonte: '125%'});
    });

    it('texto menor que o padrão também muda a fonte', () => {
      expect(atributosDe({...PREFERENCIAS_PADRAO, tamanhoTexto: -1}).tamanhoFonte).toBe('87.5%');
    });
  });

  describe('VLibras (serviço externo, só se a pessoa ligar)', () => {
    it('vem desligado por padrão: nada de fora é carregado sem pedido', () => {
      expect(PREFERENCIAS_PADRAO.vlibras).toBe(false);
      expect(lerPreferencias(null).vlibras).toBe(false);
      expect(lerPreferencias('{quebrado').vlibras).toBe(false);
    });

    it('preferências antigas, sem o campo, continuam válidas e desligadas', () => {
      const antiga = JSON.stringify({tamanhoTexto: 1, escuro: true, altoContraste: false, menosAnimacao: false, maisEspaco: false, retornoDoLeitor: true});
      expect(lerPreferencias(antiga)).toMatchObject({tamanhoTexto: 1, escuro: true, vlibras: false});
    });

    it('lê o valor salvo e ignora tipo errado', () => {
      expect(lerPreferencias(JSON.stringify({vlibras: true})).vlibras).toBe(true);
      expect(lerPreferencias(JSON.stringify({vlibras: 'sim'})).vlibras).toBe(false);
    });

    it('conta como personalizado quando ligado', () => {
      expect(estaPersonalizado({...PREFERENCIAS_PADRAO, vlibras: true})).toBe(true);
    });
  });

  it('só é "personalizado" quando algo difere do padrão', () => {
    expect(estaPersonalizado(PREFERENCIAS_PADRAO)).toBe(false);
    expect(estaPersonalizado({...PREFERENCIAS_PADRAO, escuro: true})).toBe(true);
    expect(estaPersonalizado({...PREFERENCIAS_PADRAO, retornoDoLeitor: false})).toBe(true);
  });
});

describe('acessibilidade: retorno do leitor de QR', () => {
  it('leitura certa: um bipe agudo e curto', () => {
    const plano = planoDeRetorno('ok');
    expect(plano.tons).toHaveLength(1);
    expect(plano.tons[0].frequencia).toBeGreaterThan(600);
    expect(plano.vibracao).toHaveLength(1);
  });

  it('aviso e erro soam diferentes entre si e da leitura certa (dá para distinguir sem olhar)', () => {
    const assinatura = (r: 'ok' | 'aviso' | 'erro') => JSON.stringify(planoDeRetorno(r));
    expect(new Set([assinatura('ok'), assinatura('aviso'), assinatura('erro')]).size).toBe(3);
    for (const r of ['aviso', 'erro'] as const) {
      const [primeiro] = planoDeRetorno(r).tons;
      expect(primeiro.frequencia).toBeLessThan(planoDeRetorno('ok').tons[0].frequencia);
    }
  });
});
