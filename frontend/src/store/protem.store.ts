import {Injectable, computed, inject, signal} from '@angular/core';
import {addHours, parseDate} from '../lib/date-utils';
import {Categoria, Item, PoliticaAtraso, Solicitacao} from '../types/models';
import {getInitialDemoState} from './demo-data';
import {ProtemState, Transicao} from './estado';
import {FONTE_DE_DADOS} from './fonte-de-dados';
import * as acervo from './regras/acervo';
import * as contas from './regras/contas';
import * as emprestimos from './regras/emprestimos';
import {garantirCodigosDeRetirada} from './regras/codigos';
import {executarRotinaAutomatica} from './regras/rotina';
import * as solicitacoes from './regras/solicitacoes';

export type {ProtemState} from './estado';
export type {StatusConexao} from './fonte-de-dados';

/**
 * Fachada única usada pelas telas. Guarda o estado em um signal e delega as regras
 * de negócio para as funções em ./regras.
 *
 * Onde o estado é gravado depende da fonte de dados (./fonte-de-dados): só no navegador
 * (modo local, o padrão) ou no navegador com os itens também no back-end (modo api).
 * As telas não sabem qual fonte está em uso.
 */
@Injectable({
  providedIn: 'root',
})
export class ProtemStore {
  private readonly fonte = inject(FONTE_DE_DADOS);
  private readonly state = signal<ProtemState>(this.fonte.carregar());

  // Situação da gravação: 'local' no modo local; conectando/online/offline no modo api
  readonly conexao = this.fonte.conexao;
  readonly erroApi = this.fonte.erro;

  // Seletores públicos
  readonly agora = computed(() => parseDate(this.state().agora));
  readonly agoraIso = computed(() => this.state().agora);
  readonly configuracao = computed(() => this.state().configuracao);
  readonly usuarios = computed(() => this.state().usuarios);
  readonly categorias = computed(() => this.state().categorias);
  readonly itens = computed(() => this.state().itens);
  readonly solicitacoes = computed(() => this.state().solicitacoes);
  readonly emprestimos = computed(() => this.state().emprestimos);
  readonly ocorrencias = computed(() => this.state().ocorrencias);
  readonly notificacoes = computed(() => this.state().notificacoes);
  readonly auditoria = computed(() => this.state().auditoria);

  readonly usuarioLogado = computed(() => {
    const id = this.state().usuarioLogadoId;
    return this.state().usuarios.find((u) => u.id === id) || null;
  });

  // Notificações não lidas do usuário logado
  readonly notificacoesNaoLidas = computed(() => {
    const user = this.usuarioLogado();
    if (!user) return [];
    return this.state().notificacoes.filter((n) => n.usuarioId === user.id && !n.lida);
  });

  readonly totalNaoLidas = computed(() => this.notificacoesNaoLidas().length);

  // Itens do catálogo público (RN09: só "disponivel" no catálogo)
  readonly itensCatalogo = computed(() => this.state().itens.filter((item) => item.status === 'disponivel'));

  readonly solicitacoesPendentesCount = computed(
    () => this.state().solicitacoes.filter((s) => s.status === 'pendente').length,
  );

  readonly contasPendentesCount = computed(() => this.state().usuarios.filter((u) => u.status === 'pendente').length);

  readonly emprestimosAtrasadosCount = computed(
    () => this.state().emprestimos.filter((e) => !e.devolvidoEm && e.diasAtraso > 0).length,
  );

  readonly ocorrenciasAbertasCount = computed(
    () => this.state().ocorrencias.filter((o) => o.status === 'aberta').length,
  );

  constructor() {
    // Garante consistência com o relógio virtual antes de qualquer tela ler o estado
    // (aplica expirações, atrasos e suspensões pendentes no estado salvo ou no seed)
    // e dá código de retirada a pedidos aprovados salvos antes de o código existir
    this.atualizar((s) => executarRotinaAutomatica(garantirCodigosDeRetirada(s), parseDate(s.agora)));
    this.fonte.conectar({
      estado: () => this.state(),
      receberItens: (itens) => this.receberItens(itens),
    });
  }

