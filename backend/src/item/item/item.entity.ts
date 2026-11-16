import {Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn} from "typeorm";
import { STATUS_ITEM, type StatusItem } from "../../types/Models.js";

@Entity('itens')
export class ItemEntity {

    @PrimaryColumn({length:64})
    id:string;

    @Column({length:64})
    categoriaId:string;

    // Opcional: subcategoria dentro da categoria (as subcategorias em si ficam no frontend)
    @Column({type:'varchar', length:64, nullable:true})
    subcategoriaId:string|null;

    @Column({length:120})
    nome:string;

    @Column({type:'text'})
    descricao:string;

    @Column({length:40, unique:true})
    patrimonio:string;

    @Column({length:60, unique:true})
    codigoQr:string;

    // Foto em data URL (base64), por isso longtext
    @Column({type:'longtext', nullable:true})
    foto:string|null;

    @Column({
        type:'enum',
        enum:STATUS_ITEM,
        default:'disponivel'
    })
    status:StatusItem;

    @CreateDateColumn()
    criadoEm:Date;

    @UpdateDateColumn()
    atualizadoEm:Date;

}
