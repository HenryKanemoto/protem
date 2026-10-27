# CLAUDE.md — Protem (antes Nexus)

Plataforma web de empréstimo de itens (equipamentos e materiais) para escolas e instituições acadêmicas. Projeto Integrador do curso de Programador Full Stack (SENAI Macapá), 3º Caso.

O projeto se chamava **Nexus** e agora se chama **Protem** ("pro item", tirando o "i"), com o subtítulo **Plataforma Web de Empréstimos**.
Título formal: *PROTEM: Plataforma Web para Gerenciamento de Empréstimos de Itens em Instituições Acadêmicas.*

## Objetivo desta atualização

Na apresentação, a aplicação não subiu no computador do professor, porque ele não tinha Docker, e ela depende do MySQL em Docker e do back-end. Os ícones também não apareceram, e o professor achou a interface "genérica e poluída". A equipe não concorda totalmente com isso, mas vai agir. Faça seis coisas, nesta ordem:

1. Fazer a aplicação rodar **só com o Angular**, sem back-end e sem Docker (prioridade máxima).
2. Corrigir os ícones e fontes que falharam.
3. Renomear Nexus para Protem em todo o projeto.
4. Adaptar as cores e a identidade visual à logo (menos "genérica").
5. Deixar as telas mais enxutas (menos "poluída"), sem remover funcionalidades.
6. Simplificar a experiência do QR code, **sem removê-lo**.

Se o tempo for curto, as fases 1 e 2 são o mínimo para a próxima apresentação.

## O que NÃO pode mudar

- As regras de negócio RN01 a RN10, os estados e a política de atraso (descritos no fim deste arquivo). Fluxos e testes que dependem delas devem continuar passando, nos dois modos de dados.
- A stack: Angular 21 + Tailwind no front-end; NestJS + TypeORM + MySQL no back-end; Docker para o banco.
- O **back-end e o Docker continuam no repositório, intactos e funcionando**. Eles só deixam de ser usados por padrão. Não apague, não desligue e não quebre o modo que usa a API.
- O modo demonstração (relógio simulado, troca de usuário, reinício dos dados).
- Não remova funcionalidades por conta própria. Se achar que algo deve sair, liste no relatório final e espere a decisão da equipe.
- Não faça push, deploy ou migração destrutiva sem pedir confirmação.

Se uma instrução deste arquivo conflitar com o código existente, descreva o conflito e pergunte antes de decidir.

## Plano de trabalho

### Fase 0: preparação
- Leia o repositório, descubra os scripts no `package.json` e rode o projeto.
- Crie a branch `refactor/protem-rebrand`.
- Antes do primeiro commit, confira `git config user.name` e `git config user.email` do repositório. Já houve um commit na conta errada.
- Commits pequenos, com mensagens em português no padrão `tipo: descrição` (`feat`, `fix`, `refactor`, `chore`, `docs`).
- Tire capturas de tela "antes" das telas principais em 1366×768 e 390×844 e salve em `docs/protem/antes/`.

### Fase 1: rodar só com o Angular (sem back-end, sem Docker)

**Requisitos**
1. **Fonte de dados alternável.** Crie uma camada de acesso a dados com uma interface única, com duas implementações: `Api` (a atual, via HTTP) e `Local` (nova, no navegador). Escolha por configuração (`environment` ou token de injeção, por exemplo `dataSource: 'local' | 'api'`), com **`local` como padrão**. Os componentes não podem saber qual está em uso. Se já existem services HTTP, extraia a interface a partir deles e preserve a estrutura do projeto.
2. **Implementação local:**
   - Estado em memória, persistido em `localStorage` com chave versionada (por exemplo `protem:v1`). Trate erro de cota e dados corrompidos recarregando o seed.
   - Dados de demonstração fictícios: um responsável, alunos, um professor, contas pendente, bloqueada e suspensa, categorias, itens com QR e patrimônio, e situações iniciais para nenhuma tela ficar vazia (pedido pendente, aprovado, empréstimo ativo, atrasado, item em manutenção e histórico). Se o back-end já tem seed, use os mesmos dados.
   - Autenticação simulada: login com os usuários do seed, sem rede, e guards por perfil funcionando como hoje. Mantenha os atalhos para entrar como aluno, professor e responsável.
   - **Regras de negócio:** leia os serviços do back-end e porte a lógica para funções TypeScript puras, sem dependência do Angular (por exemplo em `src/app/core/rules/`), usadas pela implementação local. Preserve o comportamento exato: limites por categoria, expiração no fim do dia, dias de atraso, bloqueio, suspensão e política configurável. Escreva testes unitários para cada regra, com os mesmos casos que o back-end trata.
   - **Relógio virtual:** "+1 hora", "+1 dia", "+3 dias" e "Reiniciar dados" funcionam no front-end. A rotina automática (expirar pedidos aprovados e não retirados, marcar atrasos, bloquear e suspender, encerrar suspensões, gerar avisos de prazo e de atraso) roda ao avançar o relógio e ao carregar a aplicação, recuperando o que passou.
   - Notificações, histórico (com filtros), relatórios e ocorrências calculados a partir dos dados locais.
   - Fotos de item: guarde como imagem reduzida em data URL, ou use imagens do próprio projeto. Sem upload para servidor.
   - QR code: gerar e ler no navegador. A leitura pela câmera exige HTTPS ou localhost, e a digitação do código ou do patrimônio continua como alternativa.
