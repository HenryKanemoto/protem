# Protem: relatório da atualização (antes Nexus)

Branch `refactor/protem-rebrand`, outubro de 2026. Segue as 7 fases do `CLAUDE.md`. **Nada foi enviado (push), publicado (deploy) nem renomeado no banco.**

Resumo: o app agora roda **só com o Angular**, sem Docker e sem back-end, inclusive como site estático; ícones e fontes vêm de dentro do app; o nome é Protem; as cores seguem a marca; as telas principais estão mais enxutas; e o QR code ficou mais simples. **Nenhuma funcionalidade foi removida.** Algumas mudaram de lugar; a lista está em [Funcionalidades que mudaram de lugar](#funcionalidades-que-mudaram-de-lugar).

## Como rodar

```bash
cd frontend
npm install
npm start
```

Abre em <http://localhost:4200>, só com Node. Detalhes, modo api (com Docker e back-end) e build estático estão no [README](../../README.md).

---

## Fase 1: rodar só com o Angular

**Antes:** o front-end chamava `/api/item` ao abrir. Sem o back-end, aparecia "Erro 500 ao falar com o backend" no topo de todas as telas (veja `antes/04-painel-1366x768.png`).

**O que mudou**

- **Fonte de dados alternável** (`frontend/src/store/fonte-de-dados/`): interface `FonteDeDados` com `FonteLocal` (padrão, sem nenhuma requisição) e `FonteApi` (o comportamento anterior, com os itens sincronizados com o back-end). A escolha fica em `environment.fonteDeDados`; a configuração `api` (`npm run dev:api`) troca o arquivo e liga o proxy. As telas só falam com o `ProtemStore`.
- **Regras de negócio**: já estavam em funções puras em `store/regras/` (o back-end só tem o CRUD de itens). Ficaram lá, por decisão da equipe, e ganharam **72 testes** (RN01 a RN10, rotina automática, seed, persistência e fotos no modo api).
- **Persistência**: chave `protem:v1`, lendo uma vez os dados das chaves antigas do Nexus. Dados corrompidos voltam para o seed; cota cheia mostra um aviso.
- **Seed de demonstração** com uma situação de cada tipo: contas pendente (Diego), bloqueada (Bruno) e suspensa (Elisa); pedidos pendente, aprovado, recusado e expirado; empréstimo ativo e atrasado; item em manutenção com ocorrência; histórico. Os 15 itens são os mesmos do seed do back-end. Um teste garante que o seed já obedece às regras.
- **Aviso** "Dados salvos neste navegador" no painel de demonstração.
- **Build estático**: `vercel.json` (Root Directory `frontend`), `public/_redirects` e `npm run servir`, que serve o build com fallback de rotas só com Node.
- **`package.json` na raiz**: `npm install` e `npm start` também funcionam a partir da raiz do clone.

**Bug corrigido:** datas `AAAA-MM-DD` eram lidas como meia-noite UTC, que no Brasil é 21h do dia anterior. O prazo aparecia e vencia **um dia antes** do escolhido, e a RN02 aceitava um dia além do prazo da categoria.

## Fase 2: ícones e fontes

**Antes:** fontes e Material Icons vinham do Google (`fonts.googleapis.com`). Sem acesso a esse domínio, os ícones apareciam como texto ("spa", "inbox", "close"); isso foi reproduzido em `antes/sem-cdn/`.

**O que mudou**

- Fontes Geist, Geist Mono e Bricolage Grotesque via `@fontsource-variable`, empacotadas no build.
- Ícones em **SVG embutido** (Material Icons, variante round): `scripts/gerar-icones.mjs` gera `src/app/icones.ts` a partir dos ícones usados (`npm run icones`), e eles são registrados no `MatIconRegistry`. Não há fonte de ícones, então o nome nunca aparece como texto.
- `mat-icon` com `aria-hidden="true"`; todos os botões só com ícone têm `aria-label`.
- Não há CSP no projeto. Os únicos assets referenciados batem em maiúsculas e minúsculas com os arquivos versionados. `base href` é `/`.

## Fase 3: Nexus → Protem

- Textos, título da aba com o subtítulo "Plataforma Web de Empréstimos", login com o subtítulo, notificações, etiqueta impressa, README, `package.json` e comentários.
- Código: `NexusStore`/`NexusState` → `ProtemStore`/`ProtemState` (`protem.store.ts`).
- Favicon, ícone do app e `manifest.webmanifest` com o ícone quadrado de `public/brand/protem_logos/`.
- `grep -ri nexus` (sem `node_modules`) só encontra: o banco `nexus_db`, as chaves antigas do `localStorage` (lidas para migrar dados), a nota histórica do README e este relatório.

## Fase 4: identidade visual

- Todos os tokens da tabela do `CLAUDE.md` estão no `@theme` do Tailwind 4 (`frontend/src/styles.css`). A paleta padrão do Tailwind foi desligada, então uma cor fora dos tokens não gera CSS.
- Menu lateral e cabeçalhos em navy; o item ativo tem fundo `sidebar-hover` e um marcador dourado de 3 px. O dourado só aparece como acento, sobre o navy.
- Botões: primário azul, secundário com borda `border-input` e texto navy, terciário só texto azul. Cartões com raio de 12 px, campos e botões com 10 px, sombras leves e sem gradientes.
- Etiquetas de estado com as cores por estado da tabela.
- `BrandLogo` (um único componente) com o ícone da marca e variante para fundo escuro.
- Títulos de aba curtos ("Catálogo · Protem"), estados vazios com texto útil e o vocabulário do projeto (item, avaria).
- **Contraste AA:** 0 textos abaixo do mínimo (veja [medicoes.md](medicoes.md)).

## Fase 5: telas mais enxutas

Aplicada às 8 telas da lista de prioridade:

- **Menu do responsável** em Operação (Painel, Solicitações, Leitor de QR code), Acervo (Itens, Categorias, Manutenção) e Gestão (Usuários, Relatórios, Configurações).
- **Painel:** 3 contadores e 1 atalho principal ("Ler QR code"); listas com no máximo 5 linhas e "Ver todos"; a tabela aberta pelo contador tem 5 colunas.
- **Catálogo, Itens e Histórico:** só a busca fica visível; os demais filtros ficam atrás de "Filtros", que mostra quantos estão em uso.
- **Em todas:** uma ação preenchida por tela (as demais viram links); só o estado usa cor; metadados em cinza; explicações em tooltip; menos etiquetas, separadores e textos em fonte mono.
- Sem rolagem horizontal em 1366×768 e 390×844.
- Densidade antes e depois por tela: [medicoes.md](medicoes.md).

## Fase 6: QR code

- **Leitor:** só a moldura, o campo "Código ou patrimônio" e "Buscar". Se a câmera falhar (sem permissão, sem câmera, sem HTTPS), aparece um aviso curto e o foco vai para o campo, sem erro técnico. Testado sem câmera e com uma câmera simulada.
- **Um passo de confirmação:** reservado leva à retirada; emprestado ou atrasado leva à devolução; os outros estados mostram um aviso claro (RN05).
- **Etiqueta:** gerada e impressa só na ficha do item ("Imprimir etiqueta"). Saíram o QR sempre visível da ficha, o QR da tela do item do solicitante e o desenho de QR das etiquetas ilustrativas do login.

## Verificação (Fase 7)

| Verificação | Resultado |
|---|---|
| Lint (`ng lint`) | passa |
| Testes do front-end | 72 passam (os 69 de antes também nos fusos UTC e Tóquio) |
| Build de produção, modo local e modo api | passam (436 kB iniciais, 112 kB transferidos) |
| Testes e compilação do back-end | 7 testes passam e compila. Não mexi em `backend/`; os 3 avisos de lint dele já existiam |
| Fluxo completo pela interface, nas 3 políticas: cadastro e aprovação de conta, pedido, aprovação, retirada por QR e por patrimônio, +1 dia, +3 dias, atraso, devolução com e sem avaria, recarga da página, "Reiniciar dados" | passa no modo local (dev, build de produção e clone limpo com domínios externos bloqueados) e no modo api |
| Requisições no modo local | nenhuma para `/api` nem para outros domínios |
| Erros no console | nenhum |
| Varredura de 33 rotas × 2 tamanhos | sem ícone em texto, sem botão sem nome, fontes carregadas, sem rolagem horizontal |
| Contraste AA (25 rotas × 2 tamanhos) | 0 abaixo do mínimo em 2.140 textos |
| Clone limpo: `npm install` e `npm run build` na raiz, depois `npm start` | funciona só com Node |

Capturas em `antes/` e `depois/`, cada uma também em `sem-cdn/`, com domínios externos bloqueados, nos tamanhos 1366×768 e 390×844.

## Decisões tomadas com a equipe nesta atualização

1. As regras de negócio continuam em `store/regras/` (o `CLAUDE.md` citava `core/rules` como exemplo).
2. Chave `protem:v1` no `localStorage`, migrando os dados das chaves antigas do Nexus.
3. No modo api, um navegador sem dados salvos envia o seed ao banco, para os itens ficarem coerentes com os empréstimos de demonstração. Depois que a `main` passou a ter fotos no seed do banco, esse envio (e o "Reiniciar dados") **mantém a foto do banco** quando o item do navegador não tem uma; antes, as fotos eram trocadas por `null`. Testado com uma API falsa com fotos nos 15 itens.
4. O banco `nexus_db` e o prefixo `NX-` de patrimônio e QR **foram mantidos**.
5. Primary `#2F6AFE` em vez de `#2F6BFF`: o valor da tabela dá 4,499:1 com branco e reprova o AA por pouco. `brand-blue` segue `#2F6BFF` na logo.
6. Contas (aprovar cadastros) e Histórico saíram do menu: abrem a partir de Usuários e de Relatórios, e as rotas não mudaram.
7. O teste no Chrome e no Firefox fica com a equipe (nesta máquina só havia o Edge).

## Decisões que tomei sem consultar (revisem)

- **Bug do fuso corrigido** (`parseDate`). Muda o resultado das regras no Brasil, mas para o que a RN02 e a RN06 descrevem.
- **Relógio de demonstração** continua parado entre uma sessão e outra, como antes: ele não avança com o tempo real. A rotina automática roda ao carregar e a cada avanço.
- **Cota do navegador cheia:** mostra um aviso e mantém os dados em memória, em vez de recarregar o seed, que apagaria o trabalho da pessoa.
- **Modo api:** o erro 500 do proxy do Angular (back-end desligado) passou a ser tratado como "sem conexão", com o botão "Tentar de novo". Antes aparecia "Erro 500".
- **Leitor:** os "Atalhos de teste" viraram sugestões do próprio campo de código (`datalist`), em vez de botões na tela.
- O "Escanear" do cabeçalho virou botão de contorno, para não competir com a ação principal de cada tela. O botão "Aprovar" (antes verde) agora usa o azul primário.
- Explicações longas foram para o atributo `title` (tooltip).

## Funcionalidades que mudaram de lugar

| Funcionalidade | Antes | Agora |
|---|---|---|
| Aprovar contas | item "Contas" no menu | aviso em Usuários ("N cadastros aguardam aprovação"); mesma rota `/painel/contas` |
| Histórico de movimentações | item "Histórico" no menu | link "Ver histórico" em Relatórios; mesma rota `/painel/historico` |
| Atalhos de teste do leitor | botões abaixo do campo | sugestões do campo de código |
| QR do item | sempre visível na ficha e na tela do solicitante | dentro de "Imprimir etiqueta", na ficha |
| Filtros de Catálogo, Itens e Histórico | sempre abertos | atrás do botão "Filtros" |

## Pendências e pontos para a equipe

- [ ] **Testar no Chrome e no Firefox** com o build de produção e domínios externos bloqueados. Nesta máquina só foi possível testar no Edge, que usa o mesmo motor do Chrome.
- [ ] **Testar o modo api com o Docker e o back-end reais.** O Docker Desktop estava desligado; o modo api foi testado com um servidor falso que segue o mesmo contrato de `/api/item`.
- [ ] **Testar a câmera** num celular, por HTTPS (por exemplo, na Vercel). Ela só funciona em HTTPS ou localhost.
- [ ] **Publicar na Vercel**, se a equipe quiser: Root Directory `frontend`, o resto já está no `vercel.json`. Não publiquei.
- [ ] **Tooltips (`title`) não aparecem no toque.** No celular, as explicações que foram para tooltip ficam invisíveis. Avaliar se alguma deve voltar como texto curto.
- [ ] **Telas fora da lista de prioridade** (Categorias, Manutenção, Configurações, Perfil, Cadastro e os formulários) receberam os tokens novos, mas não passaram pelo enxugamento completo da Fase 5.
- [ ] **Cópia de trabalho:** a exclusão de `backend/dist/` que já estava na cópia local não foi incluída em nenhum commit, e o `CLAUDE.md` continua sem versionar. As logos e o favicon antigos do Nexus, que também estavam apagados na cópia local, entraram no commit do favicon novo.
- [ ] **Fotos do seed do banco** (vindas da `main`) são links para sites de terceiros (Google, Amazon, Mercado Livre...). Elas só aparecem no modo api, podem sair do ar e têm direitos de uso incertos. Vale decidir se a equipe prefere imagens próprias em `public/`, que também funcionariam no modo local.
- [x] Pull request de `refactor/protem-rebrand` para `main` (PR #2, aceito).

---

# Rodada 2: código de retirada, landing e logo (branch `feat/codigo-retirada-landing`)

Feita a partir da `main` com o trabalho da equipe no código de retirada (`Meus códigos` e geração na aprovação). As regras RN01 a RN10 e o back-end não mudaram.

## O que mudou

- **Código de retirada (segurança na retirada).** O código já era gerado na aprovação e mostrado a quem pediu; agora ele é **conferido**:
  - A tela "Confirmar retirada" tem o campo "Código de retirada". O responsável digita o código que a pessoa mostra no app, e a retirada só é registrada se ele estiver certo. Maiúsculas, espaços e hífen não importam.
  - **O responsável não vê o código em nenhuma tela.** O código também nunca aparece na mensagem de erro. O teste ponta a ponta confere isso em 6 telas do responsável.
  - **Uso único:** o código só vale enquanto o pedido está aprovado. Depois da retirada (concluído) ou da expiração no fim do dia (RN04), ele não vale mais.
  - **Geração** em regra pura (`store/regras/codigos.ts`), no lugar do `GeradorCodigo`: 6 caracteres sem os que se confundem (0/O, 1/I/L) e sem repetir um código de outro pedido aprovado. Pedidos aprovados salvos antes recebem um código ao carregar.
  - **Quem pediu vê o código** no cartão "Retire hoje" de Meus empréstimos, em Meus códigos e na notificação de aprovação. Seed: o pedido aprovado do Gustavo tem o código `K7PM4X`.
- **Meus códigos:** só com os tokens de cor (o laranja `#f59e0b` sobre branco reprovava o AA), estado vazio com a classe certa (antes `solty`, que não existe) e pedidos com código válido primeiro.
- **Menu inferior do celular:** volta a ter 4 itens (Catálogo, Empréstimos, Avisos e Perfil). Com 5, o quinto caía para uma segunda linha. Meus códigos fica acessível pelo cartão "Retire hoje" e pelo Perfil.
- **Logo maior no login**, usando os SVGs oficiais de `public/brand` pelo `BrandLogo` (variantes `horizontal` e `icone`), sem redesenhar em texto: ícone de 56 px no painel navy e logo horizontal de 56 px acima do formulário. As outras telas não mudaram.
- **Landing page em `/`** (o login continua em `/login`), com "Acessar plataforma" e os pacotes do pitch:
  - Essencial: R$ 2.000, pagamento único, até 100 itens.
  - Completa: R$ 3.600, pagamento único, até 500 itens.
  - Suporte mensal: R$ 150 por mês ou R$ 1.500 por ano.

  Inclui a nota "Valores e limites de exemplo, revisados com cada escola". Cada pacote leva a "Acessar plataforma".

## Verificação

| Verificação | Resultado |
|---|---|
| Testes do front-end | 89 passam (17 novos: código de retirada e seed) |
| Lint e build nos modos local e api | passam |
| Fluxo completo nas 3 políticas, com código errado (bloqueia), código certo (libera) e uso único | passa (build de produção, domínios externos bloqueados) |
| Código visível para o responsável | não aparece em nenhuma das 6 telas verificadas |
| Varredura de 36 rotas × 2 tamanhos (com landing e Meus códigos) | sem ícone em texto, sem botão sem nome, sem rolagem horizontal, sem erros no console |
| Contraste AA (28 rotas × 2 tamanhos) | 0 abaixo do mínimo em 2.282 textos |
| Back-end e `docker-compose.yml` | sem mudanças |

Capturas em `rodada-2/` (1366×768 e 390×844, com domínios externos bloqueados).

## Ideia para depois: Insumos

Adiado por decisão da equipe. Fica registrado como ideia:

- **O que é:** itens que vão e não voltam (papel, cola, lápis, canetinhas, cartolina...), separados dos empréstimos, com "Insumos" no cabeçalho de alunos e professores.
- **Regras sugeridas:**
  - Pedido com aprovação do responsável e código de retirada, como nos empréstimos.
  - Quantidade limitada por pedido e pelo estoque livre.
  - Reserva no dia da aprovação, expirando no fim do dia como a RN04.
  - Baixa no estoque na entrega.
  - Sem devolução, atraso ou avaria.
  - Aviso ao responsável quando o estoque ficar baixo.
- **Telas sugeridas:** catálogo de insumos para quem pede; cadastro e reposição de estoque em Acervo; pedidos numa aba de Solicitações.
- **Dados:** no navegador nos dois modos. O back-end hoje só guarda os itens do acervo.

## Pendências da rodada 2

- [ ] **Nomes do seed:** "Gustavo Machado" é igual ao nome de um autor do repositório, e "Enzo Capiel" lembra "Enzo Capitani". Se forem pessoas reais, trocar por nomes fictícios, porque o `CLAUDE.md` pede só dados fictícios. Isso aguarda a decisão da equipe.
- [ ] **Tentativas de código:** não há limite de tentativas erradas na retirada. Com 31 caracteres em 6 posições há cerca de 887 milhões de combinações, e quem digita é o responsável. Avaliar se vale bloquear depois de algumas tentativas.
- [ ] O código fica no navegador (como pedidos e empréstimos) também no modo api.

---

# Rodada 3: revisão de usabilidade e identidade (branch `feat/revisao-usabilidade`)

Princípio pedido pela equipe: nada importante depende de "descobrir" um clique. Nenhuma funcionalidade nova; regras de negócio e back-end sem mudanças.

| Tela | Antes | Agora |
|---|---|---|
| Painel do responsável | Emprestados só apareciam ao clicar no contador, sem aviso | Três listas sempre abertas: retiradas de hoje, atrasados (maior atraso primeiro) e emprestados no prazo ("devolve amanhã"). Topo de boas-vindas com a marca |
| Meus empréstimos | Abria em "Pendentes"; o item com a pessoa e o prazo ficavam na aba "Com você" | Sem abas: Com você, Pedidos e Histórico na mesma página. Prazo como "Vence amanhã" ou "Faltam N dias" |
| Catálogo | Categorias atrás do botão "Filtros" | Categorias sempre visíveis; topo explica o que fazer |
| Solicitações, Leitor, Retirada, Devolução, Meus códigos | Explicações importantes só em tooltip (somem no celular) | Texto curto visível |
| Leitor / demonstração | Códigos de teste só como sugestão do campo; botão da demo mostrava só a data | Códigos de teste listados; botão diz "Demonstração" |
| Todas | Geist + Bricolage, 15 px | Atkinson Hyperlegible Next e Mono (fontes de leitura fácil), 16 px, mais respiro, traço dourado sob o título |

**Verificação:** 89 testes, lint e build (modos local e api) passam. Fluxo completo da demonstração nas 3 políticas (78 verificações), leitor, varredura de 36 rotas × 2 tamanhos (sem rolagem horizontal, botão sem nome ou erro) e 0 de 2.426 textos abaixo do AA, tudo no build de produção com domínios externos bloqueados. Capturas em `rodada-3/`.

**Fora desta rodada:** telas fora do fluxo principal (Categorias, Manutenção, Configurações, formulários) só receberam os ajustes globais de fonte e espaçamento; Itens e Histórico do responsável mantêm os filtros atrás de "Filtros"; nomes do seed e Insumos seguem pendentes.
