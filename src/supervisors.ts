import type {
  MindPilotStateType,
  MindPilotStateUpdate,
  DomainReport,
  CrossDomainPattern,
} from "./state.js";

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function num(record: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!record) return undefined;
  const raw = record[key];
  return typeof raw === "number" ? raw : undefined;
}

function nested(
  record: Record<string, unknown> | undefined,
  key: string,
): Record<string, number> | undefined {
  if (!record) return undefined;
  const raw = record[key];
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

export function healthSupervisor(state: MindPilotStateType): MindPilotStateUpdate {
  const efficiency = num(state.sleep, "efficiency") ?? 0;
  const debtHours = num(state.sleep, "debtHours") ?? 0;
  const sleepAnomalies = num(state.sleep, "anomalies") ?? 0;
  const avgSteps = num(state.activity, "avgSteps") ?? 0;
  const sedentaryDays = num(state.activity, "sedentaryDays") ?? 0;

  const sleepDeficit = clamp01(debtHours / 14);
  const inactivityLoad = clamp01(sedentaryDays / 5);
  const compound = clamp01(sleepDeficit * 0.6 + inactivityLoad * 0.4 + sleepAnomalies * 0.05);

  const hasSleep = state.sleep !== undefined;
  const hasActivity = state.activity !== undefined;
  const confidence = clamp01((hasSleep ? 0.6 : 0) + (hasActivity ? 0.4 : 0));

  const bits: string[] = [];
  if (debtHours >= 8) bits.push(`sleep debt ${debtHours.toFixed(1)}h`);
  if (efficiency < 0.8 && hasSleep) bits.push(`efficiency ${(efficiency * 100).toFixed(0)}%`);
  if (sedentaryDays >= 2) bits.push(`${sedentaryDays} sedentary days`);
  if (avgSteps > 0 && avgSteps < 6000) bits.push(`avg ${avgSteps} steps`);
  const summary =
    bits.length === 0 ? "Health signals nominal." : `Health strain: ${bits.join(", ")}.`;

  const report: DomainReport = {
    domain: "health",
    confidence,
    summary,
    metrics: {
      sleepEfficiency: round2(efficiency),
      sleepDebtHours: round2(debtHours),
      sleepAnomalies,
      avgSteps,
      sedentaryDays,
      strainScore: round2(compound),
    },
  };

  return { domainReports: [report] };
}

export function productivitySupervisor(state: MindPilotStateType): MindPilotStateUpdate {
  const loadScore = num(state.calendar, "loadScore") ?? 0;
  const eveningMeetings = num(state.calendar, "eveningMeetings") ?? 0;
  const workDays = num(state.calendar, "workDays") ?? 0;
  const avgDeepWork = num(state.focus, "avgDeepWorkMinutes") ?? 0;
  const fragmentation = num(state.focus, "fragmentationScore") ?? 0;
  const interruptions = num(state.focus, "totalInterruptions") ?? 0;
  const lowFocusDays = num(state.focus, "lowFocusDays") ?? 0;

  const meetingLoad = clamp01(loadScore / 1.2);
  const eveningPenalty = clamp01(eveningMeetings / 6);
  const focusDeficit = clamp01((90 - avgDeepWork) / 90);
  const fragPenalty = clamp01(fragmentation / 4);
  const overload = clamp01(
    meetingLoad * 0.4 + eveningPenalty * 0.2 + focusDeficit * 0.25 + fragPenalty * 0.15,
  );

  const hasCal = state.calendar !== undefined;
  const hasFocus = state.focus !== undefined;
  const confidence = clamp01((hasCal ? 0.55 : 0) + (hasFocus ? 0.45 : 0));

  const bits: string[] = [];
  if (loadScore >= 0.9) bits.push(`meeting load ${loadScore.toFixed(2)}`);
  if (eveningMeetings >= 3) bits.push(`${eveningMeetings} evening meetings`);
  if (avgDeepWork > 0 && avgDeepWork < 60) bits.push(`deep work only ${avgDeepWork}m`);
  if (fragmentation >= 2) bits.push(`fragmentation ${fragmentation.toFixed(2)}`);
  if (lowFocusDays >= 2) bits.push(`${lowFocusDays} low-focus days`);
  const summary =
    bits.length === 0
      ? "Productivity signals nominal."
      : `Productivity strain: ${bits.join(", ")}.`;

  const report: DomainReport = {
    domain: "productivity",
    confidence,
    summary,
    metrics: {
      meetingLoadScore: round2(loadScore),
      eveningMeetings,
      workDays,
      avgDeepWorkMinutes: avgDeepWork,
      fragmentationScore: round2(fragmentation),
      totalInterruptions: interruptions,
      lowFocusDays,
      overloadScore: round2(overload),
    },
  };

  return { domainReports: [report] };
}

export function financeSupervisor(state: MindPilotStateType): MindPilotStateUpdate {
  const totals = nested(state.spending, "totalsByCategory") ?? {};
  const zScores = nested(state.spending, "zScores") ?? {};
  const stressSessions = num(state.spending, "stressSessions") ?? 0;
  const transactions = num(state.spending, "transactions") ?? 0;

  const totalSpend = Object.values(totals).reduce((a, b) => a + b, 0);
  const foodDelivery = totals["food_delivery"] ?? 0;
  const shopping = totals["shopping"] ?? 0;
  const impulseShare = totalSpend === 0 ? 0 : (foodDelivery + shopping) / totalSpend;

  const anomalousCategories = Object.entries(zScores)
    .filter(([, z]) => Math.abs(z) >= 1.5)
    .map(([cat]) => cat);

  const stressLoad = clamp01(stressSessions / 3);
  const impulsePenalty = clamp01(impulseShare);
  const financeStrain = clamp01(stressLoad * 0.6 + impulsePenalty * 0.4);

  const hasSpending = state.spending !== undefined;
  const confidence = clamp01(hasSpending ? 0.9 : 0);

  const bits: string[] = [];
  if (stressSessions > 0) bits.push(`${stressSessions} late-night sprees`);
  if (impulseShare >= 0.6 && totalSpend > 0)
    bits.push(`${(impulseShare * 100).toFixed(0)}% impulse categories`);
  if (anomalousCategories.length > 0) bits.push(`anomalies in ${anomalousCategories.join(",")}`);
  const summary =
    bits.length === 0 ? "Finance signals nominal." : `Finance strain: ${bits.join(", ")}.`;

  const report: DomainReport = {
    domain: "finance",
    confidence,
    summary,
    metrics: {
      totalSpend: round2(totalSpend),
      foodDeliveryTotal: round2(foodDelivery),
      shoppingTotal: round2(shopping),
      impulseShare: round2(impulseShare),
      stressSessions,
      transactions,
      strainScore: round2(financeStrain),
    },
  };

  return { domainReports: [report] };
}

export function insightSupervisor(state: MindPilotStateType): MindPilotStateUpdate {
  const reports = state.domainReports ?? [];
  const byDomain = new Map(reports.map((r) => [r.domain, r]));
  const health = byDomain.get("health");
  const productivity = byDomain.get("productivity");
  const finance = byDomain.get("finance");

  const patterns: CrossDomainPattern[] = [];

  if (health && finance) {
    const sleepDebt = health.metrics.sleepDebtHours ?? 0;
    const stressSessions = finance.metrics.stressSessions ?? 0;
    if (sleepDebt >= 8 && stressSessions >= 1) {
      const conf = clamp01(
        Math.min(health.confidence, finance.confidence) *
          clamp01(sleepDebt / 14) *
          clamp01(stressSessions / 3),
      );
      patterns.push({
        id: "late_night_spending_erodes_sleep",
        confidence: round2(conf),
        domains: ["finance", "health"],
        explanation: `Late-night spending sessions (${stressSessions}) coincide with sleep debt of ${sleepDebt}h.`,
      });
    }
  }

  if (productivity && health) {
    const overload = productivity.metrics.overloadScore ?? 0;
    const strain = health.metrics.strainScore ?? 0;
    if (overload >= 0.5 && strain >= 0.4) {
      const conf = clamp01(
        Math.min(productivity.confidence, health.confidence) * overload * strain * 2,
      );
      patterns.push({
        id: "meeting_overload_drives_health_strain",
        confidence: round2(conf),
        domains: ["productivity", "health"],
        explanation: `Meeting overload (score ${overload}) tracks with health strain (${strain}).`,
      });
    }
  }

  if (productivity && finance) {
    const overload = productivity.metrics.overloadScore ?? 0;
    const financeStrain = finance.metrics.strainScore ?? 0;
    if (overload >= 0.5 && financeStrain >= 0.4) {
      const conf = clamp01(
        Math.min(productivity.confidence, finance.confidence) * overload * financeStrain * 2,
      );
      patterns.push({
        id: "overload_triggers_impulse_spending",
        confidence: round2(conf),
        domains: ["productivity", "finance"],
        explanation: `Overload days (score ${overload}) align with impulse spending (strain ${financeStrain}).`,
      });
    }
  }

  const confidence =
    reports.length === 0 ? 0 : reports.reduce((a, r) => a + r.confidence, 0) / reports.length;

  const summary =
    patterns.length === 0
      ? "No cross-domain patterns detected."
      : `Detected ${patterns.length} cross-domain pattern(s): ${patterns.map((p) => p.id).join(", ")}.`;

  const report: DomainReport = {
    domain: "insight",
    confidence: round2(confidence),
    summary,
    metrics: {
      patternsFound: patterns.length,
      domainsAnalyzed: reports.length,
    },
  };

  return {
    domainReports: [report],
    crossDomainPatterns: patterns,
  };
}