3. **Nada externo em execução.** No modo local, a aba Network não pode mostrar requisição para `/api`, para outro servidor, nem para CDN. Só os arquivos estáticos da própria aplicação.
4. **Execução simples.** `npm install` e `npm start` (ou o script equivalente) devem bastar, só com Node instalado, sem Docker, sem MySQL e sem subir o back-end.
5. **Build estático.** `ng build` deve gerar uma pasta que funcione em qualquer servidor estático, inclusive recarregando rotas internas (fallback para `index.html`, `vercel.json` ou equivalente). Assim o professor poderá abrir um link no navegador sem instalar nada. Prepare a configuração para publicação estática (por exemplo Vercel), mas **não publique sem pedir confirmação**.
6. **Voltar ao back-end.** Documente no README como alternar para `api`, como subir o Docker e o back-end. Mantenha scripts e `docker-compose.yml` como estão. O modo `api` não pode quebrar.
7. **Aviso discreto** no painel do modo demonstração: "Dados salvos neste navegador", para ninguém confundir com dados reais.

**Critérios de aceite**
- Em um clone limpo, sem Docker e sem o back-end rodando, `npm install` e `npm start` abrem o app e o fluxo completo funciona: cadastro e aprovação de conta, pedir, aprovar, retirar (QR ou digitação), avançar o relógio, atrasar, devolver com e sem avaria, nas três políticas de atraso.
- Recarregar a página preserva o estado, e "Reiniciar dados" restaura o seed.
- O build estático abre por um servidor estático, inclusive com recarga em rotas internas.
- Os testes das regras passam, não há requisição ao back-end no modo local e não há erros no console.

### Fase 2: ícones e fontes
Hipótese principal: ícones e fontes carregados de CDN (Google Fonts, Material Icons, Font Awesome etc.) foram bloqueados pela rede do computador do professor, e os ícones apareceram como texto ou quadrados. Verifique também caminhos de assets no build de produção (`base href`, diferença entre maiúsculas e minúsculas nos nomes de arquivo, que quebra em servidores Linux como a Vercel) e a política de segurança de conteúdo (CSP).

1. Liste todas as requisições externas (`index.html`, `angular.json`, `@import` em CSS, imports de fontes).
2. Hospede tudo dentro do projeto: fontes de texto via pacote npm (por exemplo `@fontsource/...`) e ícones de preferência como SVG, ou fonte de ícones local.
3. Ícones decorativos com `aria-hidden="true"`; botões só com ícone com `aria-label`. Nunca deixe o nome do ícone aparecer como texto.

Critério de aceite: com todos os domínios externos bloqueados (DevTools, aba Network, bloquear domínio, ou modo offline depois do primeiro carregamento), as telas ficam iguais, com ícones e fontes. Teste no Chrome, no Edge e no Firefox, usando o build de produção.

### Fase 3: renomear Nexus para Protem
- Troque Nexus, NEXUS e nexus por Protem em: textos visíveis, título da aba, favicon e manifest, README, `package.json` (`name`, `description`), docs, comentários, seeds e mensagens de notificação.
- Grafia: "Protem" nas frases; "PROTEM" só em títulos formais.
- Mostre o subtítulo "Plataforma Web de Empréstimos" na tela de login e no `<title>`.
- Nomes técnicos que podem quebrar dados: nome do banco ou esquema, volumes e containers do Docker, variáveis de ambiente, chaves de `localStorage`, prefixos de códigos de QR e de patrimônio (por exemplo "NX-"). Renomeie agora só o que for visual. Para o resto, mostre o impacto e peça confirmação. Se mudar o prefixo dos códigos, continue reconhecendo os antigos.
- Ao final, rode `grep -ri nexus` (sem `node_modules`). Só podem restar menções históricas, como "antes Nexus" no README e no relatório.

