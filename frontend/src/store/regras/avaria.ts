import {CategoriaAvaria, Configuracao, DestinoEncaminhamento, TipoDestino} from '../../types/models';

/**
 * Categorias de avaria da devolução. A descrição é obrigatória em todas.
 * RN07 vale para todas: o item vai para a manutenção e a ocorrência fica no histórico.
 */
export const CATEGORIAS_AVARIA: {valor: CategoriaAvaria; rotulo: string; descricao: string}[] = [
  {valor: 'estetica', rotulo: 'Avaria estética', descricao: 'Funciona, mas com danos visuais'},
  {valor: 'funcional_leve', rotulo: 'Avaria funcional leve', descricao: 'Funciona parcialmente'},
  {valor: 'incompleto', rotulo: 'Incompleto', descricao: 'Faltando peças ou acessórios'},
  {valor: 'quebrado', rotulo: 'Quebrado / Inoperante', descricao: 'Não funciona'},
];

export function ehCategoriaAvaria(valor: unknown): valor is CategoriaAvaria {
  return CATEGORIAS_AVARIA.some((c) => c.valor === valor);
}

export function rotuloCategoriaAvaria(categoria?: CategoriaAvaria): string {
  return CATEGORIAS_AVARIA.find((c) => c.valor === categoria)?.rotulo ?? 'Avaria sem categoria';
}

export const ROTULOS_TIPO_DESTINO: Record<TipoDestino, string> = {
  doacao: 'Programa que aceita item danificado',
  recondicionamento: 'Recondicionamento',
  aprendizado: 'Aprendizado com item danificado',
};

/** Destinos iniciais. O responsável pode trocar, incluir e remover em Configurações. */
export const DESTINOS_PADRAO: DestinoEncaminhamento[] = [
  {
    id: 'dest-unifap-crc',
    nome: 'Unifap CRC',
    tipo: 'doacao',
    descricao: 'Centro de Recondicionamento de Computadores: recebe item totalmente danificado.',
  },
  {
    id: 'dest-senai-recondicionamento',
    nome: 'SENAI Lab de recondicionamento',
    tipo: 'recondicionamento',
    descricao: 'Laboratório que recondiciona o item para voltar a ser usado.',
  },
  {
    id: 'dest-senai-aprendizado',
    nome: 'SENAI Lab de aprendizado',
    tipo: 'aprendizado',
    descricao: 'Laboratório que usa o item danificado nas aulas, para aprender a consertar.',
  },
];

/** Lista de destinos em vigor: a salva na configuração ou, se não houver, a padrão. */
export function destinosDe(configuracao: Configuracao): DestinoEncaminhamento[] {
  return configuracao.destinosEncaminhamento ?? DESTINOS_PADRAO;
}
