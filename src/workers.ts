import type { MindPilotStateType, MindPilotStateUpdate } from "./state.js";

interface SleepNight {
  date: string;
  inBedHours: number;
  asleepHours: number;
}

interface ActivityDay {
  date: string;
  steps: number;
  activeMinutes: number;
}

interface CalendarDay {
  date: string;
  meetings: number;
  eveningMeetings: number;
  workingHours: number;
}

interface SpendingTx {
  date: string;
  hour: number;
  category: string;
  amount: number;
}

interface FocusSession {
  date: string;
  durationMinutes: number;
  interruptions: number;
}

function fetchSleepData(): SleepNight[] {
  return [
    { date: "2026-05-27", inBedHours: 7.5, asleepHours: 5.1 },
    { date: "2026-05-28", inBedHours: 8.0, asleepHours: 5.6 },
    { date: "2026-05-29", inBedHours: 6.8, asleepHours: 4.3 },
    { date: "2026-05-30", inBedHours: 7.2, asleepHours: 4.8 },
    { date: "2026-05-31", inBedHours: 8.4, asleepHours: 5.9 },
    { date: "2026-06-01", inBedHours: 7.0, asleepHours: 4.5 },
    { date: "2026-06-02", inBedHours: 7.6, asleepHours: 5.0 },
  ];
}

function fetchActivityData(): ActivityDay[] {
  return [
    { date: "2026-05-27", steps: 8200, activeMinutes: 42 },
    { date: "2026-05-28", steps: 6100, activeMinutes: 28 },
    { date: "2026-05-29", steps: 3400, activeMinutes: 11 },
    { date: "2026-05-30", steps: 9100, activeMinutes: 51 },
    { date: "2026-05-31", steps: 12400, activeMinutes: 72 },
    { date: "2026-06-01", steps: 5200, activeMinutes: 19 },
    { date: "2026-06-02", steps: 4100, activeMinutes: 14 },
  ];
}

function fetchCalendarData(): CalendarDay[] {
  return [
    { date: "2026-05-27", meetings: 6, eveningMeetings: 1, workingHours: 8 },
    { date: "2026-05-28", meetings: 8, eveningMeetings: 2, workingHours: 8 },
    { date: "2026-05-29", meetings: 5, eveningMeetings: 0, workingHours: 8 },
    { date: "2026-05-30", meetings: 0, eveningMeetings: 0, workingHours: 0 },
    { date: "2026-05-31", meetings: 0, eveningMeetings: 0, workingHours: 0 },
    { date: "2026-06-01", meetings: 9, eveningMeetings: 2, workingHours: 8 },
    { date: "2026-06-02", meetings: 7, eveningMeetings: 2, workingHours: 8 },
  ];
}

function fetchSpendingData(): SpendingTx[] {
  return [
    { date: "2026-05-28", hour: 23, category: "food_delivery", amount: 32 },
    { date: "2026-05-28", hour: 23, category: "food_delivery", amount: 18 },
    { date: "2026-05-28", hour: 23, category: "shopping", amount: 64 },
    { date: "2026-05-29", hour: 13, category: "groceries", amount: 54 },
    { date: "2026-06-01", hour: 22, category: "food_delivery", amount: 29 },
    { date: "2026-06-01", hour: 23, category: "food_delivery", amount: 41 },
    { date: "2026-06-01", hour: 23, category: "shopping", amount: 88 },
    { date: "2026-06-02", hour: 12, category: "groceries", amount: 47 },
    { date: "2026-06-02", hour: 22, category: "food_delivery", amount: 36 },
  ];
}

function fetchFocusData(): FocusSession[] {
  return [
    { date: "2026-05-27", durationMinutes: 95, interruptions: 2 },
    { date: "2026-05-28", durationMinutes: 40, interruptions: 6 },
    { date: "2026-05-29", durationMinutes: 110, interruptions: 1 },
    { date: "2026-05-30", durationMinutes: 0, interruptions: 0 },
    { date: "2026-05-31", durationMinutes: 0, interruptions: 0 },
    { date: "2026-06-01", durationMinutes: 25, interruptions: 8 },
    { date: "2026-06-02", durationMinutes: 35, interruptions: 7 },
  ];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  const variance = mean(values.map((v) => (v - mu) ** 2));
  return Math.sqrt(variance);
}

