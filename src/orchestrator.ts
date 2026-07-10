import { StateGraph, START, END } from "@langchain/langgraph";
import { MindPilotState, type MindPilotStateType, type MindPilotStateUpdate, type Domain } from "./state.js";
import { sleepAnalyst, activityTracker, calendarAnalyst, spendingAnalyst, focusTracker } from "./workers.js";
import { healthSupervisor, productivitySupervisor, financeSupervisor, insightSupervisor } from "./supervisors.js";

const HEALTH_KEYWORDS = ["sleep", "tired", "rest", "insomnia", "energy", "steps", "exercise", "active", "fitness", "workout", "health", "body"];
const PRODUCTIVITY_KEYWORDS = ["meeting", "calendar", "schedule", "work", "overloaded", "busy", "focus", "deep work", "distracted", "productive", "productivity", "task"];
const FINANCE_KEYWORDS = ["spend", "spending", "money", "budget", "finance", "financial", "cost", "transaction", "buy", "purchase", "saving"];

export function orchestratorPlan(state: MindPilotStateType): MindPilotStateUpdate {
  const q = state.query.toLowerCase();
  const domains = new Set<Domain>();

  if (HEALTH_KEYWORDS.some((k) => q.includes(k))) domains.add("health");
  if (PRODUCTIVITY_KEYWORDS.some((k) => q.includes(k))) domains.add("productivity");
  if (FINANCE_KEYWORDS.some((k) => q.includes(k))) domains.add("finance");

  if (domains.size === 0) {
    domains.add("health");
    domains.add("productivity");
    domains.add("finance");
  }

  return { supervisorsNeeded: [...domains] };
}

export function orchestratorSynthesize(state: MindPilotStateType): MindPilotStateUpdate {
  const reports = state.domainReports ?? [];
  const patterns = state.crossDomainPatterns ?? [];

  const lines: string[] = [`> "${state.query}"`, ""];

  const domainOrder: Domain[] = ["health", "productivity", "finance"];
  for (const domain of domainOrder) {
    const r = reports.find((rep) => rep.domain === domain);
    if (r) lines.push(`[${r.domain.toUpperCase()}] (conf ${r.confidence}) ${r.summary}`);
  }

  if (patterns.length > 0) {
    lines.push("", "Cross-domain patterns:");
    for (const p of patterns) {
      lines.push(`  • ${p.explanation} (conf ${p.confidence})`);
    }
  }

  const insight = reports.find((r) => r.domain === "insight");
  if (insight) lines.push("", insight.summary);

  return { finalResponse: lines.join("\n") };
}

export function buildGraph() {
  return new StateGraph(MindPilotState)
    .addNode("plan", orchestratorPlan)
    .addNode("sleepAnalyst", sleepAnalyst)
    .addNode("activityTracker", activityTracker)
    .addNode("calendarAnalyst", calendarAnalyst)
    .addNode("spendingAnalyst", spendingAnalyst)
    .addNode("focusTracker", focusTracker)
    .addNode("healthSupervisor", healthSupervisor)
    .addNode("productivitySupervisor", productivitySupervisor)
    .addNode("financeSupervisor", financeSupervisor)
    .addNode("insightSupervisor", insightSupervisor)
    .addNode("synthesize", orchestratorSynthesize)
    .addEdge(START, "plan")
    .addEdge("plan", "sleepAnalyst")
    .addEdge("plan", "activityTracker")
    .addEdge("plan", "calendarAnalyst")
    .addEdge("plan", "spendingAnalyst")
    .addEdge("plan", "focusTracker")
    .addEdge("sleepAnalyst", "healthSupervisor")
    .addEdge("activityTracker", "healthSupervisor")
    .addEdge("calendarAnalyst", "productivitySupervisor")
    .addEdge("focusTracker", "productivitySupervisor")
    .addEdge("spendingAnalyst", "financeSupervisor")
    .addEdge("healthSupervisor", "insightSupervisor")
    .addEdge("productivitySupervisor", "insightSupervisor")
    .addEdge("financeSupervisor", "insightSupervisor")
    .addEdge("insightSupervisor", "synthesize")
    .addEdge("synthesize", END)
    .compile();
}

async function main() {
  const graph = buildGraph();
  const queries = ["How was my week?", "How is my sleep?", "Am I overloaded?"];

  for (const query of queries) {
    const result = await graph.invoke({ query });
    console.log("─".repeat(60));
    console.log(result.finalResponse);
    console.log();
  }
}

main().catch(console.error);
