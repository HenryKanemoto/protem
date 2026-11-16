import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemEntity } from './item.entity.js';
import { Not, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ItemRequestDTO, STATUS_ITEM, StatusItem } from '../../types/Models.js';


@Injectable()
export class ItemService {

    constructor(@InjectRepository(ItemEntity) private readonly itemRepository:Repository<ItemEntity>){}

    async findall(): Promise<ItemEntity[]>{
        return await this.itemRepository.find({order:{patrimonio:'ASC'}});
    }

    async findOne(id:string): Promise<ItemEntity>{
        const item = await this.itemRepository.findOneBy({id});
        if(!item){
            throw new NotFoundException(`Item ${id} não encontrado.`);
        }
        return item;
    }

    async save(itemRequestDTO:ItemRequestDTO): Promise<ItemEntity>{
        const id = itemRequestDTO.id?.trim() || randomUUID();
        if(await this.itemRepository.existsBy({id})){
            throw new ConflictException(`Já existe um item com o id ${id}.`);
        }
        return this.gravar(id, itemRequestDTO);
    }

    // PUT: atualiza o item ou cria se ainda não existir (o frontend gera os próprios ids)
    async upsert(id:string, itemRequestDTO:ItemRequestDTO): Promise<ItemEntity>{
        return this.gravar(id, itemRequestDTO);
    }

    async alterarStatus(id:string, status:StatusItem): Promise<ItemEntity>{
        this.validarStatus(status);
        const item = await this.findOne(id);
        item.status = status;
        return this.itemRepository.save(item);
    }

    async remove(id:string): Promise<void>{
        const resultado = await this.itemRepository.delete({id});
        if(!resultado.affected){
            throw new NotFoundException(`Item ${id} não encontrado.`);
        }
    }

    private async gravar(id:string, dto:ItemRequestDTO): Promise<ItemEntity>{
        const nome = dto.nome?.trim();
        const categoriaId = dto.categoriaId?.trim();
        const patrimonio = dto.patrimonio?.trim().toUpperCase();
        const codigoQr = dto.codigoQr?.trim().toUpperCase();

        if(!nome || !categoriaId || !patrimonio || !codigoQr){
            throw new BadRequestException('Os campos nome, categoriaId, patrimonio e codigoQr são obrigatórios.');
        }
        const status = dto.status ?? 'disponivel';
        this.validarStatus(status);

        if(await this.itemRepository.existsBy({patrimonio, id:Not(id)})){
            throw new ConflictException(`O patrimônio ${patrimonio} já está cadastrado.`);
        }
        if(await this.itemRepository.existsBy({codigoQr, id:Not(id)})){
            throw new ConflictException(`O código QR ${codigoQr} já está cadastrado.`);
        }

        return this.itemRepository.save({
            id,
            nome,
            categoriaId,
            subcategoriaId: dto.subcategoriaId?.trim() || null,
            patrimonio,
            codigoQr,
            descricao: dto.descricao?.trim() ?? '',
            foto: dto.foto ?? null,
            status,
        });
    }

    private validarStatus(status:string){
        if(!STATUS_ITEM.includes(status as StatusItem)){
            throw new BadRequestException(`Status inválido: ${status}. Use: ${STATUS_ITEM.join(', ')}.`);
        }
    }

}