export function sleepAnalyst(_state: MindPilotStateType): MindPilotStateUpdate {
  const nights = fetchSleepData();
  const efficiency = mean(nights.map((n) => n.asleepHours / n.inBedHours));
  const debt = nights.reduce((acc, n) => acc + Math.max(0, 7 - n.asleepHours), 0);
  const anomalies = nights.filter((n) => n.asleepHours < 5).length;

  return {
    sleep: {
      efficiency: Number(efficiency.toFixed(2)),
      debtHours: Number(debt.toFixed(1)),
      anomalies,
      nights: nights.length,
    },
  };
}

export function activityTracker(_state: MindPilotStateType): MindPilotStateUpdate {
  const days = fetchActivityData();
  const avgSteps = mean(days.map((d) => d.steps));
  const avgActive = mean(days.map((d) => d.activeMinutes));
  const sedentaryDays = days.filter((d) => d.steps < 5000).length;

  return {
    activity: {
      avgSteps: Math.round(avgSteps),
      avgActiveMinutes: Math.round(avgActive),
      sedentaryDays,
      days: days.length,
    },
  };
}

export function calendarAnalyst(_state: MindPilotStateType): MindPilotStateUpdate {
  const days = fetchCalendarData();
  const workDays = days.filter((d) => d.workingHours > 0);
  const loadScore =
    workDays.length === 0
      ? 0
      : mean(workDays.map((d) => d.meetings)) / mean(workDays.map((d) => d.workingHours));
  const eveningMeetings = days.reduce((acc, d) => acc + d.eveningMeetings, 0);

  return {
    calendar: {
      loadScore: Number(loadScore.toFixed(2)),
      eveningMeetings,
      workDays: workDays.length,
    },
  };
}

export function spendingAnalyst(_state: MindPilotStateType): MindPilotStateUpdate {
  const txs = fetchSpendingData();
  const byCategory = new Map<string, number[]>();
  for (const tx of txs) {
    const list = byCategory.get(tx.category) ?? [];
    list.push(tx.amount);
    byCategory.set(tx.category, list);
  }

  const zScores: Record<string, number> = {};
  for (const [category, amounts] of byCategory) {
    const mu = mean(amounts);
    const sigma = stddev(amounts);
    zScores[category] = sigma === 0 ? 0 : Number(((mu - mu) / sigma).toFixed(2));
  }

  const sessions = new Map<string, SpendingTx[]>();
  for (const tx of txs) {
    if (tx.hour < 22) continue;
    const list = sessions.get(tx.date) ?? [];
    list.push(tx);
    sessions.set(tx.date, list);
  }
  const stressSessions = [...sessions.values()].filter((s) => s.length >= 3).length;

  const totalsByCategory: Record<string, number> = {};
  for (const [category, amounts] of byCategory) {
    totalsByCategory[category] = amounts.reduce((a, b) => a + b, 0);
  }

  return {
    spending: {
      totalsByCategory,
      zScores,
      stressSessions,
      transactions: txs.length,
    },
  };
}

export function focusTracker(_state: MindPilotStateType): MindPilotStateUpdate {
  const sessions = fetchFocusData();
  const workSessions = sessions.filter((s) => s.durationMinutes > 0);
  const avgDeepWorkMinutes = mean(workSessions.map((s) => s.durationMinutes));
  const totalInterruptions = sessions.reduce((acc, s) => acc + s.interruptions, 0);
  const fragmentationScore =
    workSessions.length === 0
      ? 0
      : mean(workSessions.map((s) => s.interruptions / Math.max(1, s.durationMinutes / 30)));
  const lowFocusDays = workSessions.filter((s) => s.durationMinutes < 45).length;

  return {
    focus: {
      avgDeepWorkMinutes: Math.round(avgDeepWorkMinutes),
      fragmentationScore: Number(fragmentationScore.toFixed(2)),
      totalInterruptions,
      lowFocusDays,
      sessions: workSessions.length,
    },
  };
}