### Fase 4: identidade visual e cores (com base na logo)
As três direções de logo do Protem usam a mesma paleta, então os tokens abaixo valem para qualquer uma. Se existir arquivo em `public/brand/`, confira as cores dele com esta tabela e use o ícone quadrado como favicon e ícone do app.

**Paleta da marca**

| Token | Cor | Uso |
|---|---|---|
| `brand-navy` | `#0E1A3A` | menu lateral, cabeçalho, títulos |
| `brand-blue` | `#2F6BFF` | cor primária: botões principais, item ativo, foco |
| `brand-gold` | `#F2B705` | só acento: marcador do item ativo no menu, detalhes de ilustração, detalhe da logo |
| `brand-soft` | `#EAF1FE` | fundos suaves: linha selecionada, cartão de destaque, estados vazios |

**Tokens derivados** (contrastes já calculados contra WCAG AA)

| Token | Cor | Uso e contraste |
|---|---|---|
| `primary` | `#2F6BFF` | fundo de botão com texto branco (4,5:1) |
| `primary-hover` | `#2558D9` | hover e pressed; texto e links azuis sobre branco (6,0:1) |
| `primary-strong` | `#1E47B8` | texto azul sobre `brand-soft` (7,0:1) |
| `text` | `#1F2937` | texto do corpo (14,7:1) |
| `text-heading` | `#0E1A3A` | títulos |
| `text-muted` | `#5B6475` | texto secundário (6,0:1 no branco) |
| `bg` | `#F6F8FC` | fundo da página |
| `surface` | `#FFFFFF` | cartões e tabelas |
| `border` | `#D5DCE8` | divisórias e bordas de cartão |
| `border-input` | `#7C879B` | borda de campos de formulário (3,6:1) |
| `sidebar-hover` | `#1B2B55` | hover e item ativo no menu lateral |
| `focus-ring` | `#2F6BFF` | foco visível, 2 px com 2 px de afastamento |
| `danger` | `#B91C1C` | erro e ações destrutivas, com texto branco (6,5:1) |

**Cores de estado** (texto sobre fundo, todos com pelo menos 5:1)

| Estado | Texto | Fundo |
|---|---|---|
| disponível | `#166534` | `#DCFCE7` |
| solicitado | `#9A3412` | `#FFEDD5` |
| reservado | `#854D0E` | `#FEF3C7` |
| emprestado | `#1E47B8` | `#DBE7FF` |
| atrasado | `#B91C1C` | `#FEE2E2` |
| em manutenção | `#6B21A8` | `#F3E8FF` |

**Regras de uso**
- Cor forte só para estados e para a ação principal. O resto da interface usa neutros.
- O dourado é só acento. O contraste dele com branco é 1,8:1, então nunca use como texto, como ícone informativo ou como anel de foco em fundo claro. Sobre navy ele funciona (9,4:1).
- Menu lateral e cabeçalho em navy com texto branco; item ativo com fundo `sidebar-hover` e um marcador dourado de 3 px.
- Botão primário azul com texto branco; secundário com borda `border-input` e texto navy; terciário só texto azul.
- Sem gradientes e sem sombras fortes. Raio de 12 px nos cartões e de 10 px nos botões e campos, ecoando o canto arredondado do ícone.
- Texto azul sobre branco usa `primary-hover`; sobre `brand-soft`, `primary-strong`. O `#2F6BFF` puro sobre `brand-soft` tem só 4,0:1 e não serve para texto pequeno.

**Implementação**
- Crie os tokens em um lugar só (tema do Tailwind ou variáveis CSS). Detecte a versão do Tailwind: use `@theme` na v4 ou `theme.extend.colors` na v3.
- Remova cores fixas espalhadas e as cores padrão do tema anterior; padronize botão, card, tabela, badge e formulário usando só os tokens.
- Logo: se não houver arquivo em `public/brand/`, use o texto "Protem" como logotipo provisório, em um único componente `BrandLogo`, para trocar depois.
- Dê personalidade ao conteúdo: foto ou ícone do item nos cartões, estados vazios com texto útil (por exemplo "Nenhum item disponível nessa categoria agora") e vocabulário do projeto (pedido, retirada, devolução, avaria).
- Título da aba por tela, no formato "Catálogo · Protem".
- Verifique o contraste AA nas telas principais (DevTools ou ferramenta equivalente) e registre no relatório.

