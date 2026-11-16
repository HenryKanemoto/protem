// Confere o contraste (WCAG AA) dos pares de cor de cada tema de src/styles.css.
//
// Lê os tokens direto do CSS (@theme e os blocos de tema), monta a paleta de cada combinação
// (claro, escuro, alto contraste, escuro + alto contraste) e calcula a razão de contraste de cada
// par de uso. Sai com erro se algum par ficar abaixo do mínimo.
//
// Uso:  npm run contraste
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/styles.css', import.meta.url)), 'utf8');

/** Tokens (--color-*) do bloco que começa em `abertura`, ex.: "@theme {". */
function tokensDoBloco(abertura) {
  const inicio = css.indexOf(abertura);
  if (inicio < 0) throw new Error(`Bloco não encontrado no CSS: ${abertura}`);
  const fim = css.indexOf('\n}', inicio);
  const tokens = {};
  for (const [, nome, valor] of css.slice(inicio, fim).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    tokens[nome] = valor.toLowerCase();
  }
  return tokens;
}

const base = tokensDoBloco('@theme {');
const escuro = tokensDoBloco(":root[data-tema='escuro'] {");
const alto = tokensDoBloco(":root[data-contraste='alto'] {");
const escuroAlto = tokensDoBloco(":root[data-tema='escuro'][data-contraste='alto'] {");

const temas = {
  'claro': base,
  'escuro': {...base, ...escuro},
  'alto contraste': {...base, ...alto},
  'escuro + alto contraste': {...base, ...escuro, ...alto, ...escuroAlto},
};

function luminancia(hex) {
  const canal = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function razao(a, b) {
  const [claro, escuroLum] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuroLum + 0.05);
}

// [primeiro plano, fundo, mínimo, onde é usado]. 4,5 = texto; 3 = ícone, borda de campo e foco.
const estados = ['disponivel', 'solicitado', 'reservado', 'emprestado', 'atrasado', 'manutencao'];
const pares = [
  ['text', 'bg', 4.5, 'texto do corpo na página'],
  ['text', 'surface', 4.5, 'texto em cartões e tabelas'],
  ['text', 'brand-soft', 4.5, 'texto sobre fundo suave'],
  ['text-heading', 'surface', 4.5, 'títulos'],
  ['text-heading', 'bg', 4.5, 'títulos na página'],
  ['text-muted', 'bg', 4.5, 'texto secundário na página'],
  ['text-muted', 'surface', 4.5, 'texto secundário em cartões'],
  ['text-muted', 'brand-soft', 4.5, 'texto secundário sobre fundo suave'],
  ['primary-hover', 'surface', 4.5, 'links e ações em texto, em cartões'],
  ['primary-hover', 'bg', 4.5, 'links na página'],
  ['primary-strong', 'brand-soft', 4.5, 'texto azul sobre fundo suave'],
  ['white', 'primary', 4.5, 'botão primário'],
  ['white', 'primary-pressed', 4.5, 'botão primário em hover'],
  ['white', 'danger-fill', 4.5, 'botão de ação destrutiva'],
  ['danger', 'surface', 4.5, 'mensagem de erro em cartões'],
  ['danger', 'bg', 4.5, 'mensagem de erro na página'],
  ['white', 'brand-navy', 4.5, 'menu lateral e cabeçalho'],
  ['brand-gold', 'brand-navy', 3, 'marcador do item ativo (acento)'],
  ['border-input', 'surface', 3, 'borda de campo de formulário'],
  ['border-input', 'bg', 3, 'borda de campo sobre a página'],
  ['focus-ring', 'bg', 3, 'anel de foco na página'],
  ['focus-ring', 'surface', 3, 'anel de foco em cartões'],
  ['focus-ring-navy', 'brand-navy', 3, 'anel de foco no menu e no cabeçalho'],
  ['primary', 'surface', 3, 'ícones e detalhes em azul'],
  ...estados.map((e) => [e, `${e}-bg`, 4.5, `selo de estado (${e})`]),
];

let falhas = 0;
for (const [nome, paleta] of Object.entries(temas)) {
  const cor = (token) => (token === 'white' ? '#ffffff' : paleta[token]);
  const reprovados = [];
  let menor = {razao: Infinity, par: ''};
  for (const [frente, fundo, minimo, uso] of pares) {
    if (!cor(frente) || !cor(fundo)) throw new Error(`Token ausente no tema "${nome}": ${frente} ou ${fundo}`);
    const r = razao(cor(frente), cor(fundo));
    if (r < menor.razao) menor = {razao: r, par: `${frente} sobre ${fundo}`};
    if (r < minimo) reprovados.push(`${frente} ${cor(frente)} sobre ${fundo} ${cor(fundo)}: ${r.toFixed(2)}:1 (mínimo ${minimo}), ${uso}`);
  }
  falhas += reprovados.length;
  console.log(`${reprovados.length ? 'FALHA' : 'ok   '}  ${nome}: ${pares.length} pares, menor razão ${menor.razao.toFixed(2)}:1 (${menor.par})`);
  for (const linha of reprovados) console.log(`        ${linha}`);
}

if (falhas) {
  console.log(`\n${falhas} par(es) abaixo do mínimo de contraste.`);
  process.exit(1);
}
console.log('\nTodos os pares atendem ao WCAG AA nos quatro temas.');