  // ==========================================
  // ESTADO E GRAVAÇÃO
  // ==========================================

  /** Aplica uma mudança de estado e entrega para a fonte de dados gravar. */
  private atualizar(fn: (s: ProtemState) => ProtemState) {
    const antes = this.state();
    const depois = fn(antes);
    if (depois === antes) return;
    this.state.set(depois);
    this.fonte.salvar(antes, depois);
  }

  readonly meusCodigos = computed(() => {
  const user = this.usuarioLogado();
  if (!user) return [];
  const itens = this.state().itens;
  return this.state()
    .solicitacoes.filter((s) => s.solicitanteId === user.id && s.codigoRetirada)
    .map((s) => ({
      solicitacaoId: s.id,
      codigo: s.codigoRetirada!,
      item: itens.find((i) => i.id === s.itemId),
      status: s.status,
    }));
});

  /** Igual a atualizar(), para regras que também devolvem um resultado para a tela. */
  private executar<R>(fn: (s: ProtemState) => Transicao<R>): R {
    let resultado!: R;
    this.atualizar((s) => {
      const transicao = fn(s);
      resultado = transicao.resultado;
      return transicao.estado;
    });
    return resultado;
  }

  /** Modo api: troca os itens locais pelos do banco e roda a rotina sobre eles. */
  private receberItens(itens: Item[]) {
    const estado = {...this.state(), itens};
    this.state.set(estado);
    // Mesmos itens dos dois lados: grava no navegador sem reenviar para a API
    this.fonte.salvar(estado, estado);
    // A rotina pode marcar atrasos; aí sim o que mudou é sincronizado
    this.atualizar((s) => executarRotinaAutomatica(s, parseDate(s.agora)));
  }

  /** Modo api: tenta falar com o back-end de novo. */
  reconectar() {
    this.fonte.reconectar();
  }

  dispensarErroApi() {
    this.fonte.dispensarErro();
  }

  // ==========================================
  // RELÓGIO VIRTUAL & ROTINA AUTOMÁTICA
  // ==========================================

  avancarRelogio(horas: number) {
    this.atualizar((s) => {
      const novoAgora = addHours(parseDate(s.agora), horas);
      return executarRotinaAutomatica({...s, agora: novoAgora.toISOString()}, novoAgora);
    });
  }

  avancarDias(dias: number) {
    this.avancarRelogio(dias * 24);
  }

  reiniciarDados() {
    this.fonte.reiniciar(() =>
      this.atualizar(() => {
        const fresh = getInitialDemoState();
        return executarRotinaAutomatica(fresh, parseDate(fresh.agora));
      }),
    );
  }

  // ==========================================
  // AUTENTICAÇÃO E CONTAS (RN08)
  // ==========================================

  login(identificador: string, senha?: string) {
    return this.executar((s) => contas.login(s, identificador, senha));
  }

  logout() {
    this.atualizar((s) => ({...s, usuarioLogadoId: null}));
  }

  trocarUsuarioDemo(usuarioId: string) {
    this.atualizar((s) => ({...s, usuarioLogadoId: usuarioId}));
  }

  cadastrarUsuario(dados: contas.DadosCadastro) {
    return this.executar((s) => contas.cadastrarUsuario(s, dados));
  }

  // Ações do responsável: quem está logado fica registrado na auditoria
  aprovarUsuario(usuarioId: string) {
    this.atualizar((s) => contas.aprovarUsuario(s, usuarioId, s.usuarioLogadoId ?? undefined));
  }

  recusarUsuario(usuarioId: string, motivo?: string) {
    this.atualizar((s) => contas.recusarUsuario(s, usuarioId, motivo, s.usuarioLogadoId ?? undefined));
  }

  bloquearUsuario(usuarioId: string, motivo: string) {
    return this.executar((s) => contas.bloquearUsuario(s, usuarioId, s.usuarioLogadoId ?? '', motivo));
  }

  suspenderUsuario(usuarioId: string, motivo: string, dias: number) {
    return this.executar((s) => contas.suspenderUsuario(s, usuarioId, s.usuarioLogadoId ?? '', motivo, dias));
  }