### Fase 5: telas mais enxutas
Aplique tela a tela:
1. Uma ação principal por tela (botão preenchido). Ações secundárias viram link discreto ou menu "⋯".
2. Tabelas com no máximo 5 colunas visíveis; o resto vai para linha expansível ou tela de detalhe.
3. Filtros: só a busca fica visível; os demais ficam atrás de um botão "Filtros". **Exceção (revisão de usabilidade):** no Catálogo, as categorias ficam sempre visíveis, porque são o jeito de navegar de quem pede.
4. Badges: só o estado usa cor; outros metadados em texto cinza.
5. Painel: no máximo 3 contadores e 1 atalho principal; listas longas com "Ver todos".
6. Menu do responsável agrupado em três blocos: Operação (Painel, Solicitações, Leitor de QR code), Acervo (Itens, Categorias, Manutenção) e Gestão (Usuários, Relatórios, Configurações).
7. Uma escala de espaçamento única, no máximo 2 tamanhos de texto por bloco, menos bordas, sombras e linhas separadoras.
8. Rótulos de 1 a 3 palavras. **Atualizado (revisão de usabilidade):** explicação importante (prazo, expiração, código, avaria, o que o leitor abre) fica em texto visível curto, porque tooltip não aparece no celular. Tooltip só para complemento.
9. Meça a densidade: conte os elementos interativos visíveis por tela antes e depois e registre no relatório.

Ordem de prioridade (as mais cheias primeiro): Painel do responsável, Catálogo, Solicitações pendentes, Meus empréstimos, Itens, Registrar devolução, Relatórios, Histórico.

Critérios: sem rolagem horizontal em 1366×768 e 390×844, contraste AA, foco visível, nenhuma regra de negócio alterada.

### Fase 6: QR code (manter e simplificar)
Decisão: **o QR code fica**. Ele é o diferencial do projeto e consta no documento já entregue ao professor. O problema de "poluição" vem da densidade das telas, não do QR.

- Tela do leitor: só a moldura da câmera, o campo "código ou patrimônio" e o botão Buscar. **Atualizado (revisão de usabilidade):** uma linha de texto explica o que o leitor abre e outra lista os códigos de teste da demonstração.
- A digitação do código ou do patrimônio tem a mesma importância da câmera. Se a câmera falhar (sem permissão, sem câmera, sem HTTPS), mostre uma mensagem curta e coloque o foco no campo manual, sem erro técnico.
- Depois de ler ou digitar, um único passo de confirmação (retirada ou devolução).
- Geração e impressão da etiqueta ficam no detalhe do item ("Imprimir etiqueta"). Remova QRs decorativos de outras telas.
- Mantenha a RN05 e o comportamento por estado do item: reservado leva à retirada; emprestado ou atrasado leva à devolução; qualquer outro estado mostra um aviso claro.

### Fase 7: verificação e relatório
- Rode lint, testes e build, no modo `local` e no modo `api`.
- Teste o fluxo completo no modo demonstração: pedir, aprovar, retirar, avançar 1 dia, atrasar, devolver (com e sem avaria), nas três políticas de atraso.
- Capturas "depois" em `docs/protem/depois/`.
- Escreva `docs/protem/CHANGELOG.md`: o que mudou, antes e depois, contagem de elementos por tela, resultado dos contrastes, pendências e decisões que dependem da equipe.
- Pare e peça confirmação antes de: push, deploy, renomear banco ou volumes, remover qualquer funcionalidade.

## Contexto do produto (referência)

**Perfis:** aluno e professor (mesmo fluxo, fazem pedidos); responsável pelo acervo (aprova, registra retirada e devolução, administra). As contas de responsável já existem no sistema, sem autocadastro.

**Fluxo:** Pedido, Aprovação, Retirada (leitura do QR code), Devolução.

**Regras de negócio**
- RN01: todo pedido, de aluno ou professor, precisa da aprovação do responsável.
- RN02: cada categoria tem um prazo máximo; o solicitante escolhe a data de devolução dentro dele.
- RN03: cada categoria tem um limite de itens por pessoa ao mesmo tempo (contam solicitado, reservado, emprestado e atrasado).
- RN04: depois de aprovado, o item deve ser retirado no mesmo dia; senão o pedido expira e o item volta ao catálogo.
- RN05: a retirada é registrada pelo responsável lendo o QR code (ou digitando código ou patrimônio); o prazo começa a contar na leitura.
- RN06: política de atraso configurável. Simples: só registra o atraso. Intermediária: bloqueia a conta até a devolução. Rígida (padrão): bloqueia até a devolução e, depois dela, suspende pelo mesmo número de dias de atraso.
- RN07: devolução com avaria leva o item para manutenção e cria uma ocorrência no histórico do item e da pessoa.
- RN08: conta nova só solicita depois de aprovada pelo responsável.
- RN09: o item sai do catálogo quando recebe um pedido; se o pedido for recusado, volta.
- RN10: pedido pendente não expira; depois de 2 horas sem análise, o solicitante pode enviar um lembrete ao responsável, uma vez por pedido.

