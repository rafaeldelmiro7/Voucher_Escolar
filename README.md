# Voucher de Matrícula — Rede Adventista de Educação (ASuR)

Sistema web para a campanha de matrícula: as escolas cadastram as matrículas, o
sistema controla o limite de vouchers de material escolar, e a Loja SELS
(loja conveniada) registra a retirada do material com foto e assinatura.

Stack: **Cloudflare Pages + Pages Functions (API) + D1 (banco SQLite) + R2
(armazenamento de fotos/assinaturas)**. Sem build step — HTML/CSS/JS puros no
front-end.

## Papéis de acesso

O acesso é feito por **e-mail + senha**. O e-mail já identifica a unidade
(ou a loja) — não existe seleção manual de unidade no login.

- **Escola** (um e-mail por unidade: CAJI, EAOP, EAJI, EAV): cadastra
  matrículas da própria unidade, e vê/edita/exclui/visualiza as que já
  cadastrou (edição e exclusão ficam bloqueadas depois que o material já foi
  retirado).
- **Loja** (um e-mail, Loja SELS): vê todas as matrículas com voucher
  aguardando retirada (de qualquer unidade), filtra por unidade escolar,
  busca por aluno/responsável/CPF/RA, registra a retirada (nome de quem
  retirou, grau de parentesco, foto, assinatura, data automática) e imprime
  um relatório dos materiais já retirados.
- **Admin** (acesso geral): mesmos poderes da escola em **todas** as
  unidades ao mesmo tempo (escolhe a unidade na hora de cadastrar) e mesmos
  poderes da loja. Tem uma navegação extra no cabeçalho para alternar entre
  o painel de matrículas e o de retiradas. Hoje só `rafael.delmiro@adventistas.org`
  e `micelio.reis@adventistas.org` têm esse acesso (flag `is_admin` na tabela
  `usuarios`).

A raiz do site (`/`) é a própria tela de login — não há landing page pública.

## Estrutura do projeto

```
public/            → front-end estático
  index.html        → tela de login (é a própria raiz do site)
  escola/           → painel da escola
  loja/             → painel da loja
functions/          → API (Cloudflare Pages Functions)
  api/auth/          → login, logout, sessão atual
  api/matriculas/    → criar/listar/editar/excluir matrículas, registrar retirada
  api/media/         → serve fotos/assinaturas do R2 (autenticado)
  api/unidades.js    → lista as unidades escolares (para selects/filtros)
  _lib/              → autenticação (hash de senha, sessão) e validações
migrations/          → schema SQL do D1 (numeradas, aplicadas em sequência)
scripts/seed-users.mjs → garante que os usuários iniciais existam (idempotente)
```

## Primeira configuração (uma vez por ambiente)

### 1. Instalar dependências

```bash
npm install
```

### 2. Login na Cloudflare

```bash
npx wrangler login
```

### 3. Criar o banco D1 e o bucket R2 reais na sua conta

```bash
npx wrangler d1 create voucher-matricula-db
npx wrangler r2 bucket create voucher-matricula-media
```

O comando `d1 create` imprime um `database_id`. Copie esse valor para
`wrangler.toml`, substituindo `REPLACE_WITH_D1_DATABASE_ID`.

### 4. Definir o segredo da sessão

Em produção:

```bash
npx wrangler pages secret put SESSION_SECRET
```

