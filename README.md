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

**Diagnóstico:** abre `/api/health` na app publicada. Mostra se a autenticação está configurada, se o servidor
do Neon Auth responde, se a base de dados está acessível e qual a origem da app (sem revelar segredos).
Se o login disser que o endereço não está autorizado, adiciona essa origem aos domínios permitidos em Neon → Auth.
Se o Neon Auth exigir confirmação de email, a criação de conta tem um passo extra para o código de 6 dígitos.

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

Cada conta (ou conta partilhada) tem um documento JSON na tabela `user_data`. As alterações ficam primeiro no
dispositivo e são enviadas para `PUT /api/data` passado menos de um segundo; os outros dispositivos vão buscar a
versão mais recente quando a janela ganha foco e a cada 30 segundos.

Edições em simultâneo (dois dispositivos, ou duas pessoas numa conta partilhada) não se perdem: cada gravação diz
de que versão partiu (`X-Base-Version`) e o servidor só a aceita se for a versão guardada. Se não for, devolve a
cópia atual e a app faz uma **fusão a três** (versão de partida, local e servidor) item a item — o que cada lado
acrescentou, alterou ou apagou é aplicado — e volta a gravar. O mesmo acontece com edições feitas offline.

## Contas e dados de cada utilizador

- Todas as páginas exigem sessão; sem sessão o utilizador é enviado para `/login` (entrar ou criar conta).
- Criar conta: **Dados → Código → Pronto**. Depois do formulário, a app pede o código de 6 dígitos que o Neon Auth
  envia por email (com reenvio após 30 s e opção de mudar o email) e termina com um popup animado de boas-vindas.
  Quem tenta entrar com uma conta ainda não confirmada recebe um código novo e passa pelo mesmo passo.
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

## Movimentos (despesas pontuais)

- Registo rápido numa linha (valor, descrição, categoria, data); a categoria é sugerida pela descrição
  (ex.: "jantar" → Restauração, "Pingo Doce" → Supermercado, "Uber" → Transportes).
- Vista por mês: total, média diária, comparação com o mês anterior, maior despesa, gasto por categoria
  (clicável para filtrar), pesquisa e lista agrupada por dia; cada movimento pode ser editado ou apagado.
- A **média dos últimos 90 dias** entra no Resumo, no saldo mensal, nos Cenários e no Plano 50/30/20
  (Restauração, Compras, Lazer, Viagens, Presentes e Outros como desejos; o resto como necessidades).
- Cada movimento guarda `source` (`manual`/`import`) e `importId`, para a futura importação de extratos com IA.

## Plano 50/30/20

- Usa os rendimentos, despesas, prestações e subscrições registados: **50% necessidades, 30% desejos, 20% poupança**.
  Habitação, alimentação, transportes, saúde, educação, seguros, impostos, telecomunicações e prestações contam como
  necessidades; lazer e as restantes subscrições como desejos. Cada categoria pode ser reclassificada.
- **Valor ideal para investir por mês** = 20% do rendimento (ou o que sobrar, se for menos), menos:
  50% para o fundo de emergência enquanto não tiver o objetivo (3–12 meses de necessidades, 6 por omissão) e
  30% para amortizar dívidas com TAN ≥ 7%. Mostra também o máximo possível com o orçamento atual.
- **Estratégia S&P 500:** investimento periódico de valor fixo (DCA) num ETF UCITS de acumulação em euros
  (ex.: SXR8/VUAA), com números do histórico real do SPY desde 1993 (períodos de 10/20 anos com perda, pior queda)
  e projeção a 10/20/30 anos do valor mensal recomendado. O plano pode ser registado na carteira com um clique.

## Controlo do dia a dia

- **Movimentos** com limites mensais por categoria (aviso aos 80% e aos 100%, projeção para o fim do mês a partir
  do dia 7) e **deteção de despesas recorrentes** (3+ meses com valor estável → passar a subscrição ou despesa fixa).
- **Calendário de pagamentos**: prestações, subscrições e despesas fixas com data; o Resumo mostra os próximos 14
  dias e alertas para pagamentos nos próximos 3 dias.

## Metas e património

- **Metas** com valor, data e quanto já está poupado; a app calcula o valor mensal necessário e compara com a
  poupança disponível no Plano 50/30/20.
- **Património**: casa, carro, contas e outros bens contam para o património líquido (bens + investimentos − dívidas).
- **Histórico mensal** guardado automaticamente (o mês atual vai sendo atualizado; os anteriores ficam fixos) com
  gráfico da evolução.

## Investimentos (avançado)

- **Registo de compras** (data, unidades, preço, comissão): unidades e investido calculados, rentabilidade anual
  real (TIR/XIRR) e imposto estimado (28%) se vendesses hoje.
