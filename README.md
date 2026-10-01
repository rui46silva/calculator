# Calculadora de Finanças Pessoais

Aplicação para gerir despesas pessoais, créditos, subscrições e investimentos,
com projeção de cenários ao longo dos anos.

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

## Roadmap sugerido
1. **MVP:** despesas/rendimentos, créditos (simulador + amortização), subscrições, dashboard
2. **v2:** cenários plurianuais e comparação de cenários
3. **v3:** investimentos (carteira + simulador de juros compostos + reforma)
4. **v4:** importação de extratos, metas, multi-moeda
