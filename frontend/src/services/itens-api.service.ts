import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';
import {Item} from '../types/models';

/** Formato que o backend devolve: igual ao Item, mais as datas de controle. */
interface ItemApi extends Omit<Item, 'foto'> {
  foto: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Acesso à API de itens do backend NestJS (/api/item, via proxy do Angular). */
@Injectable({providedIn: 'root'})
export class ItensApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/item';

  listar(): Observable<Item[]> {
    return this.http.get<ItemApi[]>(this.url).pipe(map((itens) => itens.map(paraItem)));
  }

  /** Cria ou atualiza o item com o id informado. */
  salvar(item: Item): Observable<Item> {
    return this.http.put<ItemApi>(`${this.url}/${encodeURIComponent(item.id)}`, item).pipe(map(paraItem));
  }

  remover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}

/** Descarta as datas de controle e troca foto null por ausente, como o frontend espera. */
function paraItem(api: ItemApi): Item {
  const item: Item = {
    id: api.id,
    categoriaId: api.categoriaId,
    ...(api.subcategoriaId ? {subcategoriaId: api.subcategoriaId} : {}),
    nome: api.nome,
    descricao: api.descricao,
    patrimonio: api.patrimonio,
    codigoQr: api.codigoQr,
    status: api.status,
  };
  return api.foto ? {...item, foto: api.foto} : item;
}