(cole uma string aleatória longa quando solicitado — pode gerar uma com
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Em desenvolvimento local, copie `.dev.vars.example` para `.dev.vars` e
preencha `SESSION_SECRET` com outro valor aleatório. **Esse arquivo não é
versionado.**

### 5. Aplicar o schema do banco

```bash
npm run db:migrate:local    # banco local (para desenvolvimento)
npm run db:migrate:remote   # banco real na Cloudflare (para produção)
```

### 6. Criar os usuários iniciais (4 escolas + loja + 2 admins)

Os e-mails de cada unidade, da loja e dos dois admins de acesso geral já
estão em `scripts/seed-users.mjs`. Se algum e-mail mudar, edite a lista
`usuarios` nesse arquivo antes de rodar o seed.

```bash
npm run db:seed:local
npm run db:seed:remote
```

O script é **idempotente**: só gera senha nova para usuários que ainda não
existem no banco. Rodar de novo para adicionar alguém não altera a senha de
quem já foi cadastrado antes — só atualiza papel/unidade/nome. As senhas
novas (se houver) são impressas no terminal e salvas em
`credenciais-geradas.txt` (não versionado — **distribua por um canal seguro e
depois apague o arquivo**).

## Rodando localmente

```bash
npm run dev
```

Abre em `http://localhost:8788`. Usa o D1/R2 simulados localmente pelo
Wrangler (Miniflare) — não afeta os dados reais da Cloudflare.

## Deploy

```bash
npm run deploy
```

Isso publica a pasta `public/` (com as Functions) no Cloudflare Pages. Na
primeira vez, o `wrangler` vai pedir para associar/criar o projeto Pages.

Depois do primeiro deploy, garanta que o projeto Pages tem os bindings de D1
(`DB`), R2 (`MEDIA`) e o secret `SESSION_SECRET` configurados — o
`wrangler.toml` já declara os bindings, e o `pages deploy` os aplica
automaticamente.

## Limite de vouchers (300 primeiras matrículas)

Por decisão atual, a campanha está **sem limite** (todas as matrículas geram
voucher). Para ativar o limite de 300 quando desejarem:

```bash
npx wrangler d1 execute voucher-matricula-db --remote \
  --command "UPDATE config SET valor = '300' WHERE chave = 'limite_vouchers'"
```

Para remover o limite novamente:

```bash
npx wrangler d1 execute voucher-matricula-db --remote \
  --command "UPDATE config SET valor = '' WHERE chave = 'limite_vouchers'"
```

A partir do momento em que o limite é atingido, novas matrículas continuam
sendo cadastradas normalmente (para fins de registro), mas ficam marcadas
como "sem voucher".

## Valor do voucher por período

O valor do voucher (mostrado — travado para edição — no cadastro e na
edição da matrícula) é calculado automaticamente pela data da matrícula,
usando a tabela de faixas em `functions/_lib/voucherValor.js` **e** em
`public/js/voucher-valor.js` (as duas precisam ficar iguais). Períodos
atuais:

- 13/08/2026 a 11/09/2026 → R$ 400,00
- 12/09/2026 a 14/10/2026 → R$ 300,00

Quando os períodos/valores da campanha mudarem, edite a tabela `FAIXAS_VOUCHER`
nos dois arquivos (mesmas datas, mesma ordem) e rode a migration/deploy de novo
se necessário — o valor é recalculado a cada cadastro e a cada edição.
Matrículas cadastradas antes dessa funcionalidade existir mostram "Fora do
período da campanha" (não tinham valor salvo).

## Observações importantes

- **CPF, e-mail e telefone são validados** no cadastro (dígito verificador do
  CPF incluso).
- Fotos e assinaturas ficam no R2 e só podem ser vistas por usuários
  autenticados (loja, ou a escola dona daquela matrícula).
- Para trocar a senha de alguém já cadastrado, gere um hash individual (mesma
  função `hashPassword` de `functions/_lib/auth.js`) e atualize via
  `wrangler d1 execute` — o seed script não sobrescreve senhas existentes.
- Para dar acesso geral (admin) a mais alguém, adicione o e-mail em
  `scripts/seed-users.mjs` com `isAdmin: true` e rode o seed de novo.
- A escola pode **excluir** uma matrícula mesmo depois do material já ter
  sido retirado (útil enquanto os dados ainda são de teste) — isso apaga a
  foto/assinatura do R2 e o registro some do painel da loja também, já que
  os dois painéis leem a mesma tabela. **Editar** continua bloqueado depois
  da retirada, só excluir foi liberado.
- Em ambientes de baixíssima concorrência (poucas secretarias cadastrando
  manualmente) a atribuição do número do voucher é segura; não foi projetada
  para alta concorrência simultânea.