  reativarUsuario(usuarioId: string, motivo: string) {
    return this.executar((s) => contas.reativarUsuario(s, usuarioId, s.usuarioLogadoId ?? '', motivo));
  }

  // ==========================================
  // SOLICITAÇÕES (RN01, RN02, RN03, RN09, RN10)
  // ==========================================

  solicitarEmprestimo(itemId: string, solicitanteId: string, devolucaoDesejada: string) {
    return this.executar((s) => solicitacoes.solicitarEmprestimo(s, itemId, solicitanteId, devolucaoDesejada));
  }

  aprovarPedido(solicitacaoId: string, responsavelId: string) {
    return this.executar((s) => solicitacoes.aprovarPedido(s, solicitacaoId, responsavelId));
  }

  recusarPedido(solicitacaoId: string, responsavelId: string, motivo: string) {
    return this.executar((s) => solicitacoes.recusarPedido(s, solicitacaoId, responsavelId, motivo));
  }

  podeEnviarLembrete(solicitacao: Solicitacao): boolean {
    return solicitacoes.podeEnviarLembrete(this.state(), solicitacao);
  }

  enviarLembrete(solicitacaoId: string) {
    return this.executar((s) => solicitacoes.enviarLembrete(s, solicitacaoId));
  }

  contarItensAtivosDoUsuarioNaCategoria(categoriaId: string, usuarioId?: string | null): number {
    const s = this.state();
    return solicitacoes.contarItensAtivosDoUsuarioNaCategoria(s, categoriaId, usuarioId !== undefined ? usuarioId : s.usuarioLogadoId);
  }

  verificarPermissaoSolicitacao(categoriaId: string, usuarioId?: string | null) {
    const s = this.state();
    return solicitacoes.verificarPermissaoSolicitacao(s, categoriaId, usuarioId !== undefined ? usuarioId : s.usuarioLogadoId);
  }

  // ==========================================
  // RETIRADA E DEVOLUÇÃO (RN05, RN06, RN07)
  // ==========================================

  registrarRetiradaPorQr(codigoQrOuPatrimonio: string, responsavelId: string, codigoRetirada: string) {
    return this.executar((s) =>
      emprestimos.registrarRetiradaPorQr(s, codigoQrOuPatrimonio, responsavelId, codigoRetirada),
    );
  }

  registrarRetirada(itemId: string, responsavelId: string, codigoRetirada: string) {
    return this.executar((s) => emprestimos.registrarRetirada(s, itemId, responsavelId, codigoRetirada));
  }

  registrarDevolucao(emprestimoId: string, responsavelId: string, comDefeito: boolean, descricaoDefeito?: string) {
    return this.executar((s) =>
      emprestimos.registrarDevolucao(s, emprestimoId, comDefeito, descricaoDefeito, responsavelId),
    );
  }

  // ==========================================
  // ACERVO, CONFIGURAÇÕES E NOTIFICAÇÕES
  // ==========================================

  salvarItem(item: Item) {
    this.atualizar((s) => acervo.salvarItem(s, item));
  }

  removerItem(itemId: string) {
    this.atualizar((s) => acervo.removerItem(s, itemId));
  }

  salvarCategoria(cat: Categoria) {
    this.atualizar((s) => acervo.salvarCategoria(s, cat));
  }

  resolverOcorrencia(ocorrenciaId: string, itemRetornarDisponivel = true) {
    this.atualizar((s) => acervo.resolverOcorrencia(s, ocorrenciaId, itemRetornarDisponivel));
  }

  alterarPoliticaAtraso(novaPolitica: PoliticaAtraso) {
    this.atualizar((s) => acervo.alterarPoliticaAtraso(s, novaPolitica));
  }

  marcarNotificacaoComoLida(notificacaoId: string) {
    this.atualizar((s) => acervo.marcarNotificacaoComoLida(s, notificacaoId));
  }

  marcarTodasNotificacoesComoLidas(usuarioId: string) {
    this.atualizar((s) => acervo.marcarTodasNotificacoesComoLidas(s, usuarioId));
  }
}
