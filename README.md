# Calculadora de Finanças Pessoais

Aplicação para gerir despesas pessoais, créditos, subscrições e investimentos,
com projeção de cenários ao longo dos anos.

## Stack

- **Next.js (App Router) + React + TypeScript**, responsiva (sidebar em desktop, barra inferior em mobile, instalável como PWA)
- **Neon** (Postgres serverless) para guardar os dados de cada utilizador
- **Neon Auth** para login com email e password (as contas ficam no schema `neon_auth` da base de dados)
- Login obrigatório: a página `/login` é a entrada da app e cada utilizador vê apenas os seus dados
- Cotações de ETFs via Yahoo Finance (com Stooq como alternativa), sem chave de API

## Como correr

```bash
npm install
cp .env.example .env.local   # preencher DATABASE_URL, NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET
npm run db:migrate           # cria as tabelas no Neon (pode ser repetido)
npm run dev                  # http://localhost:3000
npm test                     # testes das fórmulas financeiras
```

### Neon e Neon Auth

1. Cria um projeto em [neon.tech](https://neon.tech) (ou pela integração Neon no Vercel, que preenche o `DATABASE_URL` automaticamente).
2. Copia a *pooled connection string* para `DATABASE_URL`.
3. Na consola do Neon, abre o projeto → **Auth**, ativa o Neon Auth e copia o **Auth URL** para `NEON_AUTH_BASE_URL`.
   Confirma que **Email & password** está ativo nos métodos de login.
4. Gera um segredo com pelo menos 32 caracteres para `NEON_AUTH_COOKIE_SECRET` (ex.: `openssl rand -base64 32`).
5. Corre `npm run db:migrate`.

Sem `NEON_AUTH_BASE_URL`/`NEON_AUTH_COOKIE_SECRET` não é possível entrar: a página de login diz exatamente
qual variável falta (ou se o segredo tem menos de 32 caracteres). O URL também é aceite como `NEON_AUTH_URL`.
O `NEON_AUTH_COOKIE_SECRET` nunca é criado pela integração: tens de o gerar e adicionar tu.

## Deploy no Vercel

1. Importa o repositório em [vercel.com/new](https://vercel.com/new) e escolhe esta branch. O Next.js é detetado automaticamente.
2. Em **Settings → Environment Variables** define `DATABASE_URL`, `NEON_AUTH_BASE_URL` e `NEON_AUTH_COOKIE_SECRET`.
3. Faz deploy. As tabelas são criadas automaticamente: o Vercel corre o script `vercel-build`
   (`node scripts/migrate.mjs && next build`), que aplica as migrações antes de cada build.

A migração pode ser repetida sem problemas (só cria o que falta). Usa `DATABASE_URL_UNPOOLED` (ligação direta,
criada pela integração Neon do Vercel) quando existe, senão `DATABASE_URL`. Num deploy de produção sem
`DATABASE_URL` o build falha com uma mensagem clara; nos previews sem base de dados a migração é ignorada.

O `.npmrc` usa `legacy-peer-deps=true` porque o `@neondatabase/auth` (beta) inclui o better-auth 1.6, cujos
peers opcionais fazem o npm falhar ao lado do vitest 5.

## Como funciona a sincronização

Cada utilizador tem um documento JSON na tabela `user_data`. As alterações são gravadas localmente e enviadas
para `PUT /api/data` passado menos de um segundo. Os outros dispositivos vão buscar a versão mais recente quando a
janela ganha foco e a cada 30 segundos. Em caso de conflito ganha a versão mais recente: o servidor recusa
escritas mais antigas (409) e devolve a sua cópia.

## Contas e dados de cada utilizador

- Todas as páginas exigem sessão; sem sessão o utilizador é enviado para `/login` (entrar ou criar conta).
- O perfil (nome, email, data de registo) vem do Neon Auth e aparece na barra lateral e em **Conta**, onde o nome pode ser alterado.
- Os dados financeiros ficam em `user_data` (um documento por utilizador) e em cache local por utilizador
  (`financas:data:<id>`), por isso duas pessoas no mesmo browser nunca veem os dados uma da outra.
- Dados criados antes de existir login neste dispositivo passam para a primeira conta que entrar.

## Investimentos e ETFs

- **Análise de ETF:** escolhe um ETF (S&P 500, MSCI World, All-World, Nasdaq 100, Emergentes) ou qualquer ticker do
  Yahoo Finance. A app mostra a cotação atual, rentabilidade anualizada (1/5/10 anos e total), volatilidade e pior queda.
- **Simulação:** 2000 trajetórias construídas com blocos de 12 meses reais do histórico do ETF (*block bootstrap*),
  com valor inicial e investimento mensal. Resultado: cenário pessimista (percentil 10), base (mediana) e otimista
  (percentil 90), e probabilidade de terminar abaixo do valor investido.
- **Usar nos Cenários:** aplica essas rentabilidades aos presets pessimista/base/otimista da página Cenários.
- **Carteira:** um investimento com ticker e unidades é avaliado automaticamente ao preço de mercado.
- As cotações vêm de `GET /api/market/<ticker>` (só para utilizadores autenticados), com cache de 1 hora.

## Estrutura

```
src/
  app/              rotas (App Router): /login, (app)/* protegidas; API: /api/auth (Neon Auth), /api/data, /api/market
  views/            ecrãs: Resumo, Orçamento, Créditos, Subscrições, Cenários, Investimentos, Conta
  lib/finance/      fórmulas puras (prestação, amortização, juros compostos, estatísticas e simulação de ETFs) + testes
  lib/market/       leitura das respostas do Yahoo Finance e Stooq
  lib/summary.ts    resumo mensal e projeção de cenários por ano
  lib/server/       ligação ao Neon e configuração do Neon Auth
  data/             tipos, store (localStorage + sincronização)
scripts/migrate.mjs cria a tabela user_data
```

## Módulos e features propostas

### 1. Dashboard
- Saldo mensal: rendimentos − despesas fixas − prestações − subscrições
- Taxa de esforço (prestações / rendimento líquido) com alerta acima de 35%
- Património líquido (ativos − dívidas) e evolução histórica
- Fundo de emergência: meses de despesas cobertos

### 2. Despesas e rendimentos
- Registo por categoria (habitação, alimentação, transportes, saúde, lazer…)
- Despesas fixas vs. variáveis, recorrentes vs. pontuais (seguros anuais, IMI, IUC)
- Orçamento mensal por categoria e desvio real vs. previsto
- Importação de extratos bancários (CSV)

### 3. Créditos
- Crédito habitação, pessoal, automóvel e cartões
- Simulador de prestação (taxa fixa, variável Euribor + spread, mista)
- Plano de amortização completo (juro vs. capital por mês)
- Simulação de amortização antecipada: reduzir prazo vs. reduzir prestação,
  incluindo comissão de amortização
- Impacto de subidas/descidas da Euribor na prestação
- TAEG/MTIC e total de juros pagos até ao fim
- Estratégias de liquidação de dívidas: *snowball* vs. *avalanche*

### 4. Subscrições
- Lista de subscrições com custo mensal/anual, data de renovação e categoria
- Custo total anualizado e por categoria
- Alertas de renovação e de períodos de teste a terminar
- Histórico de aumentos de preço
- Marcação "uso raro" para identificar candidatas a cancelar

### 5. Cenários (projeção plurianual)
- Linha temporal de 1 a 30 anos com evolução de rendimentos, despesas e dívidas
- Inflação e aumentos salariais configuráveis
- Eventos futuros: fim de um crédito, compra de casa/carro, filhos, mudança de emprego
- Comparação lado a lado de cenários (ex.: "amortizar crédito" vs. "investir")
- Cenários otimista / base / pessimista

### 6. Investimentos
- Carteira: ações, ETFs, fundos, PPR, certificados de aforro/tesouro, depósitos, cripto
- Rentabilidade (total, anualizada, TWR) e mais/menos-valias
- Alocação por classe de ativo, região e moeda, com sugestão de rebalanceamento
- Simulador de juros compostos com contribuições mensais
- Projeção de reforma / independência financeira (regra dos 4%)
- Estimativa de impostos (taxa liberatória de 28%, benefícios fiscais de PPR)
- Comparação de custos (TER, comissões de corretagem)

### 7. Transversais
- Metas de poupança com progresso (viagem, entrada de casa, fundo de emergência)
- Gráficos de evolução e distribuição
- Exportação/importação de dados (CSV/JSON) e backups
- Dados guardados localmente (privacidade)
- Multi-moeda

## Estado atual (v0.1)

- [x] Resumo: saldo mensal, taxa de esforço, dívida, património, renovações próximas
- [x] Orçamento: rendimentos e despesas por categoria e frequência
- [x] Créditos: prestação, plano de amortização, amortização antecipada (prazo vs. prestação, com comissão), variação da Euribor
- [x] Subscrições: custo mensal/anual, renovações, poupança ao cancelar as pouco usadas
- [x] Cenários: projeção até 40 anos com inflação, aumentos e presets pessimista/base/otimista
- [x] Investimentos: carteira com cotações reais, análise e simulação de ETFs, alocação, mais-valias e imposto, independência financeira
- [x] Página de login, perfil do utilizador, dados isolados por conta e sincronizados entre dispositivos, exportação/importação JSON

## Roadmap sugerido
1. **MVP:** despesas/rendimentos, créditos (simulador + amortização), subscrições, dashboard
2. **v2:** cenários plurianuais e comparação de cenários
3. **v3:** investimentos (carteira + simulador de juros compostos + reforma)
4. **v4:** importação de extratos, metas, multi-moeda
