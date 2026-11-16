export const STATUS_ITEM = [
    'disponivel',
    'solicitado',
    'reservado',
    'emprestado',
    'atrasado',
    'manutencao',
    'encaminhado',
] as const;

export type StatusItem = typeof STATUS_ITEM[number];

export interface Item {
    id: string,
    categoriaId: string,
    subcategoriaId?: string | null,
    nome: string,
    descricao: string,
    patrimonio: string,
    codigoQr: string,
    foto?: string | null,
    status: StatusItem,
}

// Corpo aceito em POST /item e PUT /item/:id. O id é opcional no POST (gerado pelo servidor).
export interface ItemRequestDTO {
    id?: string,
    categoriaId: string,
    subcategoriaId?: string | null,
    nome: string,
    descricao?: string,
    patrimonio: string,
    codigoQr: string,
    foto?: string | null,
    status?: StatusItem,
}

export interface Usuario {
    nome: string,
    items_emprestados: Item[],
}
