# Calculadora de Finanças Pessoais

Aplicação para gerir despesas pessoais, créditos, subscrições e investimentos,
com projeção de cenários ao longo dos anos.

## Stack

- **Next.js (App Router) + React + TypeScript**, responsiva (sidebar em desktop, barra inferior em mobile, instalável como PWA)
- **Neon** (Postgres serverless) para guardar os dados de cada utilizador
- **Better Auth** para login com email e password (contas guardadas no próprio Neon)
- Os dados ficam também guardados localmente, por isso a app funciona offline e sem sessão iniciada

## Como correr

```bash
npm install
cp .env.example .env.local   # preencher DATABASE_URL e BETTER_AUTH_SECRET
npm run db:migrate           # cria as tabelas no Neon (pode ser repetido)
npm run dev                  # http://localhost:3000
npm test                     # testes das fórmulas financeiras
```

### Neon

1. Cria um projeto em [neon.tech](https://neon.tech) (ou pela integração Neon no Vercel, que preenche o `DATABASE_URL` automaticamente).
2. Copia a *pooled connection string* para `DATABASE_URL`.
3. Gera um segredo com `openssl rand -base64 32` para `BETTER_AUTH_SECRET`.
4. Corre `npm run db:migrate`.

## Deploy no Vercel

1. Importa o repositório em [vercel.com/new](https://vercel.com/new) e escolhe esta branch. O Next.js é detetado automaticamente.
2. Em **Settings → Environment Variables** define `DATABASE_URL`, `BETTER_AUTH_SECRET` e
   `BETTER_AUTH_URL` (o URL público, ex.: `https://calculator.vercel.app`).
3. Faz deploy. As tabelas são criadas automaticamente: o Vercel corre o script `vercel-build`
   (`node scripts/migrate.mjs && next build`), que aplica as migrações antes de cada build.

A migração pode ser repetida sem problemas (só cria o que falta). Usa `DATABASE_URL_UNPOOLED` (ligação direta,
criada pela integração Neon do Vercel) quando existe, senão `DATABASE_URL`. Num deploy de produção sem
`DATABASE_URL` o build falha com uma mensagem clara; nos previews sem base de dados a migração é ignorada.

## Como funciona a sincronização

Cada utilizador tem um documento JSON na tabela `user_data`. As alterações são gravadas localmente e enviadas
para `PUT /api/data` passado menos de um segundo. Os outros dispositivos vão buscar a versão mais recente quando a
janela ganha foco e a cada 30 segundos. Em caso de conflito ganha a versão mais recente: o servidor recusa
escritas mais antigas (409) e devolve a sua cópia.

## Estrutura

```
src/
  app/              rotas (App Router) e API: /api/auth (Better Auth), /api/data (sincronização)
  views/            ecrãs: Resumo, Orçamento, Créditos, Subscrições, Cenários, Investimentos, Conta
  lib/finance/      fórmulas puras (prestação, amortização, juros compostos) + testes
  lib/summary.ts    resumo mensal e projeção de cenários por ano
  lib/server/       ligação ao Neon e configuração do Better Auth
  data/             tipos, store (localStorage + sincronização)
scripts/migrate.mjs cria as tabelas
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
- [x] Investimentos: carteira, alocação, mais-valias e imposto, juros compostos, independência financeira
- [x] Login com email/password e sincronização entre dispositivos (Neon), exportação/importação JSON

## Roadmap sugerido
1. **MVP:** despesas/rendimentos, créditos (simulador + amortização), subscrições, dashboard
2. **v2:** cenários plurianuais e comparação de cenários
3. **v3:** investimentos (carteira + simulador de juros compostos + reforma)
4. **v4:** importação de extratos, metas, multi-moeda
