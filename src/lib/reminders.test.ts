import { describe, expect, it } from 'vitest';
import { emptyData, type AppData } from '../data/types';
import { remindersFor } from './reminders';

describe('remindersFor', () => {
  it('lists payments due today/tomorrow, budgets at 80%+ and overdue goals', () => {
    const today = new Date(2026, 9, 10, 9);
    const data: AppData = {
      ...emptyData(),
      subscriptions: [
        { id: 's1', name: 'Netflix', category: 'Streaming', amount: 15.99, frequency: 'monthly', nextRenewal: '2026-10-11', rarelyUsed: false },
        { id: 's2', name: 'Spotify', category: 'Música', amount: 10.99, frequency: 'monthly', nextRenewal: '2026-10-20', rarelyUsed: false },
      ],
      transactions: [{ id: 't', date: '2026-10-03', description: 'Jantar', amount: 90, type: 'expense', category: 'Restauração', source: 'manual' }],
      categoryBudgets: { Restauração: 100, Compras: 50 },
      goals: [{ id: 'g', name: 'Carro', icon: '🚗', target: 1000, saved: 100, targetDate: '2026-09-01' }],
    };
    const r = remindersFor(data, today);
    expect(r.map((x) => x.title)).toEqual(['Pagamento amanhã: Netflix', 'Perto do limite: Restauração', 'Meta fora de prazo: Carro']);
    expect(new Set(r.map((x) => x.key)).size).toBe(3);
  });
});
