import {ProtemState} from './estado';
import {getInitialDemoState} from './demo-data';

/** v3: códigos de devolução, tipo de avaria e encaminhamento de itens entraram no estado e no seed. */
const CHAVE = 'protem:v4';
/**
 * Chaves de versões anteriores. Não são aproveitadas (falta algum campo novo e o seed mudou):
 * o navegador começa do seed novo e elas são apagadas na primeira gravação, para liberar espaço.
 */
const CHAVES_ANTIGAS = ['protem:v3', 'protem:v2', 'protem:v1', 'nexus_app_state_v2', 'nexus_app_state_v1'];

const LISTAS = ['usuarios', 'categorias', 'subcategorias', 'itens', 'solicitacoes', 'emprestimos', 'ocorrencias', 'notificacoes', 'auditoria'];
const POLITICAS = ['simples', 'intermediaria', 'rigida'];

export interface EstadoCarregado {
  estado: ProtemState;
  /** true quando não havia dados válidos salvos e o estado veio do seed de demonstração. */
  doSeed: boolean;
}

export type ResultadoGravacao = 'ok' | 'cota' | 'indisponivel';

export function carregarEstado(): EstadoCarregado {
  const texto = ler(CHAVE);
  // Nada salvo ou dados corrompidos: começa do seed
  const estado = texto === null ? null : validar(texto);
  return estado ? {estado, doSeed: false} : {estado: getInitialDemoState(), doSeed: true};
}

export function salvarEstado(estado: ProtemState): ResultadoGravacao {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    CHAVES_ANTIGAS.forEach((chave) => localStorage.removeItem(chave));
    return 'ok';
  } catch (erro) {
    return erro instanceof DOMException && erro.name === 'QuotaExceededError' ? 'cota' : 'indisponivel';
  }
}

/**
 * Avisa quando outra aba deste navegador grava o estado. Sem isso, cada aba fica com a sua
 * cópia em memória e a próxima gravação de uma apaga o que a outra fez.
 * Devolve a função que para de ouvir.
 */
export function observarOutrasAbas(aoMudar: (estado: ProtemState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  // O evento "storage" só dispara nas OUTRAS abas, nunca na que gravou
  const ouvir = (evento: StorageEvent) => {
    if (evento.key !== CHAVE || evento.newValue === null) return;
    const estado = validar(evento.newValue);
    if (estado) aoMudar(estado);
  };
  window.addEventListener('storage', ouvir);
  return () => window.removeEventListener('storage', ouvir);
}

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    // localStorage bloqueado (modo privado, política do navegador)
    return null;
  }
}

/** Confere a forma do estado salvo; qualquer coisa estranha é tratada como corrompida. */
function validar(texto: string): ProtemState | null {
  try {
    const salvo = JSON.parse(texto) as Record<string, unknown> | null;
    if (!salvo || typeof salvo !== 'object') return null;
    if (LISTAS.some((lista) => !Array.isArray(salvo[lista]))) return null;
    if (typeof salvo['agora'] !== 'string' || isNaN(new Date(salvo['agora']).getTime())) return null;
    const configuracao = salvo['configuracao'] as {politicaAtraso?: string} | undefined;
    if (!POLITICAS.includes(configuracao?.politicaAtraso ?? '')) return null;

    const estado = salvo as unknown as ProtemState;
    // Garante que todos os usuários tenham a senha padrão '123456'
    estado.usuarios = estado.usuarios.map((u) => ({
      ...u,
      senha: !u.senha || u.senha === '123' ? '123456' : u.senha,
    }));
    return estado;
  } catch {
    return null;
  }
}
