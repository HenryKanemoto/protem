/** Períodos usados nos filtros de Relatórios, Auditoria e Histórico. */
export type Periodo = '7d' | '30d' | '90d' | 'tudo';

export const PERIODOS: {valor: Periodo; rotulo: string}[] = [
  {valor: '7d', rotulo: '7 dias'},
  {valor: '30d', rotulo: '30 dias'},
  {valor: '90d', rotulo: '90 dias'},
  {valor: 'tudo', rotulo: 'Tudo'},
];

const DIAS: Record<Periodo, number> = {'7d': 7, '30d': 30, '90d': 90, tudo: 0};

/** Início do período em milissegundos, contado a partir do relógio da demonstração (0 = desde sempre). */
export function inicioDoPeriodo(periodo: Periodo, agora: Date): number {
  const dias = DIAS[periodo];
  return dias ? agora.getTime() - dias * 24 * 60 * 60 * 1000 : 0;
}
