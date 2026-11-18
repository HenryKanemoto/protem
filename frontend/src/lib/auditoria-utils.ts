import {TipoEventoAuditoria} from '../types/models';

export type GrupoEvento = 'contas' | 'restricoes' | 'pedidos' | 'movimentacao' | 'acervo';

export const GRUPOS_EVENTO: {valor: GrupoEvento; rotulo: string}[] = [
  {valor: 'contas', rotulo: 'Cadastros'},
  {valor: 'restricoes', rotulo: 'Bloqueios e suspensões'},
  {valor: 'pedidos', rotulo: 'Pedidos'},
  {valor: 'movimentacao', rotulo: 'Retiradas e devoluções'},
  {valor: 'acervo', rotulo: 'Conserto e encaminhamento'},
];

/** Nome, ícone e grupo de cada tipo de evento, na ordem em que aparecem no filtro. */
export const TIPOS_EVENTO: Record<TipoEventoAuditoria, {rotulo: string; icone: string; grupo: GrupoEvento}> = {
  conta_cadastrada: {rotulo: 'Cadastro de conta', icone: 'person_add', grupo: 'contas'},
  conta_aprovada: {rotulo: 'Conta aprovada', icone: 'how_to_reg', grupo: 'contas'},
  conta_recusada: {rotulo: 'Cadastro recusado', icone: 'block', grupo: 'contas'},
  conta_bloqueada: {rotulo: 'Conta bloqueada', icone: 'lock', grupo: 'restricoes'},
  conta_suspensa: {rotulo: 'Conta suspensa', icone: 'pause_circle', grupo: 'restricoes'},
  conta_reativada: {rotulo: 'Conta reativada', icone: 'lock_open', grupo: 'restricoes'},
  pedido_criado: {rotulo: 'Pedido feito', icone: 'assignment', grupo: 'pedidos'},
  pedido_aprovado: {rotulo: 'Pedido aprovado', icone: 'task_alt', grupo: 'pedidos'},
  pedido_recusado: {rotulo: 'Pedido recusado', icone: 'close', grupo: 'pedidos'},
  pedido_expirado: {rotulo: 'Pedido expirado', icone: 'timer_off', grupo: 'pedidos'},
  retirada: {rotulo: 'Retirada', icone: 'outbox', grupo: 'movimentacao'},
  devolucao: {rotulo: 'Devolução', icone: 'move_to_inbox', grupo: 'movimentacao'},
  devolucao_avaria: {rotulo: 'Devolução com avaria', icone: 'build', grupo: 'movimentacao'},
  item_enviado_tecnico: {rotulo: 'Enviado ao técnico', icone: 'engineering', grupo: 'acervo'},
  laudo_tecnico: {rotulo: 'Laudo do técnico', icone: 'assignment_turned_in', grupo: 'acervo'},
  item_consertado: {rotulo: 'Item consertado', icone: 'handyman', grupo: 'acervo'},
  item_encaminhado: {rotulo: 'Item encaminhado', icone: 'local_shipping', grupo: 'acervo'},
};
