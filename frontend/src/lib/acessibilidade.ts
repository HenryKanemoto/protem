/**
 * Preferências de acessibilidade: texto maior, alto contraste, modo escuro, menos animação,
 * mais espaço entre as linhas e retorno do leitor de QR (som e vibração).
 *
 * Tudo aqui é função pura (sem Angular, sem DOM): o serviço lê e grava no navegador e
 * aplica o resultado de `atributosDe` no <html>. As cores de cada tema ficam em styles.css.
 */

/** Tamanho do texto em passos: 0 é o padrão (100%). */
export const PASSOS_TEXTO = [-1, 0, 1, 2, 3] as const;
export type PassoTexto = (typeof PASSOS_TEXTO)[number];

/** Porcentagem do tamanho de fonte de cada passo (rem do app inteiro acompanha). */
const PERCENTUAL_DO_PASSO: Record<PassoTexto, number> = {
  [-1]: 87.5,
  0: 100,
  1: 112.5,
  2: 125,
  3: 150,
};

export interface PreferenciasAcessibilidade {
  /** -1 a 3; 0 = padrão. */
  tamanhoTexto: PassoTexto;
  escuro: boolean;
  altoContraste: boolean;
  menosAnimacao: boolean;
  /** Mais espaço entre as linhas e entre as palavras. */
  maisEspaco: boolean;
  /** Som curto, vibração e aviso falado ao ler um QR code. */
  retornoDoLeitor: boolean;
}

export const PREFERENCIAS_PADRAO: PreferenciasAcessibilidade = {
  tamanhoTexto: 0,
  escuro: false,
  altoContraste: false,
  menosAnimacao: false,
  maisEspaco: false,
  retornoDoLeitor: true,
};

/** Chave do navegador. Fica fora do estado principal: "Reiniciar dados" não apaga preferências. */
export const CHAVE_ACESSIBILIDADE = 'protem:a11y:v1';

/** Chave das preferências de uma pessoa; sem pessoa (tela de entrada), a geral. */
export function chaveDe(usuarioId?: string | null): string {
  return usuarioId ? `${CHAVE_ACESSIBILIDADE}:${usuarioId}` : CHAVE_ACESSIBILIDADE;
}

function ehPasso(valor: unknown): valor is PassoTexto {
  return typeof valor === 'number' && (PASSOS_TEXTO as readonly number[]).includes(valor);
}

/**
 * Transforma o que veio do navegador em preferências válidas. Dado corrompido, de versão
 * antiga ou com campo de tipo errado cai no padrão, campo a campo: nunca lança erro.
 */
export function sanearPreferencias(bruto: unknown, base: PreferenciasAcessibilidade = PREFERENCIAS_PADRAO): PreferenciasAcessibilidade {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {...base};
  const dado = bruto as Record<string, unknown>;
  const booleano = (campo: keyof PreferenciasAcessibilidade) => (typeof dado[campo] === 'boolean' ? (dado[campo] as boolean) : (base[campo] as boolean));
  return {
    tamanhoTexto: ehPasso(dado['tamanhoTexto']) ? dado['tamanhoTexto'] : base.tamanhoTexto,
    escuro: booleano('escuro'),
    altoContraste: booleano('altoContraste'),
    menosAnimacao: booleano('menosAnimacao'),
    maisEspaco: booleano('maisEspaco'),
    retornoDoLeitor: booleano('retornoDoLeitor'),
  };
}

export function lerPreferencias(texto: string | null, base?: PreferenciasAcessibilidade): PreferenciasAcessibilidade {
  if (!texto) return {...(base ?? PREFERENCIAS_PADRAO)};
  try {
    return sanearPreferencias(JSON.parse(texto), base);
  } catch {
    return {...(base ?? PREFERENCIAS_PADRAO)};
  }
}

/** Há algo diferente do padrão? (para o botão "Restaurar padrão" e o indicador no cabeçalho) */
export function estaPersonalizado(p: PreferenciasAcessibilidade): boolean {
  return (Object.keys(PREFERENCIAS_PADRAO) as (keyof PreferenciasAcessibilidade)[]).some((campo) => p[campo] !== PREFERENCIAS_PADRAO[campo]);
}

export function percentualDoTexto(p: PreferenciasAcessibilidade): number {
  return PERCENTUAL_DO_PASSO[p.tamanhoTexto];
}

/** Próximo passo de texto (A+ / A−), parando nas pontas. */
export function mudarTexto(atual: PassoTexto, direcao: 1 | -1): PassoTexto {
  const posicao = PASSOS_TEXTO.indexOf(atual) + direcao;
  return PASSOS_TEXTO[Math.min(PASSOS_TEXTO.length - 1, Math.max(0, posicao))];
}

/**
 * O que vai no <html>: atributos data-* (o CSS escolhe as cores e o espaçamento por eles)
 * e o tamanho da fonte. Atributo ausente = padrão.
 */
export interface AtributosDoDocumento {
  tema: 'escuro' | null;
  contraste: 'alto' | null;
  movimento: 'reduzido' | null;
  espaco: 'amplo' | null;
  /** Valor para html { font-size }, ex.: "125%"; null = padrão. */
  tamanhoFonte: string | null;
}

export function atributosDe(p: PreferenciasAcessibilidade): AtributosDoDocumento {
  const percentual = percentualDoTexto(p);
  return {
    tema: p.escuro ? 'escuro' : null,
    contraste: p.altoContraste ? 'alto' : null,
    movimento: p.menosAnimacao ? 'reduzido' : null,
    espaco: p.maisEspaco ? 'amplo' : null,
    tamanhoFonte: percentual === 100 ? null : `${percentual}%`,
  };
}

/** Texto curto do tamanho atual, para mostrar ao lado dos botões A− e A+. */
export function rotuloDoTexto(p: PreferenciasAcessibilidade): string {
  return `${percentualDoTexto(p).toString().replace('.', ',')}%`;
}

// ==========================================
// RETORNO DO LEITOR DE QR (som, vibração e aviso)
// ==========================================

export type ResultadoLeitura = 'ok' | 'aviso' | 'erro';

export interface PlanoDeRetorno {
  /** Tons em sequência: frequência (Hz) e duração (ms). */
  tons: {frequencia: number; duracaoMs: number}[];
  /** Padrão de vibração, em ms (vibra, pausa, vibra...). */
  vibracao: number[];
}

/**
 * Leitura certa: um bipe agudo curto. Aviso (item que não abre nada) e código que não existe:
 * dois tons graves, para dar para distinguir sem olhar a tela.
 */
export function planoDeRetorno(resultado: ResultadoLeitura): PlanoDeRetorno {
  switch (resultado) {
    case 'ok':
      return {tons: [{frequencia: 880, duracaoMs: 120}], vibracao: [80]};
    case 'aviso':
      return {tons: [{frequencia: 440, duracaoMs: 110}, {frequencia: 330, duracaoMs: 140}], vibracao: [60, 50, 60]};
    case 'erro':
      return {tons: [{frequencia: 300, duracaoMs: 160}, {frequencia: 220, duracaoMs: 220}], vibracao: [200]};
  }
}