- **Rebalanceamento**: alocação-alvo por tipo de ativo e quanto investir em cada um este mês, sem vender nada.
- **Alertas de queda** quando o S&P 500 está 10% (correção) ou 20% (mercado em baixa) abaixo do máximo.

## IA

| Variável | Para quê |
| --- | --- |
| `OPENAI_API_KEY` | Ativa a leitura de extratos em PDF/Excel com IA, o assistente e o comentário mensal |
| `OPENAI_MODEL` | Opcional (por omissão `gpt-4.1-mini`) |
| `OPENAI_BASE_URL` | Opcional: outro endpoint compatível com a API da OpenAI |

- **Importar extrato** (`/movimentos/importar`): PDF, CSV ou Excel. Com a chave, a OpenAI extrai os movimentos
  (formato estruturado, validado no servidor); sem a chave, CSV e Excel são lidos localmente (formatos portugueses).
  Ecrã de revisão com duplicados e transferências desmarcados; cada importação pode ser anulada.
- **Assistente**: perguntas sobre as tuas finanças; o servidor lê os dados da base de dados (nunca do browser).
- **Resumo do mês** calculado pela app (sem IA), com comentário opcional da IA e versão para imprimir/PDF.
- A chave só é usada no servidor. Os extratos são enviados à OpenAI apenas para leitura e não são guardados pela app.

## Partilha, exportação e notificações

- **Conta partilhada**: cria-se em Conta, convida-se com um código (uso único, 7 dias) e os membros passam a ver e
  editar os mesmos dados. Em Movimentos indica-se quem pagou; "Contas da casa" mostra quem deve a quem (divisão
  igual) e permite registar acertos. Ao sair, cada um volta aos seus dados pessoais (ou leva uma cópia).
- **Exportar**: Excel com uma folha por área (`/api/export`) e relatório mensal pronto a guardar em PDF.
- **Notificações** no dispositivo (pagamentos de hoje/amanhã, orçamentos, metas), mostradas quando a app está aberta
  ou em segundo plano no browser. Avisos com a app completamente fechada (Web Push) ficam para uma fase seguinte.

## Estrutura

```
src/
  app/              rotas (App Router): /login, (app)/* protegidas
                    API: /api/auth, /api/data, /api/market, /api/import, /api/assistant, /api/household, /api/export, /api/health
  views/            ecrãs: Resumo, Orçamento, Movimentos, Créditos, Subscrições, Plano 50/30/20, Cenários, Investimentos, Conta
  lib/finance/      fórmulas puras (prestação, amortização, juros compostos, estatísticas e simulação de ETFs) + testes
  lib/market/       leitura das respostas do Yahoo Finance e Stooq
  lib/summary.ts    resumo mensal e projeção de cenários por ano
  lib/server/       ligação ao Neon e configuração do Neon Auth
  data/             tipos, store (localStorage + sincronização)
scripts/migrate.mjs cria as tabelas user_data e as da conta partilhada
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
- [x] Movimentos: despesas pontuais com categoria sugerida, vista mensal e filtros
- [x] Plano 50/30/20 com valor ideal a investir, fundo de emergência e estratégia mensal no S&P 500
- [x] Orçamentos por categoria com alertas, calendário de pagamentos, deteção de recorrentes
- [x] Metas de poupança, património completo (bens) e histórico mensal
- [x] Registo de compras com TIR, rebalanceamento e alertas de queda do mercado
- [x] Importação de extratos com IA (e CSV/Excel sem IA), assistente e resumo mensal
- [x] Conta partilhada com divisão de despesas, exportação Excel/PDF e notificações
- [x] Fusão de edições simultâneas (dispositivos e pessoas) sem perda de dados
- [x] Página de login, perfil do utilizador, dados isolados por conta e sincronizados entre dispositivos, exportação/importação JSON

## Guardado para mais tarde

- **Impostos e créditos**: simulador de IRS (deduções, PPR), comparador de propostas de crédito (spread, fixa vs.
  variável, MTIC) e estratégia de pagamento de dívidas (avalanche vs. bola de neve).
- Notificações Web Push com a app fechada (VAPID + tarefa agendada).
- Movimentos numa tabela própria quando o histórico importado crescer muito (hoje o documento vai até 4 MB).

## Roadmap sugerido
1. **MVP:** despesas/rendimentos, créditos (simulador + amortização), subscrições, dashboard
2. **v2:** cenários plurianuais e comparação de cenários
3. **v3:** investimentos (carteira + simulador de juros compostos + reforma)
4. **v4:** importação de extratos, metas, multi-moeda
