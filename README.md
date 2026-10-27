# Protem

**Plataforma Web de Empréstimos.** *PROTEM: Plataforma Web para Gerenciamento de Empréstimos de Itens em Instituições Acadêmicas.*

Alunos e professores pedem itens (equipamentos e materiais) pelo catálogo, e o responsável pelo acervo aprova, registra a retirada e a devolução pelo QR code de cada item. Projeto Integrador do curso de Programador Full Stack (SENAI Macapá).

> O projeto se chamava **Nexus**. Alguns nomes técnicos ainda guardam o nome antigo, como o banco `nexus_db` e o prefixo `NX-` dos códigos de patrimônio e QR.

| Pasta | Stack | Porta |
|-------|-------|-------|
| `backend/` | NestJS + TypeORM + MySQL | 3001 |
| `frontend/` | Angular 21 + Tailwind 4 | 3000 |

## Como rodar (só com o Angular)

Basta ter o [Node.js](https://nodejs.org/) LTS (testado com 24). **Não precisa de Docker, MySQL nem back-end.**

```bash
cd frontend
npm install
npm start
```

Acesse **<http://localhost:4200>** (ou use `npm run dev` para abrir em <http://localhost:3000>).

Também dá para rodar da raiz do repositório: `npm install` (instala o front-end) e `npm start`.

## Fonte de dados: local ou api

O app tem uma camada de dados com duas implementações ([frontend/src/store/fonte-de-dados](frontend/src/store/fonte-de-dados)). As telas não sabem qual está em uso.

| Modo | Onde ficam os dados | Como rodar |
|------|---------------------|------------|
| **`local`** (padrão) | Tudo no navegador (`localStorage`, chave `protem:v2`). Nenhuma requisição de rede. | `npm start` ou `npm run dev` |
| **`api`** | Itens do acervo no MySQL, via back-end; o resto no navegador. | `npm run dev:api` (veja abaixo) |

- Nos dois modos, as regras de negócio rodam no navegador, em funções puras ([frontend/src/store/regras](frontend/src/store/regras)), cobertas por testes.
- A escolha fica em [frontend/src/environments/environment.ts](frontend/src/environments/environment.ts) (`fonteDeDados: 'local'`). A configuração `api` do Angular troca esse arquivo por `environment.api.ts` e liga o proxy de `/api` para `http://localhost:3001` ([frontend/proxy.conf.json](frontend/proxy.conf.json)).
- O estado é recarregado ao abrir a página. Se os dados salvos estiverem corrompidos, o app volta para os dados de demonstração.
- O login é de demonstração, sem segurança.

## Modo api (com back-end e Docker)

O back-end e o Docker continuam no repositório e funcionando; só deixaram de ser o padrão.

**1. Banco de dados** (na raiz do projeto):

```bash
docker compose up -d
```

Sobe um MySQL 8.4 na porta `3306` com o banco `nexus_db`.

**2. Backend:** instale as dependências e crie o `backend/.env`, que não é versionado.

```bash
cd backend
npm install
```

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<MYSQL_ROOT_PASSWORD do docker-compose.yml>
DB_NAME=nexus_db
PORT=3001
```

**3. Suba os dois**, em dois terminais:

```bash
cd backend
npm run start:dev
```

```bash
cd frontend
npm run dev:api
```

Acesse **<http://localhost:3000>**.

Na primeira subida, o backend roda as migrations sozinho: cria a tabela `itens` e cadastra os 15 equipamentos de demonstração. Para conferir a API direto: <http://localhost:3001/api/item>.

- Toda mudança num item (cadastro, edição ou troca de situação por empréstimo) é enviada para a API.
- Ao abrir, os itens do banco valem sobre os do navegador. Exceção: um navegador sem dados salvos (ou com o banco vazio) envia os itens de demonstração ao banco, para ficarem coerentes com os empréstimos de demonstração. "Reiniciar dados" faz o mesmo. Nos dois casos, as fotos que já estão no banco são mantidas.
- Se o backend estiver desligado, o app continua funcionando no navegador e mostra um aviso no topo com o botão "Tentar de novo".
- Build de produção no modo api: `npm run build:api` (o servidor precisa responder em `/api`).

> Usa o Claude Code no app desktop? O arquivo [.claude/launch.json](.claude/launch.json) tem as configurações `frontend` (modo local), `frontend-api` e `backend`.

## Build estático (para abrir por um link)

```bash
cd frontend
npm run build
npm run servir
```

`npm run build` gera `frontend/dist/app/browser`, que funciona em qualquer servidor estático com fallback para `index.html` nas rotas internas. `npm run servir` serve essa pasta em <http://localhost:4300> só com o Node, para testar.

- **Vercel:** [frontend/vercel.json](frontend/vercel.json) já tem o build, a pasta de saída e o fallback. Na Vercel, use `frontend` como *Root Directory*.
- **Netlify e similares:** o arquivo `public/_redirects` vai junto no build.
- O app precisa ficar na raiz do domínio (`<base href="/">`).

## Usando a aplicação

O endereço `/` abre a landing page, com os pacotes e o botão "Acessar plataforma"; o login fica em `/login`.

Na tela de login, o bloco **"Acesso rápido de demonstração"** entra com um clique. Todas as contas usam a senha `123456`.

| Perfil | Conta | O que faz |
|--------|-------|-----------|
| Aluno | camila@example.com | Vê o catálogo, pede itens, acompanha os empréstimos. Começa sem histórico |
| Professor | gustavo@example.com | Igual ao aluno. Começa sem histórico |
| Responsável | enzo@example.com | Painel de gestão: aprova pedidos e contas, suspende ou bloqueia contas, registra retiradas e devoluções, cadastra itens, vê histórico, relatórios e auditoria |

### Ciclo de um empréstimo

1. **Aluno** → *Catálogo* → escolhe um item → *Pedir emprestado* → escolhe a data de devolução (limitada pelo prazo da categoria).
2. **Responsável** → *Solicitações* → *Aprovar*. O item fica **reservado** e precisa ser retirado no mesmo dia. Quem pediu recebe um **código de retirada** (em *Meus empréstimos* e *Meus códigos*); o responsável não vê esse código.
3. **Responsável** → *Leitor de QR code*. Escanear o QR do item leva à confirmação da retirada, que só é registrada com o código que a pessoa mostrar no app. O código vale uma vez, até o fim do dia. No pedido aprovado do seed (persona Igor), o código é `K7PM4X`.
4. Na devolução, o mesmo leitor leva à tela *Registrar devolução*. Ali dá para marcar **"Voltou com avaria"**, e o item vai para *Manutenção*.

### Painel de demonstração (relógio)

O botão escuro no canto inferior direito abre o **modo demonstração**:

- **+1 hora / +1 dia / +3 dias:** avança o relógio do sistema e dispara as rotinas automáticas, como pedidos aprovados que expiram, atrasos, bloqueios e lembretes.
- **Entrar como:** troca de usuário sem fazer login. Em cima ficam os 3 perfis do login; embaixo, as **10 personas**, cada uma com uma linha dizendo o que ela mostra.
- **Reiniciar dados de demonstração:** volta tudo ao estado inicial (no modo api, inclusive os itens no banco).
- Os dados ficam salvos **neste navegador**: outro navegador ou outro computador começa do zero.

Os dados de demonstração usam datas relativas ao relógio, então nunca ficam velhos. Além dos 3 perfis do login (sem histórico), há 10 alunos fictícios com comportamentos diferentes:

| Persona | O que mostra |
|---|---|
| Ana Beatriz Moura | Pontual e exemplar; empréstimo que vence amanhã |
| Bruno Teixeira Lima | Atrasos recorrentes; está com um notebook atrasado e a conta bloqueada |
| Carla Nogueira Prado | Devolveu a parafusadeira com avaria (item em manutenção) |
| Davi Ramos Quintela | Pedido recusado com motivo |
| Elisa Rocha Fontes | Suspensa pela política rígida depois de devolver com atraso |
| Fábio Mendes Arruda | Pedidos aprovados que expiraram porque ele não retirou |
| Gabriela Sato Ribeiro | Muitos pedidos; no limite de kits de eletrônica, com um pedido que já libera o lembrete |
| Helena Duarte Campos | Suspensa pelo responsável, com motivo |
| Igor Pacheco Leal | Retira hoje com o código `K7PM4X` |
| Diego Alves Barreto | Acabou de se cadastrar; aguarda aprovação |

Todos os dados pessoais são inventados: e-mails em `example.com` (domínio reservado), CPFs com dígito verificador errado de propósito e telefones `(96) 90000-0XXX`.

### Contas, histórico, relatórios e auditoria (responsável)

- **Suspender, bloquear e reativar:** em *Usuários* › pessoa. Cada ação pede confirmação e motivo. A suspensão tem número de dias e termina sozinha; o bloqueio fica até alguém reativar. Bloqueios e suspensões feitos à mão não são desfeitos por devoluções. A pessoa vê o motivo no catálogo, no perfil e ao tentar pedir.
- **Usuários:** filtros de situação sempre visíveis (ativas, bloqueadas, suspensas, pendentes).
- **Histórico:** o caminho de cada pedido (pedido, aprovação ou recusa com motivo, retirada, devolução), com filtros por período, pessoa, item e situação.
- **Relatórios:** aba *Visão geral* (mais emprestados, atrasos, avarias) e aba *Auditoria*: data e hora, quem fez, quem foi afetado, item e motivo de cada ação, com filtros por período, pessoa e tipo de evento. Ações automáticas aparecem como feitas pelo "Sistema".

### Regras de negócio

| Regra | Onde |
|-------|------|
| RN01: todo pedido precisa de aprovação | Solicitações |
| RN02: devolução dentro do prazo máximo da categoria | Pedir emprestado |
| RN03: limite de itens por pessoa em cada categoria | Catálogo / Pedir emprestado |
| RN04: pedido aprovado expira se não for retirado no mesmo dia | Rotina automática |
| RN05: retirada registrada pelo QR code; o prazo começa aí | Leitor de QR |
| RN06: política de atraso (simples, intermediária ou rígida) | Configurações |
| RN07: devolução com defeito vai para manutenção e gera ocorrência | Registrar devolução |
| RN08: conta nova nasce pendente e precisa de aprovação | Cadastro / Contas |
| RN09: só itens disponíveis aparecem no catálogo | Catálogo |
| RN10: lembrete ao responsável liberado 2 h depois do pedido, uma vez | Meus empréstimos |

## API de itens

Todas as rotas ficam sob `/api`.

| Método | Rota | O que faz |
|--------|------|-----------|
| GET | `/api/item` | Lista os itens |
| GET | `/api/item/:id` | Busca um item |
| POST | `/api/item` | Cria (o `id` é opcional; se faltar, o servidor gera) |
| PUT | `/api/item/:id` | Cria ou atualiza com esse id |
| PATCH | `/api/item/:id/status` | Muda só a situação: `{"status": "manutencao"}` |
| DELETE | `/api/item/:id` | Remove |

Patrimônio e código QR são únicos (`409` se repetirem). Campos obrigatórios: `nome`, `categoriaId`, `patrimonio`, `codigoQr`.

## Ícones e fontes

Nada vem de CDN: o app abre igual sem internet ou com domínios externos bloqueados.

- **Fontes** (Geist, Geist Mono e Bricolage Grotesque): pacotes `@fontsource-variable/*`, ligados em `styles` no [frontend/angular.json](frontend/angular.json). Os arquivos `.woff2` vão junto no build.
- **Ícones**: SVGs do Material Icons (variante *round*) embutidos em [frontend/src/app/icones.ts](frontend/src/app/icones.ts) e registrados no `MatIconRegistry`. Nos templates, use `<mat-icon svgIcon="nome" />`. Ao usar um ícone novo, rode `npm run icones` para regerar o arquivo (nomes em <https://fonts.google.com/icons>). O `mat-icon` já sai com `aria-hidden="true"`; botão só com ícone precisa de `aria-label`.

## Estrutura do frontend

```
frontend/src/
├── app/            rotas e configuração
├── layouts/        layout do responsável (menu lateral) e do solicitante (barra superior)
├── pages/          uma tela por arquivo: P* acesso, S* solicitante, R* responsável (.ts + .html)
├── components/     peças reutilizáveis: modal, status-badge, item-thumb, qr-code, logo...
├── environments/   escolha da fonte de dados (local ou api)
├── store/
│   ├── protem.store.ts  fachada usada pelas telas (estado + regras)
│   ├── fonte-de-dados/  FonteLocal (só navegador) e FonteApi (itens no back-end)
│   ├── regras/          regras de negócio em funções puras, por assunto, com testes
│   ├── demo-data.ts     dados iniciais de demonstração
│   └── persistencia.ts  leitura e gravação no localStorage (chave protem:v2)
├── services/       chamadas HTTP do modo api (itens-api.service.ts)
├── lib/            utilitários de data, texto, imagem e categoria
└── styles.css      sistema visual: cores, fontes e classes (.btn, .card, .input, .table...)
```

## Comandos

| Backend (`backend/`) | |
|---|---|
| `npm run start:dev` | Sobe com recarga automática |
| `npm test` | Testes (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run migration:generate` | Gera migration a partir das entidades (renomeie o arquivo gerado) |
| `npm run migration:run` / `migration:revert` | Aplica / desfaz migrations |

| Frontend (`frontend/`) | |
|---|---|
| `npm start` | Sobe em <http://localhost:4200>, modo local |
| `npm run dev` | Sobe em <http://localhost:3000>, modo local |
| `npm run dev:api` | Sobe em <http://localhost:3000>, modo api (precisa do back-end) |
| `npm run build` | Build de produção estático, modo local |
| `npm run build:api` | Build de produção, modo api |
| `npm run servir` | Serve o build em <http://localhost:4300>, com fallback de rotas |
| `npm run icones` | Regera `src/app/icones.ts` depois de usar um ícone novo |
| `npm test` | Testes (regras de negócio, seed e persistência) |
| `npm run lint` | Lint |

## Problemas comuns

- **`ENOENT ... package.json`**: rode o `npm install` dentro de `frontend/` (ou na raiz, que instala o front-end) e dentro de `backend/` para o modo api.
- **Aviso "Sem conexão com o backend"** (só no modo api): o backend não está rodando na porta 3001. Suba com `npm run start:dev` e clique em "Tentar de novo", ou use o modo local (`npm start`).
- **`EADDRINUSE` no backend**: já existe algo na porta 3001, provavelmente um backend antigo aberto. Feche esse processo ou mude o `PORT` no `.env`.
- **Erro de conexão com o banco**: confira se o container está rodando (`docker ps`) e se o `backend/.env` bate com o `docker-compose.yml`.
- **Câmera do leitor de QR não abre**: o navegador precisa de permissão e só libera câmera em `localhost` ou HTTPS. Sem câmera, digite o código no campo abaixo dela.
- **Avisos de `install-scripts` no npm**: se o build reclamar do `esbuild`, rode `npm install-scripts approve esbuild` dentro de `frontend/`.