**Estados**
- Item: disponível, solicitado, reservado, emprestado, atrasado, em manutenção.
- Solicitação: pendente, aprovada, recusada, expirada, concluída.
- Conta: pendente, ativa, bloqueada, suspensa.

**Modo demonstração:** avança o relógio em +1 hora, +1 dia ou +3 dias, troca de usuário com um clique e reinicia os dados.

## Revisão de usabilidade e identidade (outubro de 2026)

Pedida pela equipe antes da apresentação; prevalece sobre as regras anteriores onde houver diferença.

**Princípio:** nada importante depende de o usuário "descobrir" que precisa clicar. Informação principal fica sempre visível.

- **Painel do responsável:** três listas sempre abertas (retiradas de hoje, atrasados e emprestados no prazo), com no máximo 5 linhas e um botão "Ver todos os N" que diz quantos existem. Os contadores só mostram números; o de pedidos é link, com seta visível.
- **Meus empréstimos:** sem abas. Seções na ordem Com você (prazo em destaque), Pedidos (código de retirada e em análise) e Histórico (5 mais recentes + "Ver todo o histórico (N)"). Links antigos com `?aba=` rolam até a seção.
- **Catálogo:** categorias sempre visíveis (exceção à regra 3 da Fase 5).
- **Demonstração:** o botão do painel de demonstração diz "Demonstração"; o leitor lista os códigos de teste.
- **Fonte:** Atkinson Hyperlegible Next (títulos e textos) e Atkinson Hyperlegible Mono (códigos), via `@fontsource-variable`. Substituem Geist, Geist Mono e Bricolage Grotesque. O zero com traço da fonte é proposital (não se confunde com O).
- **Tipografia e respiro:** corpo de 16 px com entrelinha 1,6; títulos de tela maiores; `gap-8` entre os blocos da página.
- **Marca discreta:** traço dourado curto sob o título de cada tela (`.page-title`), como o ponteiro do relógio do logo; topo de boas-vindas `.page-hero` (fundo `brand-soft` com o ícone) no Painel e no Catálogo. O dourado continua só como acento.
- **Inspiração visual:** tipografia cuidadosa, espaçamento generoso, cores contidas e hierarquia clara, com identidade própria (as cores da marca, não as de outro site).

## Suspensão, auditoria e personas (outubro de 2026)

Pedida pela equipe; prevalece sobre as regras anteriores onde houver diferença.

- **Suspender, bloquear e reativar** ficam no detalhe do usuário, só para o responsável, com diálogo de confirmação e **motivo obrigatório**. Suspensão manual tem prazo em dias (1 a 90) e termina sozinha; bloqueio manual fica até reativar. O campo `restricaoManual` marca o que foi feito à mão: devoluções e a política de atraso não desfazem.
- Conta bloqueada ou suspensa não pede itens e vê o motivo no catálogo, no perfil e ao tentar pedir.
- **Recusa de pedido** exige motivo, guardado em `motivoRecusa`.
- **Auditoria** (`auditoria` no estado, mais recente primeiro): toda regra que muda conta, pedido ou empréstimo grava um evento com data, autor (ausente = sistema), afetado, item e motivo. Nova regra que mude estado deve gravar o seu evento.
- **Histórico** (menu Gestão) mostra o caminho de cada pedido; **Relatórios** tem as abas Visão geral e Auditoria. Os filtros dessas telas ficam sempre visíveis.
- **Seed:** 3 perfis do login sem histórico + 10 personas (`PERSONAS_DEMO` em `demo-data.ts`) com datas relativas ao relógio. Dados pessoais sempre inventados: e-mail `@example.com`, CPF com dígito verificador inválido, telefone `(96) 90000-0XXX`. A auditoria do seed é montada a partir dos registros (`auditoriaDoSeed`).
- **Chave do navegador:** `protem:v2`. Ao mudar a forma do estado ou o seed, suba a versão.

## Vocabulário e convenções

- Interface sempre em português do Brasil.
- Use "responsável pelo acervo" (não "administrador"), "item", "pedido", "avaria" e "ocorrência".
- As regras de negócio ficam em funções puras (`core/rules`) usadas pelo modo `local`, e nos serviços do back-end no modo `api`. As duas versões precisam dar o mesmo resultado; os componentes de tela só exibem.
- Acessibilidade: contraste AA, foco visível, `aria-label` em botões só com ícone.
- Nada de dados reais de alunos nos seeds: só dados fictícios.
