import type { Goal } from '../../data/types';

export interface GoalPlan {
  remaining: number;
  progress: number;
  monthsLeft: number;
  /** Monthly saving needed to hit the target on time. */
  monthly: number;
  status: 'done' | 'active' | 'overdue';
}

/** Whole months from `today` until the target date (at least 1 while the date is in the future). */
export function monthsUntil(targetDate: string, today = new Date()): number {
  const t = new Date(`${targetDate}T00:00:00`);
  const months = (t.getFullYear() - today.getFullYear()) * 12 + (t.getMonth() - today.getMonth()) + (t.getDate() >= today.getDate() ? 0 : -1);
  return Math.max(0, months);
}

export function goalPlan(goal: Goal, today = new Date()): GoalPlan {
  const remaining = Math.max(0, goal.target - goal.saved);
  const progress = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 1;
  if (remaining === 0) return { remaining, progress, monthsLeft: 0, monthly: 0, status: 'done' };
  const monthsLeft = monthsUntil(goal.targetDate, today);
  if (monthsLeft === 0) {
    const overdue = new Date(`${goal.targetDate}T23:59:59`) < today;
    return { remaining, progress, monthsLeft: 0, monthly: remaining, status: overdue ? 'overdue' : 'active' };
  }
  return { remaining, progress, monthsLeft, monthly: remaining / monthsLeft, status: 'active' };
}
